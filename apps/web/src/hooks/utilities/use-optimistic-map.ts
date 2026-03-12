import { useState, useCallback } from "react";

type UseOptimisticMapResult<V> = {
  overrides: Record<string, V>;
  get: (key: string, serverValue: V) => V;
  set: (key: string, value: V) => void;
  reset: () => void;
};

const useOptimisticMap = <V>(): UseOptimisticMapResult<V> => {
  const [overrides, setOverrides] = useState<Record<string, V>>({});

  const get = useCallback(
    (key: string, serverValue: V): V =>
      key in overrides ? overrides[key]! : serverValue,
    [overrides],
  );

  const set = useCallback((key: string, value: V): void => {
    setOverrides((prev) => ({ ...prev, [key]: value }));
  }, []);

  const reset = useCallback((): void => {
    setOverrides({});
  }, []);

  return { overrides, get, set, reset };
};

export type { UseOptimisticMapResult };
export { useOptimisticMap };
