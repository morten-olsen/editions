import { Outlet, createFileRoute } from '@tanstack/react-router';

const EditionLayout = (): React.ReactNode => {
  return <Outlet />;
};

const Route = createFileRoute('/editions/$configId/issues/$editionId')({
  component: EditionLayout,
});

export { Route };
