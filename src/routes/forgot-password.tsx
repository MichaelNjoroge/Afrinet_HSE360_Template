import { createFileRoute, Link } from "@tanstack/react-router";
import { FormEvent, useState } from "react";
import { ArrowLeft, KeyRound } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Reset password | Prosel HSE System" },
      { name: "robots", content: "noindex, nofollow, noarchive" },
    ],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setMessage("");
    const email = String(new FormData(event.currentTarget).get("email") ?? "")
      .trim()
      .toLowerCase();
    if (!email) {
      setMessage("Please enter your work email address.");
      setLoading(false);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setLoading(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="grid min-h-screen place-items-center bg-auth-shell p-4">
      <div className="w-full max-w-md rounded-xl border border-border bg-background p-8 shadow-xl">
        <div className="mb-6 grid size-12 place-items-center rounded-lg bg-primary text-primary-foreground">
          <KeyRound />
        </div>
        <h1 className="text-2xl font-bold">Forgot your password?</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Enter your work email and we'll send you a secure link to set a new password.
        </p>
        {sent ? (
          <p className="mt-6 rounded-md bg-muted p-4 text-sm">
            If an account exists for that email, a password reset link is on its way. Check your
            inbox and spam folder.
          </p>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                maxLength={255}
                required
              />
            </div>
            {message && (
              <p role="alert" className="rounded-md bg-muted p-3 text-sm">
                {message}
              </p>
            )}
            <Button type="submit" className="w-full" size="lg" disabled={loading}>
              {loading ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}
        <div className="mt-6">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            <ArrowLeft className="size-4" /> Back to sign in
          </Link>
        </div>
      </div>
    </main>
  );
}
