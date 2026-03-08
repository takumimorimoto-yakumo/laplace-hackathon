"use client";

import { useState, useEffect, useCallback, useRef } from "react";

interface UseFetchDataOptions<T> {
  /** Transform response JSON into desired type. Defaults to identity. */
  transform?: (json: unknown) => T;
  /** Skip fetching when true (e.g. no wallet connected) */
  skip?: boolean;
}

interface UseFetchDataReturn<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Generic hook for fetching data from an API endpoint.
 *
 * @param url - The API endpoint URL. Pass null to skip fetching.
 * @param options - Optional configuration.
 * @returns Object containing data, loading state, error, and refetch function.
 *
 * @example
 * ```ts
 * const { data, loading, error, refetch } = useFetchData<MyType>(
 *   walletAddress ? `/api/data?wallet=${walletAddress}` : null
 * );
 * ```
 */
export function useFetchData<T>(
  url: string | null,
  options?: UseFetchDataOptions<T>
): UseFetchDataReturn<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const { transform, skip } = options ?? {};

  const fetchData = useCallback(async () => {
    if (!url || skip) {
      setLoading(false);
      return;
    }

    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const controller = new AbortController();
    abortControllerRef.current = controller;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch(url, { signal: controller.signal });

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        const errorMessage =
          (body as { error?: string }).error ?? `HTTP ${res.status}`;
        setError(errorMessage);
        setData(null);
        return;
      }

      const json = await res.json();
      const transformedData = transform ? transform(json) : (json as T);
      setData(transformedData);
      setError(null);
    } catch (err) {
      // Ignore abort errors
      if (err instanceof Error && err.name === "AbortError") {
        return;
      }
      setError(err instanceof Error ? err.message : "Network error");
      setData(null);
    } finally {
      setLoading(false);
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  }, [url, skip, transform]);

  useEffect(() => {
    void fetchData();

    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, [fetchData]);

  return { data, loading, error, refetch: fetchData };
}
