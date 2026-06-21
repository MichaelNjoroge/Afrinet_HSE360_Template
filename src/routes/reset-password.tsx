import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { FormEvent, useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/reset-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Set a new password | Prosel HSE System" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const prepareRecoverySession = async () => {
      const code = new URLSearchParams(window.location.search).get("code");
      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage("This reset link is invalid or has expired. Please request a fresh link.");
          return;
        }
        setReady(true);
        window.history.replaceState({}, document.title, "/reset-password");
        return;
      }

      const { data: s } = await supabase.auth.getSession();
      if (s.session) setReady(true);
    };

    // The auth service fires PASSWORD_RECOVERY when a recovery link is opened.
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") setReady(true);
    });
    void prepareRecoverySession();
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirm = String(form.get("confirm") ?? "");
    if (password.length < 8) {
      setMessage("Password must be at least 8 characters.");
      setLoading(false);
      return;
    }
    if (password !== confirm) {
      setMessage("Passwords do not match.");
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    await supabase.auth.signOut();
    await navigate({ to: "/auth" });
  }

  return (
    <main className="grid min-h-screen place-items-center bg-auth-shell p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-8 shadow-xl">
        <div className="mb-6 grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground">
          <ShieldCheck />
        </div>
        <h1 className="text-2xl font-bold">Set a new password</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Choose a strong password of at least 8 characters. You'll be signed out and asked to sign
          in again.
        </p>
        {!ready ? (
          <p className="mt-6 rounded-md bg-muted p-4 text-sm">
            Validating your reset link… If nothing happens, request a fresh link from the Forgot
            password page.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <PasswordInput
                id="password"
                name="password"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm">Confirm new password</Label>
              <PasswordInput
                id="confirm"
                name="confirm"
                autoComplete="new-password"
                minLength={8}
                maxLength={72}
                required
              />
            </div>
            {message && (
              <p role="alert" className="rounded-md bg-muted p-3 text-sm">
                {message}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Updating…" : "Update password"}
            </Button>
          </form>
        )}
      </div>
    </main>
  );
}
