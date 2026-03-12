import { Outlet, createFileRoute } from '@tanstack/react-router';

const Route = createFileRoute('/sources/$sourceId')({
  component: () => <Outlet />,
});

export { Route };
