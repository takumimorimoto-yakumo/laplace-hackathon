"use client";

import { useState, useCallback, useRef } from "react";

interface UseMutationOptions<TInput, TResult> {
  /** Transform a successful Response into the desired result type.
   *  Defaults to `res.json()` if not provided. */
  extractResult?: (res: Response, input: TInput) => Promise<TResult>;
  /** Default error message when the response body has no `error` field. */
  defaultErrorMessage?: string;
}

interface UseMutationReturn<TInput, TResult> {
  mutate: (input: TInput) => Promise<TResult | null>;
  loading: boolean;
  error: string | null;
  reset: () => void;
}

/**
 * Generic mutation hook that eliminates repeated loading/error/try-catch
 * boilerplate across data-mutating hooks.
 *
 * @param mutationFn  Async function that performs the fetch and returns a Response.
 * @param options     Optional configuration (result extraction, default error message).
 */
export function useMutation<TInput, TResult>(
  mutationFn: (input: TInput) => Promise<Response>,
  options?: UseMutationOptions<TInput, TResult>
): UseMutationReturn<TInput, TResult> {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Store options in a ref to keep the mutate callback referentially stable
  const optionsRef = useRef(options);
  optionsRef.current = options;

  const mutate = useCallback(
    async (input: TInput): Promise<TResult | null> => {
      setLoading(true);
      setError(null);
      try {
        const res = await mutationFn(input);
        if (!res.ok) {
          const body = await res
            .json()
            .catch(() => ({ error: "Unknown error" }));
          const msg =
            (body as { error?: string }).error ??
            optionsRef.current?.defaultErrorMessage ??
            "Request failed";
          setError(msg);
          return null;
        }
        if (optionsRef.current?.extractResult) {
          return await optionsRef.current.extractResult(res, input);
        }
        return (await res.json()) as TResult;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Network error";
        setError(msg);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [mutationFn]
  );

  const reset = useCallback(() => {
    setError(null);
  }, []);

  return { mutate, loading, error, reset };
}
