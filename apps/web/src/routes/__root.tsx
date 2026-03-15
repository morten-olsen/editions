import { Outlet, createRootRouteWithContext, Navigate, useNavigate, useRouterState } from '@tanstack/react-router';

import { useAuth } from '../auth/auth.tsx';
import { PageTransition } from '../components/animate.tsx';
import { ModeShell, modeForPath, defaultPathForMode, isFullScreenRoute } from '../components/mode-shell.tsx';
import type { Mode } from '../components/mode-shell.tsx';
import { BuilderNav, tabForPath } from '../components/builder-nav.tsx';
import { FeedSidebar, FeedMobileNav } from '../components/feed-nav.tsx';
import { AiProvider, AiChatDrawer, AiCursor, AiToggleButton, useAi } from '../ai/ai.ts';

type RouterContext = {
  auth: ReturnType<typeof useAuth>;
};

const AiOverlay = (): React.ReactNode => {
  const { cursorVisible, cursorTargetId, isEnabled } = useAi();
  if (!isEnabled) {
    return null;
  }
  return (
    <>
      <AiChatDrawer />
      <AiCursor visible={cursorVisible} targetId={cursorTargetId} />
    </>
  );
};

const ModeLayout = ({ activeMode, pathname }: { activeMode: Mode; pathname: string }): React.ReactElement => {
  const content = (
    <PageTransition locationKey={pathname}>
      <Outlet />
    </PageTransition>
  );

  if (activeMode === 'feed') {
    return (
      <div className="relative max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
        <div className="absolute right-full top-6 hidden lg:block mr-4">
          <FeedSidebar />
        </div>
        {content}
      </div>
    );
  }

  if (activeMode === 'builder') {
    return (
      <div className="absolute inset-0 flex flex-col">
        <BuilderNav activeTab={tabForPath(pathname)} />
        <div className="relative flex-1 min-h-0 overflow-y-auto">
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-prose mx-auto px-4 py-6 md:px-8 md:py-8">
      {content}
    </div>
  );
};

const publicRoutes = ['/login'];

const RootComponent = (): React.ReactNode => {
  const auth = useAuth();
  const routerState = useRouterState();
  const navigate = useNavigate();
  const pathname = routerState.location.pathname;
  const isPublicRoute = publicRoutes.includes(pathname);

  if (auth.status === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-surface">
        <div className="font-serif text-lg text-ink-tertiary">Loading...</div>
      </div>
    );
  }

  if (auth.status === 'unauthenticated' && !isPublicRoute) {
    return <Navigate to="/login" />;
  }

  if (isPublicRoute) {
    return (
      <PageTransition locationKey={pathname}>
        <Outlet />
      </PageTransition>
    );
  }

  // Full-screen routes (article reader, magazine) bypass the mode shell
  if (isFullScreenRoute(pathname)) {
    return (
      <AiProvider>
        <PageTransition locationKey={pathname}>
          <Outlet />
        </PageTransition>
        <AiOverlay />
      </AiProvider>
    );
  }

  const isAuthenticated = auth.status === 'authenticated';
  const username = isAuthenticated ? auth.user.username : undefined;
  const logout = isAuthenticated ? auth.logout : undefined;
  const activeMode = modeForPath(pathname);

  return (
    <AiProvider>
      <ModeShell
        activeMode={activeMode}
        onModeChange={(mode) => navigate({ to: defaultPathForMode[mode] })}
        pathname={pathname}
        username={username}
        onLogout={logout}
        onSettingsClick={() => navigate({ to: '/settings' })}
        actions={<AiToggleButton />}
      >
        {activeMode === 'feed' && <FeedMobileNav />}
        <ModeLayout activeMode={activeMode} pathname={pathname} />
        <AiOverlay />
      </ModeShell>
    </AiProvider>
  );
};

const Route = createRootRouteWithContext<RouterContext>()({
  component: RootComponent,
});

export { Route };
