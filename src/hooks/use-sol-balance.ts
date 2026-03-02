"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { getConnection } from "@/lib/solana/connection";

interface BalanceState {
  sol: number | null;
  loading: boolean;
}

const DEFAULT_STATE: BalanceState = { sol: null, loading: false };

function createBalanceStore(publicKeyStr: string | null) {
  let state: BalanceState = DEFAULT_STATE;
  const listeners = new Set<() => void>();

  function emit() {
    for (const listener of listeners) {
      listener();
    }
  }

  function subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }

  function getSnapshot(): BalanceState {
    return state;
  }

  if (publicKeyStr) {
    state = { sol: null, loading: true };

    const connection = getConnection();
    const pk = new PublicKey(publicKeyStr);

    connection
      .getBalance(pk)
      .then((lamports) => {
        state = { sol: lamports / LAMPORTS_PER_SOL, loading: false };
        emit();
      })
      .catch((err: unknown) => {
        console.error("Failed to fetch SOL balance:", err);
        state = { sol: null, loading: false };
        emit();
      });
  }

  return { subscribe, getSnapshot };
}

export function useSolBalance(publicKey: PublicKey | null): BalanceState {
  const publicKeyStr = useMemo(
    () => (publicKey ? publicKey.toBase58() : null),
    [publicKey]
  );

  const store = useMemo(
    () => createBalanceStore(publicKeyStr),
    [publicKeyStr]
  );

  const subscribe = useCallback(
    (onStoreChange: () => void) => store.subscribe(onStoreChange),
    [store]
  );

  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);

  return useSyncExternalStore(subscribe, getSnapshot, () => DEFAULT_STATE);
}
