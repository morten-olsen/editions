import { DatabaseService } from '../database/database.ts';
import { ReconcilerService } from '../reconciler/reconciler.ts';
import type { ProgressCallback, ReconcileOptions, ScopeFilter } from '../reconciler/reconciler.ts';
import { SourcesService } from '../sources/sources.ts';
import type { Services } from '../services/services.ts';

import { JobService } from './jobs.ts';
import type { Job, JobPayloads } from './jobs.ts';

// --- Progress wiring ---

const jobProgress =
  (job: Job): ProgressCallback =>
  (progress) => {
    job.progress = progress;
  };

// Backfill the job's routing hints so the UI can show which sources/focuses
// this analysis run touches
const resolveAffects = async (services: Services, job: Job, scope: ScopeFilter | undefined): Promise<void> => {
  const db = await services.get(DatabaseService).getInstance();

  if (scope?.sourceIds && scope.sourceIds.length > 0) {
    const links = await db
      .selectFrom('focus_sources')
      .select('focus_id')
      .where('source_id', 'in', scope.sourceIds)
      .execute();
    job.affects.focusIds = [...new Set(links.map((l) => l.focus_id))];
  }

  if (scope?.focusIds && scope.focusIds.length > 0) {
    const links = await db
      .selectFrom('focus_sources')
      .select('source_id')
      .where('focus_id', 'in', scope.focusIds)
      .execute();
    job.affects.sourceIds = [...new Set(links.map((l) => l.source_id))];
  }
};

const runAnalysis = async (
  services: Services,
  job: Job,
  options: Omit<ReconcileOptions, 'onProgress'>,
): Promise<void> => {
  await resolveAffects(services, job, options.scopeFilter);
  await services.get(ReconcilerService).reconcile({ ...options, onProgress: jobProgress(job) });
};

// --- Analysis job presets ---

// Every analysis job is the same operation — reconcile a scope after clearing
// some amount of stale state — so the job types are presets, not handlers.
type AnalysisJobType = Exclude<keyof JobPayloads, 'refresh_source'>;

const analysisPresets: {
  [K in AnalysisJobType]: (payload: JobPayloads[K]) => Omit<ReconcileOptions, 'onProgress'>;
} = {
  reconcile_focus: (p) => ({
    scopeFilter: { focusIds: [p.focusId] },
    skipExtract: true,
    ...(p.forceReclassify ? { reset: 'scores' as const } : {}),
  }),
  reanalyse_source: (p) => ({
    scopeFilter: { sourceIds: [p.sourceId] },
    reset: 'scores',
    backfillExtractedAt: true,
  }),
  reanalyse_all: () => ({ reset: 'scores' }),
  re_extract_all: () => ({ reset: 'content' }),
  re_extract_source: (p) => ({ scopeFilter: { sourceIds: [p.sourceId] }, reset: 'content' }),
  extract_and_analyse: (p) => ({ scopeFilter: { sourceIds: [p.sourceId] } }),
};

// --- Ingest ---

const handleRefreshSource = async (
  payload: JobPayloads['refresh_source'],
  services: Services,
  job: Job,
): Promise<void> => {
  await services.get(SourcesService).ingestFeed(payload.userId, payload.sourceId);
  await runAnalysis(services, job, { scopeFilter: { sourceIds: [payload.sourceId] } });
};

// --- Registration ---

const registerJobHandlers = (services: Services): void => {
  const jobService = services.get(JobService);

  jobService.register('refresh_source', handleRefreshSource);
  jobService.register('reconcile_focus', (p, s, j) => runAnalysis(s, j, analysisPresets.reconcile_focus(p)));
  jobService.register('reanalyse_source', (p, s, j) => runAnalysis(s, j, analysisPresets.reanalyse_source(p)));
  jobService.register('reanalyse_all', (p, s, j) => runAnalysis(s, j, analysisPresets.reanalyse_all(p)));
  jobService.register('re_extract_all', (p, s, j) => runAnalysis(s, j, analysisPresets.re_extract_all(p)));
  jobService.register('re_extract_source', (p, s, j) => runAnalysis(s, j, analysisPresets.re_extract_source(p)));
  jobService.register('extract_and_analyse', (p, s, j) => runAnalysis(s, j, analysisPresets.extract_and_analyse(p)));
};

export { registerJobHandlers };
