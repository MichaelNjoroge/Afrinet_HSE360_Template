// Pre-send deliverability verification for HSE report emails.
// Uses Cloudflare DNS-over-HTTPS to confirm the sender domain has the
// records required for SPF / DMARC alignment before we enqueue a send.
// Results are cached in-process for 1 hour to avoid hammering DNS.

const DOH = "https://cloudflare-dns.com/dns-query";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

type DohAnswer = { name: string; type: number; TTL: number; data: string };
type DohResponse = { Status: number; Answer?: DohAnswer[] };

export type DeliverabilityIssue = {
  code: "spf_missing" | "mx_missing" | "dmarc_missing" | "from_alignment" | "dns_unreachable";
  message: string;
};

export type DeliverabilityResult = {
  ok: boolean;
  senderDomain: string;
  fromDomain: string;
  rootDomain: string;
  checks: {
    spf: boolean;
    mx: boolean;
    dmarc: boolean;
    alignment: boolean;
  };
  issues: DeliverabilityIssue[];
  checkedAt: string;
};

const cache = new Map<string, { result: DeliverabilityResult; expiresAt: number }>();

async function doh(name: string, type: "TXT" | "MX"): Promise<DohAnswer[]> {
  const res = await fetch(`${DOH}?name=${encodeURIComponent(name)}&type=${type}`, {
    headers: { accept: "application/dns-json" },
  });
  if (!res.ok) {
    throw new Error(`DoH ${type} lookup for ${name} failed: ${res.status}`);
  }
  const json = (await res.json()) as DohResponse;
  return json.Answer ?? [];
}

function rootOf(domain: string): string {
  const parts = domain.split(".").filter(Boolean);
  if (parts.length <= 2) return domain;
  return parts.slice(-2).join(".");
}

/**
 * Verify that the email sending domain is correctly configured.
 *
 * @param senderDomain  The verified envelope/sender FQDN (e.g. "notify.prosellimited.com").
 *                      SPF and MX must live on this hostname.
 * @param fromDomain    The visible From: header domain (may be the root for display).
 *                      Must share an organisational domain with senderDomain for DMARC alignment.
 */
export async function verifyDeliverability(
  senderDomain: string,
  fromDomain: string,
): Promise<DeliverabilityResult> {
  const key = `${senderDomain}|${fromDomain}`;
  const cached = cache.get(key);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.result;
  }

  const rootDomain = rootOf(senderDomain);
  const issues: DeliverabilityIssue[] = [];
  const checks = { spf: false, mx: false, dmarc: false, alignment: false };

  // Alignment: From-domain root must equal sender-domain root (relaxed DMARC alignment).
  checks.alignment = rootOf(fromDomain) === rootDomain;
  if (!checks.alignment) {
    issues.push({
      code: "from_alignment",
      message: `From-domain "${fromDomain}" does not align with sender domain "${senderDomain}" (root mismatch). DMARC will fail.`,
    });
  }

  try {
    const [senderTxt, senderMx, dmarcTxt] = await Promise.all([
      doh(senderDomain, "TXT"),
      doh(senderDomain, "MX"),
      doh(`_dmarc.${rootDomain}`, "TXT"),
    ]);

    checks.spf = senderTxt.some((r) => /v=spf1/i.test(r.data));
    if (!checks.spf) {
      issues.push({
        code: "spf_missing",
        message: `No SPF (v=spf1) TXT record found on ${senderDomain}. Recipient servers cannot authorise this sender.`,
      });
    }

    checks.mx = senderMx.length > 0;
    if (!checks.mx) {
      issues.push({
        code: "mx_missing",
        message: `No MX record found on ${senderDomain}. Bounces and replies have nowhere to go.`,
      });
    }

    checks.dmarc = dmarcTxt.some((r) => /v=DMARC1/i.test(r.data));
    if (!checks.dmarc) {
      issues.push({
        code: "dmarc_missing",
        message: `No DMARC (_dmarc.${rootDomain}) policy found. Strict inboxes (Gmail, Yahoo) will reject bulk mail.`,
      });
    }
  } catch (err) {
    issues.push({
      code: "dns_unreachable",
      message: `DNS verification could not complete: ${(err as Error).message}`,
    });
  }

  const result: DeliverabilityResult = {
    ok: issues.length === 0,
    senderDomain,
    fromDomain,
    rootDomain,
    checks,
    issues,
    checkedAt: new Date().toISOString(),
  };

  // Cache successes for the full TTL; cache failures briefly so a DNS fix
  // takes effect quickly without waiting an hour.
  cache.set(key, {
    result,
    expiresAt: Date.now() + (result.ok ? CACHE_TTL_MS : 60 * 1000),
  });

  return result;
}

export function clearDeliverabilityCache(): void {
  cache.clear();
}
