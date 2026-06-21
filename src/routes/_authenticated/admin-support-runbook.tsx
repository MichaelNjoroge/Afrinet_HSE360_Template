import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertTriangle,
  ArrowLeft,
  KeyRound,
  Mail,
  ShieldCheck,
  UserCog,
  LifeBuoy,
  Printer,
  BookOpen,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/admin-support-runbook")({
  component: SupportRunbookPage,
});

function SupportRunbookPage() {
  const { data: isAdmin, isLoading } = useQuery({
    queryKey: ["is-admin-runbook"],
    queryFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) return false;
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", u.user.id)
        .eq("role", "admin")
        .maybeSingle();
      return !!data;
    },
  });

  if (isLoading) {
    return <div className="p-8 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-8">
      <div className="flex flex-wrap items-center justify-between gap-3" data-export-hide>
        <Button asChild variant="ghost" size="sm">
          <Link to="/dashboard">
            <ArrowLeft className="size-4" /> Back to dashboard
          </Link>
        </Button>
        <Button variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> Print this page
        </Button>
      </div>

      <Tabs defaultValue="manual">
        <TabsList data-export-hide>
          <TabsTrigger value="manual">
            <BookOpen className="size-4" /> User Manual
          </TabsTrigger>
          <TabsTrigger value="runbook">
            <LifeBuoy className="size-4" /> Admin Runbook
          </TabsTrigger>
        </TabsList>

        <TabsContent value="manual">
          <UserManual />
        </TabsContent>

        <TabsContent value="runbook">
          {isAdmin ? (
            <AdminRunbook />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ShieldCheck className="size-5 text-rose-600" /> Admin only
                </CardTitle>
                <CardDescription>
                  The Admin Runbook contains account-recovery procedures and is restricted to administrators.
                </CardDescription>
              </CardHeader>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function UserManual() {
  return (
    <Card className="report-print-sheet">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BookOpen className="size-5 text-primary" /> Afrinet HSE360 — User Manual
        </CardTitle>
        <CardDescription>
          A simple, step-by-step guide to using your HSE management system. Print this page and keep it near your
          workstation for quick reference.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm leading-relaxed">
        <Section title="1. Getting started">
          <p>
            Welcome to your HSE management system. This manual will walk you through the most important things you
            need to do, in the order you will normally do them. Take your time — each step is short.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              Open the system in your web browser using the link your administrator gave you. You can also save it as
              a bookmark, or install it as an app on your phone from the browser menu.
            </li>
            <li>You will see a sign-in page. Use the email and password your administrator sent you.</li>
            <li>If you forget your password, click <strong>Forgot password</strong> on the sign-in page.</li>
          </ul>
        </Section>

        <Section title="2. Setting up your company branding (do this first)">
          <p>
            All your reports — PDFs, printed copies and emailed reports — will carry your company letterhead. Set this
            up once and the system will apply it everywhere automatically.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>From the dashboard, open <strong>Settings &gt; Company branding</strong>.</li>
            <li>Type your <strong>company name</strong> exactly as it should appear on documents.</li>
            <li>
              Click <strong>Upload letterhead</strong> and choose a PNG, JPG or PDF file (maximum 5 MB). For best
              results, use a letterhead designed for A4 paper.
            </li>
            <li>
              Add an optional footer line (for example "Confidential — for internal use only"). This will appear at
              the bottom of every printed report.
            </li>
            <li>Set your <strong>timezone</strong> (for example <em>Africa/Nairobi</em>), then click <strong>Save branding</strong>.</li>
          </ol>
          <p className="text-muted-foreground">
            Tip: If your letterhead does not display, replace the file with a smaller, clean PNG that has a transparent
            background.
          </p>
        </Section>

        <Section title="3. Creating user accounts for your team">
          <p>Only administrators can invite new users. Each user has an <em>authorization level</em> from 1 to 5:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Level 1 – Viewer:</strong> Can read records assigned to them.</li>
            <li><strong>Level 2 – Contributor:</strong> Can submit incidents, hazards and observations.</li>
            <li><strong>Level 3 – Coordinator:</strong> Can manage records and send reports by email.</li>
            <li><strong>Level 4 – Manager:</strong> Can approve records and manage modules.</li>
            <li><strong>Level 5 – Administrator:</strong> Full access, including settings, users and audit logs.</li>
          </ul>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open <strong>Settings &gt; Users &amp; permissions</strong>.</li>
            <li>Click <strong>Invite user</strong>, enter their work email and pick a level.</li>
            <li>The system sends them an email. They click the link and set their own password.</li>
            <li>To change a level later, open the user's row and choose a new level from the dropdown.</li>
          </ol>
        </Section>

        <Section title="4. Adding employees">
          <p>
            Employees are people whose training, PPE and HSE activity you want to track. They do <em>not</em> need a
            user account.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open <strong>Employees</strong> from the dashboard.</li>
            <li>Click <strong>Add employee</strong> and fill in name, employee number, department and site.</li>
            <li>To add many at once, click <strong>Bulk import</strong>, download the template, fill it in Excel and upload it back.</li>
          </ol>
        </Section>

        <Section title="5. Reporting incidents, hazards and near-misses">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open the relevant module from the dashboard (<strong>Incidents</strong>, <strong>Hazards</strong> or <strong>Near misses</strong>).</li>
            <li>Click <strong>New record</strong>.</li>
            <li>Fill in date, location, description and the people involved.</li>
            <li>Use <strong>Add photo</strong> or <strong>Add evidence</strong> to upload pictures or PDFs taken on site.</li>
            <li>Save. The record is timestamped and added to the register.</li>
          </ol>
        </Section>

        <Section title="6. Risk assessments and action tracking">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open <strong>Risk register</strong> and click <strong>New assessment</strong>.</li>
            <li>Describe the activity and hazard, then set <strong>likelihood</strong> and <strong>severity</strong> (1–5). The score and colour band are calculated for you.</li>
            <li>Add controls in <strong>Existing controls</strong>, then re-rate to get the <strong>residual risk</strong>.</li>
            <li>For anything still high, create an <strong>action</strong> with an owner and due date.</li>
            <li>Actions show on the dashboard until they are marked complete with supporting evidence.</li>
          </ol>
        </Section>

        <Section title="7. Training &amp; competency">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open <strong>Training management</strong>.</li>
            <li>Click <strong>New training record</strong>, pick an employee, the course, completed date and expiry date.</li>
            <li>Attach the certificate using <strong>Photos</strong>.</li>
            <li>
              The coloured cards at the top (<strong>Expired</strong>, <strong>Due in 30/60/90 days</strong>) show how
              many people need refresher training. <em>Click any card to see exactly who is affected.</em>
            </li>
          </ol>
        </Section>

        <Section title="8. Inspections, audits and permits">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open <strong>Inspections</strong> (or Audits / Permits to Work).</li>
            <li>Click <strong>New</strong>, choose the template/checklist, then walk through each item.</li>
            <li>Mark items <strong>Pass / Fail / N/A</strong> and add photos for any failed item.</li>
            <li>Submit. Failed items automatically become actions for follow-up.</li>
          </ol>
        </Section>

        <Section title="9. Printing, exporting and emailing reports">
          <p>Every report-style screen in the system has the same three buttons in the top-right corner:</p>
          <ul className="list-disc space-y-1 pl-5">
            <li><strong>Export PDF</strong> — generates a PDF on your company letterhead.</li>
            <li><strong>Print</strong> — opens the same branded PDF in a new tab and triggers your printer.</li>
            <li><strong>Send by email</strong> — emails a secure download link (link expires in 7 days).</li>
          </ul>
          <p className="text-muted-foreground">
            "Send by email" is available to Level 3 users and above. If you do not see the button, ask your
            administrator to raise your level.
          </p>
        </Section>

        <Section title="10. Scheduling recurring reports to your inbox">
          <ol className="list-decimal space-y-1 pl-5">
            <li>Open <strong>Reporting Centre</strong>.</li>
            <li>Under <strong>Scheduled reports</strong>, pick the module, type the recipient emails (commas to separate), and set <strong>daily</strong>, <strong>weekly</strong> or <strong>monthly</strong>.</li>
            <li>Click <strong>Add subscription</strong>. The system will only create one schedule per module / cadence / recipient list — exact duplicates are blocked automatically.</li>
            <li>To stop receiving a report, open the row and click <strong>Pause</strong> or <strong>Delete</strong>.</li>
          </ol>
        </Section>

        <Section title="11. Notifications">
          <p>
            The bell icon at the top of the dashboard shows new assignments and overdue items. Click any notification
            to jump straight to the record. Notifications mark themselves as read when you open them.
          </p>
        </Section>

        <Section title="12. Storage &amp; clean-up">
          <ul className="list-disc space-y-1 pl-5">
            <li>The system shows how much storage you have used in <strong>System monitoring &gt; Storage</strong>.</li>
            <li>Old files older than 180 days are flagged for review.</li>
            <li>Use the recommendations on that page to keep your storage healthy without losing important evidence.</li>
          </ul>
        </Section>

        <Section title="13. Resetting your password">
          <ol className="list-decimal space-y-1 pl-5">
            <li>On the sign-in page, click <strong>Forgot password</strong>.</li>
            <li>Enter your email. A reset link will arrive in your inbox (check the spam folder if you don't see it).</li>
            <li>Click the link and choose a new password — minimum 12 characters, mix letters, numbers and a symbol.</li>
          </ol>
        </Section>

        <Section title="14. Getting help">
          <ul className="list-disc space-y-1 pl-5">
            <li>Most pages have a small <strong>?</strong> help icon — click it for a quick tip.</li>
            <li>For anything else, contact your in-house administrator first. They can solve most issues directly.</li>
            <li>If they cannot, they will escalate to Afrinet support on your behalf.</li>
          </ul>
        </Section>

        <p className="border-t pt-3 text-xs text-muted-foreground">
          Afrinet HSE360™ User Manual · Keep this document near your workstation. Reprint after any major system
          update.
        </p>
      </CardContent>
    </Card>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className="text-base font-semibold">{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

function AdminRunbook() {
  return (
    <Card className="report-print-sheet">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <LifeBuoy className="size-5 text-primary" /> Admin support runbook
        </CardTitle>
        <CardDescription>
          Use this when a client calls about a lost or compromised admin login. Follow the cleanest option that
          applies — never skip straight to last-resort steps.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6 text-sm">
        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Badge className="bg-emerald-600 hover:bg-emerald-600">Option 1</Badge>
            <KeyRound className="size-4" /> Self-service password reset (preferred)
          </h3>
          <p className="text-muted-foreground">
            When the admin still has access to their work email. Cleanest audit trail.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>Ask the admin to go to the sign-in page and click <strong>Forgot password</strong>.</li>
            <li>They enter the email address linked to their admin account.</li>
            <li>A password-reset link arrives in their inbox (also check spam).</li>
            <li>They follow the link and set a new password.</li>
          </ol>
        </section>

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Badge className="bg-sky-600 hover:bg-sky-600">Option 2</Badge>
            <UserCog className="size-4" /> Another admin triggers the reset
          </h3>
          <p className="text-muted-foreground">
            Use when the affected admin cannot trigger the reset themselves but at least one other admin can sign in.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>A working admin opens <strong>Employees</strong> from the dashboard.</li>
            <li>Locates the affected user and opens their profile actions.</li>
            <li>Clicks <strong>Reset password</strong>; the system emails a branded reset link to that user.</li>
            <li>The user completes the reset from their inbox.</li>
          </ol>
          <p className="text-xs text-muted-foreground">
            Requires at least one other working admin account — this is why we recommend keeping a second admin at all times.
          </p>
        </section>

        <section className="space-y-2">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <Badge className="bg-amber-600 hover:bg-amber-600">Option 3</Badge>
            <Mail className="size-4" /> Email-account recovery (sole admin, no inbox access)
          </h3>
          <p className="text-muted-foreground">
            The client is the only admin AND has lost both the password and access to the admin mailbox.
          </p>
          <ol className="list-decimal space-y-1 pl-5">
            <li>
              Recover the mailbox first via the email provider's admin recovery flow (Google Workspace, Microsoft 365,
              or the corporate IT admin).
            </li>
            <li>Once mailbox access is restored, use <strong>Option 1</strong>.</li>
            <li>
              If the mailbox cannot be recovered, change the admin's email address from the platform Users panel to a
              verified mailbox they control, then have them use <strong>Option 1</strong> against the new address.
            </li>
            <li>
              As an alternative, ask a trusted colleague at the client to register an account; you can then promote
              them to admin and they can run <strong>Option 2</strong> for the original admin.
            </li>
          </ol>
        </section>

        <section className="space-y-2 rounded-md border border-rose-300 bg-rose-50 p-4 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
          <h3 className="flex items-center gap-2 text-base font-semibold">
            <AlertTriangle className="size-4" /> What you must NEVER do
          </h3>
          <ul className="list-disc space-y-1 pl-5">
            <li>Never set or share a password on the client's behalf.</li>
            <li>Never store or log admin credentials anywhere.</li>
            <li>Never disable row-level security or run SQL updates against the auth tables.</li>
            <li>Never approve a "reset" request without identity verification through an out-of-band channel.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold">Identity verification before any reset</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Call the client on a number recorded in your contract, not a number provided in the same email.</li>
            <li>Confirm at least two of: company name, account email, last project they worked on, billing contact.</li>
            <li>Log the request (who called, when, what was done) for the audit trail.</li>
          </ul>
        </section>

        <section className="space-y-2">
          <h3 className="text-base font-semibold">Recommended go-live hardening</h3>
          <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
            <li>Provision at least <strong>two admins</strong> at every client — eliminates "sole admin locked out".</li>
            <li>Maintain a <strong>break-glass admin</strong> tied to a shared client mailbox (e.g. <code>it-admin@client.com</code>).</li>
            <li>Enable email 2FA on every admin mailbox.</li>
            <li>Review the admin list quarterly and revoke leavers immediately.</li>
          </ul>
        </section>

        <p className="border-t pt-3 text-xs text-muted-foreground">
          Last reviewed by: ____________________ &nbsp; Date: ____________
        </p>
      </CardContent>
    </Card>
  );
}
