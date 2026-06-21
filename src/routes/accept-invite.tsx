import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { KeyRound, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";
import { useServerFn } from "@tanstack/react-start";
import { activateInvitedEmployee } from "@/lib/account.functions";

export const Route = createFileRoute("/accept-invite")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set your password | Prosel HSE System" },
      {
        name: "description",
        content: "Accept your Prosel HSE employee invitation and securely create your password.",
      },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: AcceptInvitePage,
});

function AcceptInvitePage() {
  const navigate = useNavigate();
  const activateEmployee = useServerFn(activateInvitedEmployee);
  const [checking, setChecking] = useState(true);
  const [validInvite, setValidInvite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;

    const verifyInvite = async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) await supabase.auth.exchangeCodeForSession(code);
      const { data, error } = await supabase.auth.getUser();
      if (!active) return;
      setValidInvite(!error && Boolean(data.user));
      setChecking(false);
    };
    void verifyInvite();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!active || !session?.user) return;
      setValidInvite(true);
      setChecking(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function setPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");

    if (
      password.length < 12 ||
      !/[a-z]/.test(password) ||
      !/[A-Z]/.test(password) ||
      !/\d/.test(password)
    ) {
      setMessage("Use at least 12 characters with upper-case, lower-case, and a number.");
      return;
    }
    if (password !== confirmation) {
      setMessage("The passwords do not match.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await activateEmployee();
    await navigate({ to: "/dashboard", replace: true });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-auth-shell p-4 sm:p-8">
      <section className="w-full max-w-md rounded-xl border border-border bg-background p-6 shadow-2xl sm:p-9">
        <div className="mb-7 flex items-center gap-3">
          <span className="grid size-11 place-items-center rounded-lg bg-primary text-primary-foreground">
            <ShieldCheck />
          </span>
          <div>
            <p className="font-display text-lg font-bold">Afrinet HSE360™</p>
            <p className="text-xs tracking-[.16em] text-muted-foreground">PROSEL LIMITED</p>
          </div>
        </div>

        <KeyRound className="mb-4 size-8 text-primary" />
        <h1 className="text-3xl font-bold">Create your password</h1>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Complete your employee account setup with a secure password you will use to sign in.
        </p>

        {checking ? (
          <p className="mt-7 rounded-md bg-muted p-4 text-sm">Checking your invitation…</p>
        ) : validInvite ? (
          <form onSubmit={setPassword} className="mt-7 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                name="password"
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmation">Confirm new password</Label>
              <PasswordInput
                id="confirmation"
                name="confirmation"
                minLength={12}
                maxLength={72}
                autoComplete="new-password"
                required
              />
            </div>
            {message && (
              <p role="alert" className="rounded-md bg-muted p-3 text-sm">
                {message}
              </p>
            )}
            <Button type="submit" size="lg" className="w-full" disabled={loading}>
              {loading ? "Creating account…" : "Create account and continue"}
            </Button>
          </form>
        ) : (
          <div className="mt-7 space-y-4">
            <p role="alert" className="rounded-md bg-muted p-4 text-sm leading-6">
              This invitation link is invalid or has expired. Ask your administrator to resend the
              invitation.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full"
              onClick={() => navigate({ to: "/auth" })}
            >
              Return to sign in
            </Button>
          </div>
        )}
      </section>
    </main>
  );
}
