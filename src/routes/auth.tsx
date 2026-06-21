import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { ShieldCheck, HardHat, ArrowRight, LockKeyhole, Network, Scale } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Sign in | Prosel HSE System" },
      { name: "description", content: "Secure sign in to Prosel Limited's HSE management system." },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const data = new FormData(event.currentTarget);
    const email = String(data.get("email") ?? "").trim();
    const password = String(data.get("password") ?? "");
    if (!email || password.length < 8) {
      setMessage("Please complete all fields. Password must be at least 8 characters.");
      setLoading(false);
      return;
    }
    const result = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (result.error) {
      setMessage(result.error.message);
      return;
    }
    await navigate({ to: "/dashboard" });
  }

  return (
    <main className="min-h-screen bg-auth-shell p-3 sm:p-6">
      <div className="mx-auto grid min-h-[calc(100vh-3rem)] max-w-7xl overflow-hidden rounded-xl border border-border bg-background shadow-2xl lg:grid-cols-[1.12fr_.88fr]">
        <section className="relative hidden flex-col justify-between overflow-hidden bg-auth-hero px-14 py-12 text-auth-hero-foreground lg:flex">
          <div className="absolute -bottom-40 -right-40 size-[34rem] rounded-full border border-auth-hero-foreground/20" />
          <div className="absolute -bottom-20 -right-20 size-[22rem] rounded-full border border-auth-hero-foreground/25" />
          <div className="relative z-10 flex items-center gap-3">
            <span className="grid size-12 place-items-center rounded-md bg-safety text-safety-foreground">
              <HardHat />
            </span>
            <div>
              <p className="font-display text-xl font-bold">Afrinet HSE360™</p>
              <p className="text-xs tracking-[.22em] text-auth-hero-foreground/75">
                PROSEL LIMITED · THIKA, KENYA
              </p>
            </div>
          </div>
          <div className="relative z-10 max-w-xl">
            <div className="mb-7 h-1 w-20 bg-safety" />
            <p className="mb-4 text-xs font-bold uppercase tracking-[.24em] text-safety">
              Enterprise HSE governance
            </p>
            <h1 className="text-5xl font-bold leading-[1.08] xl:text-6xl">
              Operational control. Clear accountability.
            </h1>
            <p className="mt-6 max-w-lg text-base leading-7 text-auth-hero-foreground/85">
              A secure, audit-ready command system for Prosel Limited—connecting risks, compliance,
              people and approvals across every HSE process.
            </p>
          </div>
          <div className="relative z-10 space-y-4">
            <div className="grid grid-cols-3 divide-x divide-auth-hero-foreground/25 border-y border-auth-hero-foreground/25 py-5 text-sm">
              {[
                { label: "ISO aligned", icon: Scale },
                { label: "Role secured", icon: LockKeyhole },
                { label: "Multi-site ready", icon: Network },
              ].map((item) => (
                <div key={item.label} className="flex items-center gap-3 px-4 first:pl-0">
                  <item.icon className="size-4 text-safety" />
                  <span>{item.label}</span>
                </div>
              ))}
            </div>
            <div
              className="flex items-start gap-3 rounded-md border border-safety/40 bg-safety/10 px-4 py-3 text-xs leading-5 text-auth-hero-foreground/90"
              role="note"
              aria-label="ISO compliance statement"
            >
              <Scale className="mt-0.5 size-4 shrink-0 text-safety" />
              <p>
                <span className="font-bold uppercase tracking-[.18em] text-safety">
                  ISO 9001 · ISO 45001 · ISO 14001 compliant
                </span>
                <br />
                Designed and structured to support an integrated management system aligned with
                the Quality, Occupational Health &amp; Safety, and Environmental international
                standards.
              </p>
            </div>
          </div>

        </section>
        <section className="flex items-center justify-center p-6 sm:p-12">
          <div className="w-full max-w-md">
            <div className="mb-8 lg:hidden">
              <p className="font-display text-xl font-bold text-primary">PROSEL LIMITED</p>
              <p className="text-xs tracking-[.2em] text-muted-foreground">HSE MANAGEMENT SYSTEM</p>
            </div>
            <div className="mb-8">
              <div className="mb-5 grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck />
              </div>
              <h2 className="text-3xl font-bold">Welcome back</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Sign in to continue to the control centre.
              </p>
            </div>
            <form onSubmit={submit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Work email</Label>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  maxLength={255}
                  autoComplete="email"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
                <PasswordInput
                  id="password"
                  name="password"
                  minLength={8}
                  maxLength={72}
                  autoComplete="current-password"
                  required
                />
              </div>
              {message && (
                <p role="alert" className="rounded-md bg-muted p-3 text-sm text-foreground">
                  {message}
                </p>
              )}
              <Button type="submit" className="w-full" size="lg" disabled={loading}>
                {loading ? "Please wait…" : "Sign in"}
                <ArrowRight />
              </Button>
            </form>
            <div className="mt-4 text-center">
              <Link
                to="/forgot-password"
                className="text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                Forgot your password?
              </Link>
            </div>
            <p className="mt-7 text-center text-sm text-muted-foreground">
              Need access? Ask your administrator for an employee invitation.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
