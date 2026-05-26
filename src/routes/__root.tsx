import { Outlet, createRootRoute } from "@tanstack/react-router";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { useEffect } from "react";

const queryClient = new QueryClient({
  defaultOptions: { queries: { staleTime: 30_000, retry: 1 } },
});

export const Route = createRootRoute({
  component: RootComponent,
  notFoundComponent: NotFound,
});

function RootComponent() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register(import.meta.env.BASE_URL + "sw.js").catch(() => {});
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster theme="dark" position="top-center" richColors />
    </QueryClientProvider>
  );
}

function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="text-center">
        <h1 className="font-display text-6xl text-primary">404</h1>
        <p className="mt-2 text-muted-foreground">Cette page n'existe pas.</p>
        <a href={import.meta.env.BASE_URL} className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground font-semibold">Retour</a>
      </div>
    </div>
  );
}
