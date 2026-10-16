import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api } from './api';
import { rt } from './realtime';
import type { CommunitySummary, User } from './types';

interface Store {
  user: User | null;
  communities: CommunitySummary[];
  loading: boolean;
  stripe: boolean;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  toast: (msg: string, kind?: 'info' | 'error' | 'success') => void;
}

const Ctx = createContext<Store>(null as any);
export const useStore = () => useContext(Ctx);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [stripe, setStripe] = useState(false);
  const [loading, setLoading] = useState(true);
  const [toasts, setToasts] = useState<{ id: number; msg: string; kind: string }[]>([]);

  const refresh = useCallback(async () => {
    const me = await api.get<{ user: User | null; communities: CommunitySummary[]; stripe: boolean }>('/api/me');
    setUser(me.user); setCommunities(me.communities || []); setStripe(!!me.stripe); setLoading(false);
    if (me.user) { rt.connect(); rt.send({ t: 'refresh-memberships' }); } else rt.close();
  }, []);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => rt.on((m) => { if (m.t === 'membership:changed') refresh(); }), [refresh]);

  const toast = useCallback((msg: string, kind: 'info' | 'error' | 'success' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, msg, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3500);
  }, []);

  const logout = useCallback(async () => { await api.post('/api/auth/logout'); rt.close(); setUser(null); setCommunities([]); }, []);

  const value = useMemo(() => ({ user, communities, loading, stripe, refresh, logout, toast }), [user, communities, loading, stripe, refresh, logout, toast]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div className="toasts">{toasts.map((t) => <div key={t.id} className={`toast toast-${t.kind}`}>{t.msg}</div>)}</div>
    </Ctx.Provider>
  );
}
