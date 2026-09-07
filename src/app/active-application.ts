import { useEffect, useMemo, useState } from 'react';
import { useApplications } from '../api/hooks';
import type { Application } from '../api/types';

const KEY = 'sf.activeApplicationId';

/**
 * The application the citizen screens currently focus on. Persisted per-browser
 * (a convenience only — never auth state). Falls back to the most recently
 * updated non-terminal application.
 */
export function useActiveApplication() {
  const { data: applications, isLoading, isError, refetch } = useApplications('citizen');
  const [activeId, setActiveId] = useState<string | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });

  const active: Application | undefined = useMemo(() => {
    if (!applications?.length) return undefined;
    const byId = activeId && applications.find((a) => a.id === activeId);
    if (byId) return byId;
    const open = [...applications]
      .filter((a) => a.status !== 'APPROVED' && a.status !== 'REJECTED')
      .sort((a, b) => +new Date(b.updatedAt) - +new Date(a.updatedAt));
    return open[0] ?? applications[0];
  }, [applications, activeId]);

  useEffect(() => {
    if (active && active.id !== activeId) {
      setActiveId(active.id);
      try {
        localStorage.setItem(KEY, active.id);
      } catch {
        /* private mode */
      }
    }
  }, [active, activeId]);

  const select = (id: string) => {
    setActiveId(id);
    try {
      localStorage.setItem(KEY, id);
    } catch {
      /* ignore */
    }
  };

  return { applications: applications ?? [], active, activeId: active?.id ?? null, select, isLoading, isError, refetch };
}
