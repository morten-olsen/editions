import { Outlet, createFileRoute } from '@tanstack/react-router';

const IssuesLayout = (): React.ReactNode => {
  return <Outlet />;
};

const Route = createFileRoute('/editions/$configId/issues')({
  component: IssuesLayout,
});

export { Route };
