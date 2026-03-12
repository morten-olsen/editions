import { createFileRoute, Link } from '@tanstack/react-router';

import { useFocusesList } from '../hooks/focuses/focuses.hooks.ts';
import { PageHeader } from '../components/page-header.tsx';
import { Button } from '../components/button.tsx';
import { EmptyState } from '../components/empty-state.tsx';

const FocusesPage = (): React.ReactNode => {
  const { focuses, isLoading, headers } = useFocusesList();

  if (!headers) {
    return null;
  }

  return (
    <>
      <PageHeader
        title="Focuses"
        subtitle="Your topic areas — dive into what matters"
        serif
        actions={
          <Link to="/focuses/new">
            <Button variant="primary" size="sm">
              New focus
            </Button>
          </Link>
        }
      />

      {!isLoading && focuses.length === 0 ? (
        <EmptyState
          title="No focuses yet"
          description="Focuses are topic areas that organize your articles. Create one to start filtering your feed by interest."
          action={
            <Link to="/focuses/new">
              <Button variant="primary">Create your first focus</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-3">
          {focuses.map((focus) => (
            <Link
              key={focus.id}
              to="/focuses/$focusId"
              params={{ focusId: focus.id }}
              className="flex items-center justify-between py-4 border-b border-border last:border-b-0 group"
            >
              <div className="min-w-0 flex-1">
                <div className="font-serif text-lg font-medium tracking-tight text-ink group-hover:text-accent transition-colors duration-fast">
                  {focus.name}
                </div>
                {focus.description && (
                  <div className="text-sm text-ink-secondary mt-0.5 truncate">{focus.description}</div>
                )}
                <div className="text-xs text-ink-tertiary mt-1">
                  {focus.sources.length === 0
                    ? 'No sources'
                    : `${focus.sources.length} source${focus.sources.length === 1 ? '' : 's'}`}
                </div>
              </div>
              <span className="text-xs text-ink-faint group-hover:text-ink-tertiary transition-colors duration-fast ml-4">
                →
              </span>
            </Link>
          ))}
        </div>
      )}
    </>
  );
};

const Route = createFileRoute('/focuses/')({
  component: FocusesPage,
});

export { Route };
