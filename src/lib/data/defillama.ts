const BASE_URL = "https://api.llama.fi";

const PROTOCOL_SLUGS: Record<string, string> = {
  JUP: "jupiter",
  RAY: "raydium",
  ORCA: "orca",
  JITO: "jito",
  ONDO: "ondo-finance",
};

export function getProtocolSlug(symbol: string): string | undefined {
  return PROTOCOL_SLUGS[symbol.toUpperCase()];
}

interface ChainTvls {
  [chain: string]: number;
}

interface TvlHistoryEntry {
  date: number;
  totalLiquidityUSD: number;
}

interface DefiLlamaProtocolResponse {
  currentChainTvls?: ChainTvls;
  tvl?: TvlHistoryEntry[];
}

export async function fetchProtocolTVL(
  slug: string
): Promise<number | null> {
  try {
    const url = `${BASE_URL}/protocol/${slug}`;

    const response = await fetch(url, {
      next: { revalidate: 300 },
    });

    if (!response.ok) {
      console.error(
        `DeFi Llama protocol API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const json = (await response.json()) as DefiLlamaProtocolResponse;

    // Prefer currentChainTvls: sum all chain values
    if (json.currentChainTvls) {
      const values = Object.values(json.currentChainTvls);
      if (values.length > 0) {
        return values.reduce((sum, val) => sum + val, 0);
      }
    }

    // Fallback: use last entry from tvl history array
    if (json.tvl && json.tvl.length > 0) {
      const lastEntry = json.tvl[json.tvl.length - 1];
      return lastEntry.totalLiquidityUSD;
    }

    console.error(`DeFi Llama: no TVL data found for protocol "${slug}"`);
    return null;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to fetch protocol TVL for ${slug}: ${message}`
    );
    return null;
  }
}

export async function fetchAllProtocolTVLs(): Promise<Record<string, number>> {
  const result: Record<string, number> = {};

  const entries = Object.entries(PROTOCOL_SLUGS);

  const promises = entries.map(async ([symbol, slug]) => {
    const tvl = await fetchProtocolTVL(slug);
    if (tvl !== null) {
      result[symbol] = tvl;
    }
  });

  await Promise.all(promises);

  return result;
}
