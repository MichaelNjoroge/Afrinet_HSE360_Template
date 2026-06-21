import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/trust")({
  head: () => ({
    meta: [
      { title: "Trust & Security | Prosel HSE System" },
      {
        name: "description",
        content:
          "How Prosel HSE System protects customer data: encryption, access control, hosting, backups, and contact information for security and privacy.",
      },
      { property: "og:title", content: "Trust & Security | Prosel HSE System" },
      {
        property: "og:description",
        content:
          "Security, privacy and data handling practices for the Prosel HSE System.",
      },
      { name: "robots", content: "index, follow" },
    ],
  }),
  component: TrustPage,
});

function TrustPage() {
  return (
    <main className="mx-auto max-w-3xl px-6 py-12 text-slate-800">
      <nav className="mb-8 text-sm">
        <Link to="/" className="text-orange-600 hover:underline">
          ← Back to app
        </Link>
      </nav>

      <h1 className="text-3xl font-semibold tracking-tight">Trust &amp; Security</h1>
      <p className="mt-3 text-slate-600">
        The Prosel HSE System stores operational health, safety and environment
        records on behalf of Prosel Limited and its authorised contractors. This
        page summarises how that data is protected.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Hosting &amp; encryption</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
          <li>Hosted on managed cloud infrastructure in secure data centres.</li>
          <li>All traffic is served over HTTPS (TLS 1.2+).</li>
          <li>Data at rest is encrypted using industry-standard AES-256.</li>
          <li>Daily automated backups with point-in-time recovery.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Access control</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
          <li>Authentication via email/password and supported single sign-on providers.</li>
          <li>Role-based access enforced at the database layer with row-level security.</li>
          <li>Module-level permissions restrict who can view, create or close records.</li>
          <li>Administrative actions and approvals are logged in an immutable audit trail.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Data handling</h2>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-slate-700">
          <li>Personal data is collected only to operate the HSE management system.</li>
          <li>Records are retained according to Prosel Limited&apos;s HSE record-retention policy.</li>
          <li>Customer data is never sold or used to train third-party AI models.</li>
          <li>Users may request export or deletion of their personal data.</li>
        </ul>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Reporting a vulnerability</h2>
        <p className="mt-3 text-slate-700">
          If you believe you have discovered a security vulnerability, please
          contact the Prosel HSE administrator at{" "}
          <a
            href="mailto:hse@prosel.co.ke"
            className="text-orange-600 hover:underline"
          >
            hse@prosel.co.ke
          </a>
          . We will acknowledge receipt within two business days and work with
          you on remediation.
        </p>
      </section>

      <section className="mt-8">
        <h2 className="text-xl font-semibold">Contact</h2>
        <p className="mt-3 text-slate-700">
          Prosel Limited · Thika, Kenya ·{" "}
          <a
            href="mailto:hse@prosel.co.ke"
            className="text-orange-600 hover:underline"
          >
            hse@prosel.co.ke
          </a>
        </p>
      </section>

      <p className="mt-12 text-xs text-slate-500">
        Last updated: June 2026
      </p>
    </main>
  );
}
