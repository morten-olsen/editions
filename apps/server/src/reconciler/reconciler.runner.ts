// --- Step abstraction ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ReconcileStep<T = any> = {
  name: string;
  fetchBatch: () => AsyncGenerator<T[]>;
  processBatch: (batch: T[]) => Promise<void>;
};

type ReconcileProgress = { phase: string; completed: number; total: number };
type ProgressCallback = (progress: ReconcileProgress) => void;

// --- Step runner ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const runReconcileSteps = async (steps: ReconcileStep<any>[], onProgress?: ProgressCallback): Promise<void> => {
  for (const step of steps) {
    let completed = 0;
    for await (const batch of step.fetchBatch()) {
      await step.processBatch(batch);
      completed += batch.length;
      onProgress?.({ phase: step.name, completed, total: 0 });
    }
  }
};

// --- Exports ---

export type { ReconcileStep, ReconcileProgress, ProgressCallback };
export { runReconcileSteps };
