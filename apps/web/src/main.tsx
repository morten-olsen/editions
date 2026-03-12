import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider, createRouter, createHashHistory } from '@tanstack/react-router';

import { AuthProvider, useAuth } from './auth/auth.tsx';
import { routeTree } from './routeTree.gen.ts';
import './app.css';

const queryClient = new QueryClient();

const hashHistory = createHashHistory();

const router = createRouter({
  routeTree,
  history: hashHistory,
  context: { auth: undefined as never },
});

declare module '@tanstack/react-router' {
  // interface required for module augmentation (cannot use type)
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions
  interface Register {
    router: typeof router;
  }
}

const InnerApp = (): React.ReactNode => {
  const auth = useAuth();
  return <RouterProvider router={router} context={{ auth }} />;
};

const root = document.getElementById('root');
if (!root) {
  throw new Error('Root element not found');
}

createRoot(root).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <InnerApp />
      </AuthProvider>
    </QueryClientProvider>
  </StrictMode>,
);
