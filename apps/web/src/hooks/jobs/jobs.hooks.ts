import { useCallback, useEffect, useRef, useState } from 'react';

type JobAffects = {
  sourceIds: string[];
  focusIds: string[];
};

type JobProgress = {
  phase: string;
  completed: number;
  total: number;
} | null;

type JobItem = {
  id: string;
  type: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  affects: JobAffects;
  progress: JobProgress;
  error: string | null;
  createdAt: number;
  startedAt: number | null;
  completedAt: number | null;
};

type JobGroup = {
  type: string;
  completed: number;
  failed: number;
  jobs: JobItem[];
};

type JobCounts = {
  pending: number;
  running: number;
  completed: number;
  failed: number;
};

type UseJobsFilter = {
  active?: boolean;
  sourceId?: string;
  focusId?: string;
};

type UseJobsResult = {
  jobs: JobItem[];
  loading: boolean;
  hasActive: boolean;
  activeJobs: JobItem[];
  finishedGroups: JobGroup[];
  expandedGroups: Set<string>;
  toggleGroup: (type: string) => void;
  counts: JobCounts;
};

const POLL_INTERVAL_MS = 3000;

const JOB_TYPE_LABELS: Record<string, string> = {
  refresh_source: 'Fetch feed',
  reconcile_focus: 'Classify articles',
  reanalyse_source: 'Reanalyse source',
  reanalyse_all: 'Reanalyse all',
  extract_and_analyse: 'Extract & analyse',
};

const formatJobType = (type: string): string =>
  JOB_TYPE_LABELS[type] ?? type.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

const formatTimeAgo = (ms: number): string => {
  const diffSec = Math.floor((Date.now() - ms) / 1000);
  if (diffSec < 5) {
    return 'just now';
  }
  if (diffSec < 60) {
    return `${diffSec}s ago`;
  }
  if (diffSec < 3600) {
    return `${Math.floor(diffSec / 60)}m ago`;
  }
  if (diffSec < 86400) {
    return `${Math.floor(diffSec / 3600)}h ago`;
  }
  return new Date(ms).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
};

const formatDuration = (start: number, end: number): string => {
  const sec = Math.round((end - start) / 1000);
  if (sec < 1) {
    return '<1s';
  }
  if (sec < 60) {
    return `${sec}s`;
  }
  return `${Math.floor(sec / 60)}m ${sec % 60}s`;
};

const groupFinishedJobs = (jobs: JobItem[]): JobGroup[] => {
  const map = new Map<string, JobGroup>();
  for (const job of jobs) {
    let group = map.get(job.type);
    if (!group) {
      group = { type: job.type, completed: 0, failed: 0, jobs: [] };
      map.set(job.type, group);
    }
    if (job.status === 'completed') {
      group.completed++;
    } else {
      group.failed++;
    }
    group.jobs.push(job);
  }
  return Array.from(map.values());
};

const useJobs = (token: string, filter?: UseJobsFilter): UseJobsResult => {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback(async (): Promise<void> => {
    const query: Record<string, string> = {};
    if (filter?.active !== undefined) {
      query.active = String(filter.active);
    }
    if (filter?.sourceId) {
      query.sourceId = filter.sourceId;
    }
    if (filter?.focusId) {
      query.focusId = filter.focusId;
    }

    const qs = new URLSearchParams(query).toString();
    const res = await fetch(`/api/jobs${qs ? `?${qs}` : ''}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) {
      const body = (await res.json()) as { jobs: JobItem[] };
      setJobs(body.jobs);
    }
    setLoading(false);
  }, [token, filter?.active, filter?.sourceId, filter?.focusId]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const hasActive = jobs.some((j) => j.status === 'pending' || j.status === 'running');

  useEffect(() => {
    if (hasActive) {
      intervalRef.current = setInterval(() => void loadJobs(), POLL_INTERVAL_MS);
    }
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [hasActive, loadJobs]);

  const activeJobs = jobs.filter((j) => j.status === 'pending' || j.status === 'running');
  const finishedJobs = jobs.filter((j) => j.status === 'completed' || j.status === 'failed');
  const finishedGroups = groupFinishedJobs(finishedJobs);

  const toggleGroup = useCallback((type: string): void => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(type)) {
        next.delete(type);
      } else {
        next.add(type);
      }
      return next;
    });
  }, []);

  const counts: JobCounts = {
    pending: activeJobs.filter((j) => j.status === 'pending').length,
    running: activeJobs.filter((j) => j.status === 'running').length,
    completed: finishedJobs.filter((j) => j.status === 'completed').length,
    failed: finishedJobs.filter((j) => j.status === 'failed').length,
  };

  return {
    jobs,
    loading,
    hasActive,
    activeJobs,
    finishedGroups,
    expandedGroups,
    toggleGroup,
    counts,
  };
};

export type { JobItem, JobAffects, JobProgress, JobGroup, JobCounts, UseJobsFilter, UseJobsResult };
export { POLL_INTERVAL_MS, JOB_TYPE_LABELS, formatJobType, formatTimeAgo, formatDuration, groupFinishedJobs, useJobs };
