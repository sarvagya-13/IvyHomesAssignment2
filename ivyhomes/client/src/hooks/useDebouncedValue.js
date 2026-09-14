import { useEffect, useRef, useState } from 'react';

/**
 * Trails a fast-changing value by `delay`, so typing in the search box does
 * not fire a request per keystroke. Leading edge is immediate on first mount
 * so the initial render is not delayed for nothing.
 */
export function useDebouncedValue(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  const first = useRef(true);

  useEffect(() => {
    if (first.current) { first.current = false; setDebounced(value); return undefined; }
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
}
