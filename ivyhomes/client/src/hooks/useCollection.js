import { useCallback, useEffect, useRef, useState } from 'react';
import { api, buildQuery } from '../lib/apiClient';

/**
 * Paged collection loader with append-on-scroll semantics.
 *
 * Every filter change resets to offset 0 and aborts the request in flight, so
 * a fast-typing user never sees results from a query they have moved on from.
 */
export function useCollection(path, params, { pageSize = 24 } = {}) {
  const [items, setItems] = useState([]);
  const [meta, setMeta] = useState({ total: 0, has_more: false, applied_filters: [] });
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(null);
  const offsetRef = useRef(0);
  const abortRef = useRef(null);
  const key = JSON.stringify(params);

  const fetchPage = useCallback(async (offset, append) => {
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    append ? setLoadingMore(true) : setLoading(true);
    setError(null);
    try {
      const data = await api.request(
        path + buildQuery({ ...params, limit: pageSize, offset }),
        { signal: controller.signal },
      );
      setItems((prev) => (append ? [...prev, ...data.results] : data.results));
      setMeta({ total: data.total, has_more: data.has_more, applied_filters: data.applied_filters ?? [] });
      offsetRef.current = offset + data.results.length;
    } catch (err) {
      if (err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, key, pageSize]);

  useEffect(() => {
    offsetRef.current = 0;
    fetchPage(0, false);
    return () => abortRef.current?.abort();
  }, [fetchPage]);

  const loadMore = useCallback(() => {
    if (loading || loadingMore || !meta.has_more) return;
    fetchPage(offsetRef.current, true);
  }, [fetchPage, loading, loadingMore, meta.has_more]);

  return { items, meta, loading, loadingMore, error, loadMore };
}

/** Fires `onHit` when the sentinel scrolls into view - the infinite scroll trigger. */
export function useInfiniteScroll(onHit, enabled) {
  const ref = useRef(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return undefined;
    const io = new IntersectionObserver(
      (entries) => { if (entries[0].isIntersecting) onHit(); },
      { rootMargin: '600px 0px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [onHit, enabled]);
  return ref;
}
