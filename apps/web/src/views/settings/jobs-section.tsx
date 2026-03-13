import { useJobs, formatJobType, formatTimeAgo, formatDuration } from '../../hooks/jobs/jobs.hooks.ts';
import { EmptyState } from '../../components/empty-state.tsx';

const JobsSection = ({ token }: { token: string }): React.ReactNode => {
  const { loading, jobs, hasActive, activeJobs, finishedGroups, expandedGroups, toggleGroup, counts } = useJobs(token);

  if (loading) {
    return <div className="text-sm text-ink-tertiary py-6 text-center">Loading...</div>;
  }

  if (jobs.length === 0) {
    return (
      <EmptyState
        title="No jobs"
        description="Background jobs like source fetching and article analysis will appear here."
      />
    );
  }

  const finishedJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'failed');

  return (
    <div className="flex flex-col gap-5">
      {/* Summary bar */}
      <div className="flex items-center gap-4 text-xs">
        {counts.running > 0 && (
          <span className="flex items-center gap-1.5 text-accent">
            <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />
            {counts.running} running
          </span>
        )}
        {counts.pending > 0 && <span className="text-ink-tertiary">{counts.pending} queued</span>}
        {counts.completed > 0 && <span className="text-positive">{counts.completed} completed</span>}
        {counts.failed > 0 && <span className="text-critical">{counts.failed} failed</span>}
        {!hasActive && finishedJobs.length > 0 && (
          <span className="text-ink-faint ml-auto">
            last activity {formatTimeAgo(finishedJobs[0]?.completedAt ?? finishedJobs[0]?.createdAt ?? 0)}
          </span>
        )}
      </div>

      {/* Active jobs */}
      {activeJobs.length > 0 && (
        <div className="rounded-lg border border-border overflow-hidden">
          {activeJobs.map((job, idx) => (
            <div key={job.id} className={idx > 0 ? 'border-t border-border' : ''}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <span
                  className={`shrink-0 w-1.5 h-1.5 rounded-full ${job.status === 'running' ? 'bg-accent animate-pulse' : 'bg-ink-faint'}`}
                />
                <span className="text-sm text-ink flex-1">{formatJobType(job.type)}</span>
                {job.progress && <span className="text-xs text-ink-faint">{job.progress.phase}</span>}
                <span className="text-xs text-ink-tertiary">
                  {job.startedAt ? formatTimeAgo(job.startedAt) : 'queued'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Finished jobs grouped */}
      {finishedGroups.length > 0 && (
        <FinishedJobGroups finishedGroups={finishedGroups} expandedGroups={expandedGroups} toggleGroup={toggleGroup} />
      )}
    </div>
  );
};

/* ---- Finished job groups sub-component ---- */

type FinishedGroup = {
  type: string;
  completed: number;
  failed: number;
  jobs: { id: string; status: string; completedAt: number | null; startedAt: number | null; error: string | null }[];
};

const FinishedJobGroups = ({
  finishedGroups,
  expandedGroups,
  toggleGroup,
}: {
  finishedGroups: FinishedGroup[];
  expandedGroups: Set<string>;
  toggleGroup: (type: string) => void;
}): React.ReactNode => (
  <div className="rounded-lg border border-border overflow-hidden">
    {finishedGroups.map((group, idx) => {
      const isExpanded = expandedGroups.has(group.type);
      const failedInGroup = group.jobs.filter((j) => j.status === 'failed');

      return (
        <div key={group.type} className={idx > 0 ? 'border-t border-border' : ''}>
          <button
            type="button"
            onClick={() => toggleGroup(group.type)}
            className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-surface-hover transition-colors duration-fast cursor-pointer"
          >
            <span className="shrink-0 text-xs text-ink-faint">{isExpanded ? '\u25be' : '\u25b8'}</span>
            <span className="text-sm text-ink flex-1">{formatJobType(group.type)}</span>
            <span className="flex items-center gap-2.5 text-xs">
              {group.completed > 0 && <span className="text-positive">{group.completed} done</span>}
              {group.failed > 0 && <span className="text-critical">{group.failed} failed</span>}
            </span>
          </button>

          {isExpanded && failedInGroup.length > 0 && (
            <div className="border-t border-border bg-surface-sunken">
              {failedInGroup.map((job) => (
                <div key={job.id} className="px-4 py-2.5 border-b border-border last:border-b-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs text-critical font-medium">Failed</span>
                    <span className="text-xs text-ink-faint">
                      {job.completedAt ? formatTimeAgo(job.completedAt) : ''}
                      {job.startedAt && job.completedAt && ` \u00b7 ${formatDuration(job.startedAt, job.completedAt)}`}
                    </span>
                  </div>
                  {job.error && (
                    <pre className="text-xs text-critical/80 font-mono whitespace-pre-wrap break-words leading-relaxed line-clamp-4">
                      {job.error}
                    </pre>
                  )}
                </div>
              ))}
            </div>
          )}

          {isExpanded && failedInGroup.length === 0 && (
            <div className="border-t border-border bg-surface-sunken px-4 py-3">
              <span className="text-xs text-ink-tertiary">All {group.completed} jobs completed successfully</span>
            </div>
          )}
        </div>
      );
    })}
  </div>
);

export { JobsSection };
