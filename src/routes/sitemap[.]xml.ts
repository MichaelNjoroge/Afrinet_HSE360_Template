import { createFileRoute } from "@tanstack/react-router";
import type {} from "@tanstack/react-start";

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        return new Response("Not found", {
          status: 404,
          headers: { "X-Robots-Tag": "noindex, nofollow" },
        });
      },
    },
  },
});
