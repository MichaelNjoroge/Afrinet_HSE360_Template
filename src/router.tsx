import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

function RouterError({ error }: { error: Error }) {
  return (
    <main className="grid min-h-screen place-items-center bg-background p-6">
      <div className="max-w-md text-center">
        <h1 className="text-2xl font-bold">This page didn't load</h1>
        <p className="mt-2 text-muted-foreground">{error.message}</p>
        <a
          className="mt-6 inline-flex rounded-md bg-primary px-4 py-2 text-primary-foreground"
          href="/"
        >
          Go home
        </a>
      </div>
    </main>
  );
}

export const getRouter = () => {
  const queryClient = new QueryClient();

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
    defaultErrorComponent: RouterError,
  });

  return router;
};
