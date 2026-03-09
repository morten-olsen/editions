import { Outlet, createRootRouteWithContext, Navigate, useRouterState } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { AppShell } from "../components/app-shell.tsx";
import { Nav } from "../components/nav.tsx";

type RouterContext = {
  auth: ReturnType<typeof useAuth>;
};

const publicRoutes = ["/login"];

const RootComponent = (): React.ReactNode => {
  const auth = useAuth();
  const routerState = useRouterState();
  const isPublicRoute = publicRoutes.includes(routerState.location.pathname);

  if (auth.status === "loading") {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="font-serif text-lg text-ink-tertiary">Loading...</div>
      </div>
    );
  }

  if (auth.status === "unauthenticated" && !isPublicRoute) {
    return <Navigate to="/login" />;
  }

  if (isPublicRoute) {
    return <Outlet />;
  }

  return (
    <AppShell nav={<Nav />}>
      <Outlet />
    </AppShell>
  );
};

const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

export { Route };
