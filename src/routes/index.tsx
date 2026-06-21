import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Prosel HSE System" },
      {
        name: "description",
        content: "Prosel Limited health, safety and environment management system.",
      },
      { property: "og:title", content: "Prosel HSE System" },
      {
        property: "og:description",
        content: "Manage incidents, risks, audits, actions, training and competency.",
      },
    ],
  }),
  beforeLoad: () => {
    throw redirect({ to: "/auth" });
  },
  component: () => null,
});
