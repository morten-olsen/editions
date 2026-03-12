import { Outlet, createFileRoute } from '@tanstack/react-router';

const EditionConfigLayout = (): React.ReactNode => {
  return <Outlet />;
};

const Route = createFileRoute('/editions/$configId')({
  component: EditionConfigLayout,
});

export { Route };
