const BASE_URL = "https://public-api.birdeye.so/defi";

function getHeaders(): HeadersInit {
  const apiKey = process.env.BIRDEYE_API_KEY ?? "";
  return {
    "X-API-KEY": apiKey,
    "x-chain": "solana",
  };
}

export interface TokenPrice {
  price: number;
  change24h: number;
}

export interface OHLCV {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

interface BirdeyePriceResponse {
  success: boolean;
  data: {
    value: number;
    priceChange24h: number;
  };
}

interface BirdeyeOHLCVItem {
  unixTime: number;
  o: number;
  h: number;
  l: number;
  c: number;
  v: number;
}

interface BirdeyeOHLCVResponse {
  success: boolean;
  data: {
    items: BirdeyeOHLCVItem[];
  };
}

export async function fetchTokenPrice(
  address: string
): Promise<TokenPrice | null> {
  try {
    const url = new URL(`${BASE_URL}/price`);
    url.searchParams.set("address", address);

    const response = await fetch(url.toString(), {
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error(
        `Birdeye price API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const json = (await response.json()) as BirdeyePriceResponse;

    if (!json.success) {
      console.error("Birdeye price API returned unsuccessful response");
      return null;
    }

    return {
      price: json.data.value,
      change24h: json.data.priceChange24h,
    };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Failed to fetch token price for ${address}: ${message}`);
    return null;
  }
}

export async function fetchTokenOHLCV(
  address: string,
  timeframe: string
): Promise<OHLCV[] | null> {
  try {
    const url = new URL(`${BASE_URL}/ohlcv`);
    url.searchParams.set("address", address);
    url.searchParams.set("type", timeframe);

    const response = await fetch(url.toString(), {
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error(
        `Birdeye OHLCV API error: ${response.status} ${response.statusText}`
      );
      return null;
    }

    const json = (await response.json()) as BirdeyeOHLCVResponse;

    if (!json.success) {
      console.error("Birdeye OHLCV API returned unsuccessful response");
      return null;
    }

    return json.data.items.map(
      (item: BirdeyeOHLCVItem): OHLCV => ({
        time: item.unixTime,
        open: item.o,
        high: item.h,
        low: item.l,
        close: item.c,
        volume: item.v,
      })
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(
      `Failed to fetch OHLCV for ${address} (${timeframe}): ${message}`
    );
    return null;
  }
}
