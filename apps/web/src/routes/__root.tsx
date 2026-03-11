import { Outlet, createRootRouteWithContext, Navigate, useRouterState } from "@tanstack/react-router";

import { useAuth } from "../auth/auth.tsx";
import { PageTransition } from "../components/animate.tsx";
import { AppShell } from "../components/app-shell.tsx";
import { Nav } from "../components/nav.tsx";
import { AiProvider, AiChatDrawer, AiCursor, useAi } from "../ai/ai.ts";

type RouterContext = {
  auth: ReturnType<typeof useAuth>;
};

const AiOverlay = (): React.ReactNode => {
  const { cursorVisible, cursorTargetId, isEnabled } = useAi();
  if (!isEnabled) return null;
  return (
    <>
      <AiChatDrawer />
      <AiCursor visible={cursorVisible} targetId={cursorTargetId} />
    </>
  );
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
    return (
      <PageTransition locationKey={routerState.location.pathname}>
        <Outlet />
      </PageTransition>
    );
  }

  return (
    <AiProvider>
      <AppShell nav={<Nav />}>
        <PageTransition locationKey={routerState.location.pathname}>
          <Outlet />
        </PageTransition>
        <AiOverlay />
      </AppShell>
    </AiProvider>
  );
};

const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

export { Route };
