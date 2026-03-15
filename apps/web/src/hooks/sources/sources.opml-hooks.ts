import { useState, useCallback, useRef } from 'react';
import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';

import { useAuthHeaders, queryKeys } from '../../api/api.hooks.ts';
import { client } from '../../api/api.ts';

// -- Types --

type ImportSourceResult = {
  name: string;
  url: string;
  status: 'added' | 'skipped';
};

type ImportResult = {
  added: number;
  skipped: number;
  sources: ImportSourceResult[];
};

type UseOpmlResult = {
  exportOpml: () => void;
  importMutation: UseMutationResult<ImportResult, Error, string, unknown>;
  importResult: ImportResult | null;
  importError: string | null;
  pickAndImport: () => void;
  clearImportResult: () => void;
};

// -- Hook --

const useOpml = (): UseOpmlResult => {
  const headers = useAuthHeaders();
  const queryClient = useQueryClient();
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const exportOpml = useCallback((): void => {
    if (!headers) {
      return;
    }
    void fetch('/api/sources/opml', { headers })
      .then((res) => {
        if (!res.ok) {
          throw new Error('Export failed');
        }
        return res.blob();
      })
      .then((blob) => {
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.download = 'editions-sources.opml';
        link.click();
        URL.revokeObjectURL(blobUrl);
      })
      .catch(() => {
        setImportError('Failed to export feeds. Please try again.');
      });
  }, [headers]);

  const importMutation = useMutation({
    mutationFn: async (opmlText: string): Promise<ImportResult> => {
      const { data, error: err } = await client.POST('/api/sources/opml' as '/api/sources', {
        body: { opml: opmlText } as unknown as { name: string; url: string; type: 'rss'; direction: 'newest' },
        headers,
      });
      if (err) {
        const msg = (err as unknown as { error?: string }).error ?? 'Failed to import OPML';
        throw new Error(msg);
      }
      return data as unknown as ImportResult;
    },
    onSuccess: (result: ImportResult): void => {
      setImportResult(result);
      setImportError(null);
      void queryClient.invalidateQueries({ queryKey: queryKeys.sources.all });
      void queryClient.invalidateQueries({ queryKey: queryKeys.nav });
    },
    onError: (err: Error): void => {
      setImportError(err.message);
      setImportResult(null);
    },
  });

  const pickAndImport = useCallback((): void => {
    // Create a hidden file input, trigger it, read the file, then import
    if (fileInputRef.current) {
      fileInputRef.current.remove();
    }
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.opml,.xml';
    input.style.display = 'none';
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (!file) {
        return;
      }
      const reader = new FileReader();
      reader.onload = (): void => {
        const text = reader.result as string;
        importMutation.mutate(text);
        input.remove();
      };
      reader.readAsText(file);
    });
    document.body.appendChild(input);
    fileInputRef.current = input;
    input.click();
  }, [importMutation]);

  const clearImportResult = useCallback((): void => {
    setImportResult(null);
    setImportError(null);
  }, []);

  return {
    exportOpml,
    importMutation,
    importResult,
    importError,
    pickAndImport,
    clearImportResult,
  };
};

// -- Exports --

export type { ImportResult, ImportSourceResult, UseOpmlResult };
export { useOpml };
