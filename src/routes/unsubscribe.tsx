import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { MailX } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/unsubscribe")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Email preferences | Prosel HSE" },
      { name: "robots", content: "noindex, nofollow" },
    ],
  }),
  component: UnsubscribePage,
});

function UnsubscribePage() {
  const [state, setState] = useState<"checking" | "ready" | "done" | "error">("checking");
  const token = new URLSearchParams(window.location.search).get("token") ?? "";

  useEffect(() => {
    if (!token) {
      setState("error");
      return;
    }
    fetch(`/email/unsubscribe?token=${encodeURIComponent(token)}`)
      .then((response) => response.json())
      .then((data) => setState(data.valid ? "ready" : "error"))
      .catch(() => setState("error"));
  }, [token]);

  const unsubscribe = async () => {
    const response = await fetch("/email/unsubscribe", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setState(response.ok ? "done" : "error");
  };

  return (
    <main className="grid min-h-screen place-items-center bg-auth-shell p-4">
      <section className="w-full max-w-md rounded-xl border bg-background p-8 text-center shadow-xl">
        <MailX className="mx-auto mb-4 size-10 text-primary" />
        <h1 className="text-2xl font-bold">Email preferences</h1>
        <p className="mt-3 text-sm leading-6 text-muted-foreground">
          {state === "checking" && "Validating your secure request…"}
          {state === "ready" && "Confirm that you no longer want to receive automated HSE reports."}
          {state === "done" && "You have been unsubscribed from automated reports."}
          {state === "error" && "This unsubscribe link is invalid, expired, or already used."}
        </p>
        {state === "ready" && (
          <Button className="mt-6 w-full" onClick={unsubscribe}>
            Confirm unsubscribe
          </Button>
        )}
      </section>
    </main>
  );
}
