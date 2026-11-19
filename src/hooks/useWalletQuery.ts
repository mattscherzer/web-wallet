import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../db/supabase';
import { useOptionalWallet } from '../wallet/useWallet';

interface QueryState<T> {
  data: T;
  loaded: boolean;
  failed: boolean;
  refresh: () => Promise<void>;
}

export function useWalletQuery<T>(
  queryFn: (walletId: string) => Promise<T>,
  deps: unknown[],
  initialValue: T,
  realtimeTable?: string,
): QueryState<T> {
  const walletId = useOptionalWallet()?.current?.id ?? null;
  const [state, setState] = useState<{
    walletId: string | null;
    data: T;
    loaded: boolean;
    failed: boolean;
  }>({
    walletId: null,
    data: initialValue,
    loaded: false,
    failed: false,
  });

  const openWalletId = useRef(walletId);
  useEffect(() => {
    openWalletId.current = walletId;
  }, [walletId]);

  const newest = useRef(0);

  const refresh = useCallback(async () => {
    if (!walletId) return;
    const request = ++newest.current;
    const isCurrent = () => openWalletId.current === walletId && newest.current === request;
    try {
      const result = await queryFn(walletId);
      if (isCurrent())
        setState({
          walletId,
          data: result,
          loaded: true,
          failed: false,
        });
    } catch (err) {
      console.error('Supabase query error:', err);
      if (!isCurrent()) return;
      setState((prev) =>
        prev.walletId === walletId
          ? { ...prev, failed: true }
          : {
              walletId,
              data: initialValue,
              loaded: false,
              failed: true,
            },
      );
    }
    // `deps` has a fixed length per hook, so the spread is stable between renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo -- deps has a fixed length per hook (see above)
  }, [walletId, ...deps]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!realtimeTable || !walletId) return;

    const channel = supabase
      .channel(`${realtimeTable}-changes-${Math.random()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: realtimeTable,
          filter: `wallet_id=eq.${walletId}`,
        },
        () => {
          refresh();
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [realtimeTable, walletId, refresh]);

  const current = state.walletId === walletId;
  return {
    data: current ? state.data : initialValue,
    loaded: current && state.loaded,
    failed: current && state.failed && !state.loaded,
    refresh,
  };
}

export function useWalletData<T>(
  queryFn: (walletId: string) => Promise<T>,
  deps: unknown[],
  initialValue: T,
  realtimeTable?: string,
): T {
  return useWalletQuery(queryFn, deps, initialValue, realtimeTable).data;
}
