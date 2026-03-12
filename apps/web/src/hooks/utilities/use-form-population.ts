import { useEffect, useRef } from 'react';

const useFormPopulation = <T>(data: T | undefined, populate: (data: T) => void): void => {
  const populated = useRef(false);

  useEffect(() => {
    if (data && !populated.current) {
      populated.current = true;
      populate(data);
    }
  }, [data, populate]);
};

export { useFormPopulation };
