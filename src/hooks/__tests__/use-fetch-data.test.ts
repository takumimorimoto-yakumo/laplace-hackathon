import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { useFetchData } from "../use-fetch-data";

describe("useFetchData", () => {
  beforeEach(() => {
    global.fetch = vi.fn();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should fetch data successfully", async () => {
    const mockData = { id: "1", name: "Test" };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() =>
      useFetchData<typeof mockData>("/api/test")
    );

    expect(result.current.loading).toBe(true);
    expect(result.current.data).toBe(null);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toEqual(mockData);
    expect(result.current.error).toBe(null);
  });

  it("should skip fetch when url is null", () => {
    const { result } = renderHook(() => useFetchData<{ id: string }>(null));

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should skip fetch when skip option is true", () => {
    const { result } = renderHook(() =>
      useFetchData<{ id: string }>("/api/test", { skip: true })
    );

    expect(result.current.loading).toBe(false);
    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe(null);
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("should handle fetch errors", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValueOnce(
      new Error("Network error")
    );

    const { result } = renderHook(() => useFetchData<{ id: string }>("/api/test"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe("Network error");
  });

  it("should handle HTTP errors", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: false,
      status: 404,
      json: async () => ({ error: "Not found" }),
    });

    const { result } = renderHook(() => useFetchData<{ id: string }>("/api/test"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toBe(null);
    expect(result.current.error).toBe("Not found");
  });

  it("should transform data when transform option is provided", async () => {
    const mockData = { items: [{ id: "1" }, { id: "2" }] };
    const transformFn = vi.fn((json) => {
      const data = json as { items: unknown[] };
      return data.items.length;
    });

    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      json: async () => mockData,
    });

    const { result } = renderHook(() =>
      useFetchData<number>("/api/test", {
        transform: transformFn,
      })
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(transformFn).toHaveBeenCalledWith(mockData);
    expect(result.current.data).toBe(2);
  });

  it("should refetch data when refetch is called", async () => {
    const mockData1 = { id: "1" };
    const mockData2 = { id: "2" };

    (global.fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockData1,
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => mockData2,
      });

    const { result } = renderHook(() =>
      useFetchData<typeof mockData1>("/api/test")
    );

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
      expect(result.current.data).toEqual(mockData1);
    });

    // Call refetch
    const refetchPromise = result.current.refetch();

    await waitFor(() => {
      expect(result.current.data).toEqual(mockData2);
    });

    await refetchPromise;
  });

  it("should cancel previous request when url changes", async () => {
    let abortCallCount = 0;

    const originalAbortController = global.AbortController;
    global.AbortController = class MockAbortController {
      signal: AbortSignal;
      constructor() {
        this.signal = { aborted: false } as AbortSignal;
      }
      abort() {
        abortCallCount++;
      }
    } as unknown as typeof AbortController;

    (global.fetch as ReturnType<typeof vi.fn>).mockImplementation(async () => {
      // Simulate slow request
      await new Promise((resolve) => setTimeout(resolve, 100));
      return {
        ok: true,
        json: async () => ({ id: "1" }),
      };
    });

    const { rerender } = renderHook(
      ({ url }) => useFetchData<{ id: string }>(url),
      { initialProps: { url: "/api/test1" } }
    );

    // Change URL before first request completes
    rerender({ url: "/api/test2" });

    await waitFor(() => {
      expect(abortCallCount).toBeGreaterThan(0);
    });

    global.AbortController = originalAbortController;
  });
});
