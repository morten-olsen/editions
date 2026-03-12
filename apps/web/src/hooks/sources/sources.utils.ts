import { client } from '../../api/api.ts';

type TaskResult = { newArticles: number; totalItems: number };
type TaskStatus = { status: string; result: unknown; error: string | null };

const pollFetchTask = (
  sourceId: string,
  taskId: string,
  headers: Record<string, string> | undefined,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const check = async (): Promise<void> => {
      const { data: task } = await client.GET('/api/sources/{id}/tasks/{taskId}', {
        params: { path: { id: sourceId, taskId } },
        headers,
      });

      if (!task) {
        reject(new Error('Lost track of task'));
        return;
      }

      const t = task as TaskStatus;

      if (t.status === 'completed') {
        const result = t.result as TaskResult | null;
        resolve(result ? `Fetched ${result.totalItems} items, ${result.newArticles} new` : 'Fetch completed');
      } else if (t.status === 'failed') {
        reject(new Error(t.error ?? 'Fetch failed'));
      } else {
        setTimeout(() => void check(), 500);
      }
    };

    void check();
  });

export { pollFetchTask };
