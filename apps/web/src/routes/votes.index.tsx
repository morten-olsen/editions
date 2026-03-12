import { createFileRoute, Navigate } from '@tanstack/react-router';

const VotesRedirect = (): React.ReactNode => <Navigate to="/settings" />;

const Route = createFileRoute('/votes/')({
  component: VotesRedirect,
});

export { Route };
