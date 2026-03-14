import { client } from '../../api/api.ts';

const pollFetchTask = (
  jobId: string,
  headers: Record<string, string> | undefined,
): Promise<string> =>
  new Promise((resolve, reject) => {
    const check = async (): Promise<void> => {
      const { data: job } = await client.GET('/api/jobs/{jobId}', {
        params: { path: { jobId } },
        headers,
      });

      if (!job) {
        reject(new Error('Lost track of job'));
        return;
      }

      if (job.status === 'completed') {
        resolve('Fetch completed');
      } else if (job.status === 'failed') {
        reject(new Error(job.error ?? 'Fetch failed'));
      } else {
        setTimeout(() => void check(), 500);
      }
    };

    void check();
  });

export { pollFetchTask };
