import { Outlet, createFileRoute } from "@tanstack/react-router";

const Route = createFileRoute("/focuses/$focusId")({
  component: () => <Outlet />,
});

export { Route };
