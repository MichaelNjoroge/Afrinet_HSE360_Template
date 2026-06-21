import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

// Canonical sender identity. Keep both values aligned (same organisational
// domain) so SPF/DKIM/DMARC alignment passes — verified at runtime before
// every send by verifyDeliverability().
const SENDER_DOMAIN = "notify.prosellimited.com";
const FROM_DOMAIN = "prosellimited.com";

const emailListSchema = z
  .array(z.string().trim().toLowerCase().email())
  .min(1)
  .max(20);

const moduleSchema = z.string().trim().min(2).max(80);

// Expose the deliverability check as its own server function so an admin
// diagnostic panel (or a future cron) can run it on demand.
export const checkReportEmailDeliverability = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: level } = await context.supabase.rpc("user_auth_level", {
      _user_id: context.userId,
    });
    if (Number(level ?? 1) < 3) {
      throw new Error("Deliverability checks require Level 3 authorization or higher.");
    }
    const { verifyDeliverability } = await import("./email-deliverability.server");
    return verifyDeliverability(SENDER_DOMAIN, FROM_DOMAIN);
  });

// Fetch branding (company name, footer, signed letterhead URL) for use in
// PDF exports and emails. Available to any signed-in user, since these are
// company-wide presentation assets.
export const getReportBranding = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data: level } = await context.supabase.rpc("user_auth_level", {
      _user_id: context.userId,
    });
    const authLevel = Number(level ?? 1);

    const { data: settings } = await context.supabase
      .from("company_report_settings")
      .select("company_name,report_footer,letterhead_path")
      .limit(1)
      .maybeSingle();

    let letterheadUrl: string | null = null;
    if (settings?.letterhead_path) {
      const signed = await context.supabase.storage
        .from("company-letterheads")
        .createSignedUrl(settings.letterhead_path, 1800);
      letterheadUrl = signed.data?.signedUrl ?? null;
    }

    return {
      companyName: settings?.company_name ?? "Prosel Limited",
      reportFooter: settings?.report_footer ?? "",
      letterheadUrl,
      letterheadMime: settings?.letterhead_path?.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "image/*",
      authLevel,
      canEmailReports: authLevel >= 3,
    };
  });

