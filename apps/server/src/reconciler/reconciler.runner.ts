// --- Step abstraction ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReconcileStep<T = any> = {
  name: string;
  fetchBatch: () => AsyncGenerator<T[]>;
  processBatch: (batch: T[]) => Promise<void>;
  // How many items the step still has to do. Optional — when present,
  // progress carries a real total instead of 0. A final completed < total
  // means the step skipped items (e.g. articles with no text).
  countRemaining?: () => Promise<number>;
};

type ReconcileProgress = { phase: string; completed: number; total: number };
type ProgressCallback = (progress: ReconcileProgress) => void;

type StepFailure = {
  step: string;
  durationMs: number;
  message: string;
};

class ReconcileStepsError extends Error {
  failures: StepFailure[];

  constructor(failures: StepFailure[]) {
    super(failures.map((f) => `${f.step}: ${f.message}`).join('; '));
    this.name = 'ReconcileStepsError';
    this.failures = failures;
  }
}

// --- Step runner ---

// Runs each step to exhaustion. A failing step is recorded but does not
// prevent later steps from doing what work they can — the aggregate error
// is thrown at the end so the surrounding job still reports failure.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runReconcileSteps = async (steps: ReconcileStep<any>[], onProgress?: ProgressCallback): Promise<void> => {
  const failures: StepFailure[] = [];

  for (const step of steps) {
    const startedAt = Date.now();

    let total = 0;
    if (step.countRemaining) {
      try {
        total = await step.countRemaining();
      } catch {
        total = 0;
      }
    }

    let completed = 0;
    onProgress?.({ phase: step.name, completed, total });

    try {
      for await (const batch of step.fetchBatch()) {
        await step.processBatch(batch);
        completed += batch.length;
        onProgress?.({ phase: step.name, completed, total: Math.max(total, completed) });
      }
    } catch (err) {
      failures.push({
        step: step.name,
        durationMs: Date.now() - startedAt,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }

  if (failures.length > 0) {
    throw new ReconcileStepsError(failures);
  }
};

// --- Exports ---

export type { ReconcileStep, ReconcileProgress, ProgressCallback, StepFailure };
export { runReconcileSteps, ReconcileStepsError };
