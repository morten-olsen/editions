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

// -- Private helpers --

const downloadOpmlBlob = (opml: string): void => {
  const blobUrl = URL.createObjectURL(new Blob([opml], { type: 'application/xml' }));
  const link = document.createElement('a');
  link.href = blobUrl;
  link.download = 'editions-sources.opml';
  link.click();
  URL.revokeObjectURL(blobUrl);
};

const createOpmlFileInput = (onText: (text: string) => void): HTMLInputElement => {
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
      onText(reader.result as string);
      input.remove();
    };
    reader.readAsText(file);
  });
  return input;
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
    void client
      .GET('/api/sources/opml', { headers })
      .then(({ data }) => {
        if (!data) {
          throw new Error('Export failed');
        }
        downloadOpmlBlob(data.opml);
      })
      .catch(() => {
        setImportError('Failed to export feeds. Please try again.');
      });
  }, [headers]);

  const importMutation = useMutation({
    mutationFn: async (opmlText: string): Promise<ImportResult> => {
      const { data, error: err } = await client.POST('/api/sources/opml', {
        body: { opml: opmlText },
        headers,
      });
      if (err || !data) {
        throw new Error((err as { error?: string } | undefined)?.error ?? 'Failed to import OPML');
      }
      return data;
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
    const input = createOpmlFileInput((text) => {
      importMutation.mutate(text);
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