// Email a generated report. The caller uploads the PDF (base64) and we
// store it in the secure bucket, generate a signed download URL, and
// enqueue a transactional email containing the link. Gated to Level 3+.
export const emailReportLink = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input) =>
    z
      .object({
        module: moduleSchema,
        title: z.string().trim().min(2).max(200),
        recipients: emailListSchema,
        message: z.string().trim().max(2000).optional().default(""),
        fileName: z.string().trim().min(3).max(120),
        // Base64-encoded PDF body, max ~12 MB before encoding.
        pdfBase64: z.string().min(100).max(20_000_000),
      })
      .parse(input),
  )
  .handler(async ({ data, context }) => {
    const { data: level } = await context.supabase.rpc("user_auth_level", {
      _user_id: context.userId,
    });
    if (Number(level ?? 1) < 3) {
      throw new Error("Sending reports by email requires Level 3 authorization or higher.");
    }

    // Decode and upload to secure bucket
    const bytes = Uint8Array.from(atob(data.pdfBase64), (c) => c.charCodeAt(0));
    if (bytes.byteLength > 15 * 1024 * 1024) {
      throw new Error("Report exceeds the 15 MB email limit.");
    }
    const safeName = data.fileName.replace(/[^a-z0-9._-]+/gi, "-").slice(0, 80);
    const path = `reports/${context.userId}/${crypto.randomUUID()}-${safeName}.pdf`;
    const { error: uploadError } = await context.supabase.storage
      .from("hse-secure-files")
      .upload(path, bytes, { contentType: "application/pdf", upsert: false });
    if (uploadError) {
      console.error("[email-report] upload failed", uploadError.message);
      throw new Error("The report could not be staged for emailing.");
    }
    const signed = await context.supabase.storage
      .from("hse-secure-files")
      .createSignedUrl(path, 60 * 60 * 24 * 7); // 7 days
    if (!signed.data?.signedUrl) {
      throw new Error("Could not generate a secure download link.");
    }
    const downloadUrl = signed.data.signedUrl;

    const { data: settings } = await context.supabase
      .from("company_report_settings")
      .select("company_name,report_footer")
      .limit(1)
      .maybeSingle();
    const company = settings?.company_name ?? "Prosel Limited";
    const footer = settings?.report_footer ?? "";

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    // Hard gate: verify SPF / MX / DMARC and From-alignment before we
    // enqueue anything. This prevents silent bounces caused by domain
    // misconfiguration (e.g. From: header pointing at an unverified domain).
    const { verifyDeliverability } = await import("./email-deliverability.server");
    const deliverability = await verifyDeliverability(SENDER_DOMAIN, FROM_DOMAIN);
    if (!deliverability.ok) {
      console.error("[email-report] deliverability check failed", deliverability.issues);
      const summary = deliverability.issues.map((i) => i.message).join(" ");
      throw new Error(
        `Emails cannot be sent: sender domain is not deliverable. ${summary}`,
      );
    }

    const delivery = {
      queued: [] as string[],
      suppressed: [] as string[],
      failed: [] as { email: string; reason: string }[],
    };
    for (const recipient of data.recipients) {
      const normalizedEmail = recipient.toLowerCase().trim();

      // Suppression check — never send to bounced/complained/unsubscribed addresses.
      const { data: suppressed } = await supabaseAdmin
        .from("suppressed_emails")
        .select("email")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (suppressed) {
        await supabaseAdmin.from("email_send_log").insert({
          message_id: crypto.randomUUID(),
          template_name: "hse-report",
          recipient_email: normalizedEmail,
          status: "suppressed",
          error_message: "Recipient on suppression list",
        });
        delivery.suppressed.push(normalizedEmail);
        continue;
      }

      // Get-or-create unsubscribe token (required by the queue processor).
      let unsubscribeToken: string | null = null;
      const { data: existingToken } = await supabaseAdmin
        .from("email_unsubscribe_tokens")
        .select("token")
        .eq("email", normalizedEmail)
        .maybeSingle();
      if (existingToken?.token) {
        unsubscribeToken = existingToken.token;
      } else {
        const newToken = crypto.randomUUID().replace(/-/g, "") + crypto.randomUUID().replace(/-/g, "");
        const { error: tokenErr } = await supabaseAdmin
          .from("email_unsubscribe_tokens")
          .upsert({ token: newToken, email: normalizedEmail }, { onConflict: "email" });
        if (tokenErr) {
          console.error("[email-report] unsubscribe token failed", tokenErr.message);
          delivery.failed.push({ email: normalizedEmail, reason: "Could not prepare unsubscribe details" });
          continue;
        }
        const { data: readBack } = await supabaseAdmin
          .from("email_unsubscribe_tokens")
          .select("token")
          .eq("email", normalizedEmail)
          .maybeSingle();
        unsubscribeToken = readBack?.token ?? newToken;
      }

      if (!unsubscribeToken) {
        await supabaseAdmin.from("email_send_log").insert({
          message_id: crypto.randomUUID(),
          template_name: "hse-report",
          recipient_email: normalizedEmail,
          status: "failed",
          error_message: "Missing unsubscribe token",
        });
        delivery.failed.push({ email: normalizedEmail, reason: "Could not prepare unsubscribe details" });
        continue;
      }

      const messageId = crypto.randomUUID();
      const safeMessage = data.message
        ? `<p style="margin:0 0 16px">${escapeHtml(data.message)}</p>`
        : "";
      const html = `
        <div style="font-family:Arial,sans-serif;color:#0f172a;line-height:1.55;padding:24px;background:#ffffff">
          <p style="font-size:11px;text-transform:uppercase;letter-spacing:1.5px;color:#64748b;margin:0 0 6px">${escapeHtml(company)}</p>
          <h1 style="font-size:22px;margin:0 0 14px">${escapeHtml(data.title)}</h1>
          ${safeMessage}
          <p style="margin:0 0 14px">A new HSE report is ready for your review. Use the secure link below to download it. The link expires in 7 days.</p>
          <p style="margin:0 0 22px">
            <a href="${downloadUrl}" style="display:inline-block;background:#0f3460;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600">Download report (PDF)</a>
          </p>
          <p style="font-size:12px;color:#64748b;margin:0 0 4px"><strong>Sent by:</strong> a Level ${level} user from ${escapeHtml(company)}</p>
          ${footer ? `<p style="margin-top:24px;color:#64748b;font-size:12px">${escapeHtml(footer)}</p>` : ""}
        </div>`;
      const text = [
        company,
        data.title,
        data.message,
        "",
        "Download the report (link expires in 7 days):",
        downloadUrl,
        footer ? `\n${footer}` : "",
      ]
        .filter(Boolean)
        .join("\n");

      await supabaseAdmin.from("email_send_log").insert({
        message_id: messageId,
        template_name: "hse-report",
        recipient_email: normalizedEmail,
        status: "pending",
      });

      const { error: enqueueError } = await supabaseAdmin.rpc("enqueue_email", {
        queue_name: "transactional_emails",
        payload: {
          message_id: messageId,
          to: normalizedEmail,
          from: `${company} <noreply@${FROM_DOMAIN}>`,
          sender_domain: SENDER_DOMAIN,
          subject: `${company} · ${data.title}`,
          html,
          text,
          purpose: "transactional",
          label: "hse-report",
          idempotency_key: `report-${messageId}`,
          unsubscribe_token: unsubscribeToken,
          queued_at: new Date().toISOString(),
        },
      });

      if (enqueueError) {
        console.error("[email-report] enqueue failed", enqueueError.message);
        await supabaseAdmin.from("email_send_log").insert({
          message_id: messageId,
          template_name: "hse-report",
          recipient_email: normalizedEmail,
          status: "failed",
          error_message: enqueueError.message.slice(0, 1000),
        });
        delivery.failed.push({ email: normalizedEmail, reason: "The email queue could not accept the message" });
        continue;
      }

      delivery.queued.push(normalizedEmail);
    }

    if (delivery.queued.length === 0) {
      const reason = delivery.failed[0]?.reason ?? "all selected recipients are suppressed";
      throw new Error(reason);
    }

    return { ok: true, recipientCount: data.recipients.length, delivery };
  });

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
