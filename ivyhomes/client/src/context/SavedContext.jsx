import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/apiClient';
import { useAuth } from './AuthContext';

const SavedContext = createContext(null);

/**
 * Holds the set of saved ids so every card in the grid can render its state
 * without a request of its own. Writes are optimistic and roll back on error.
 */
export function SavedProvider({ children }) {
  const { status } = useAuth();
  const [ids, setIds] = useState(() => new Set());

  useEffect(() => {
    if (status !== 'authed') { setIds(new Set()); return; }
    api.request('/saved/ids')
      .then((d) => setIds(new Set(d.ids)))
      .catch(() => setIds(new Set()));
  }, [status]);

  const toggle = useCallback(async (listingId, kind = 'listing') => {
    const wasSaved = ids.has(listingId);
    setIds((prev) => {
      const next = new Set(prev);
      wasSaved ? next.delete(listingId) : next.add(listingId);
      return next;
    });
    try {
      if (wasSaved) await api.delete(`/saved/${encodeURIComponent(listingId)}`);
      else await api.post('/saved', { listing_id: listingId, kind });
    } catch {
      setIds((prev) => {
        const next = new Set(prev);
        wasSaved ? next.add(listingId) : next.delete(listingId);
        return next;
      });
    }
  }, [ids]);

  const value = useMemo(() => ({ ids, isSaved: (id) => ids.has(id), toggle, count: ids.size }), [ids, toggle]);
  return <SavedContext.Provider value={value}>{children}</SavedContext.Provider>;
}

export const useSaved = () => {
  const ctx = useContext(SavedContext);
  if (!ctx) throw new Error('useSaved must be used inside SavedProvider');
  return ctx;
};
