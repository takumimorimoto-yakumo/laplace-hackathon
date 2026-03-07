import { NextResponse } from "next/server";
import { fetchCachedTokens } from "@/lib/supabase/token-cache";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  try {
    const tokens = await fetchCachedTokens();

    return NextResponse.json(
      { tokens },
      {
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`Market data API error: ${message}`);

    return NextResponse.json(
      { tokens: [] },
      {
        status: 500,
        headers: {
          "Cache-Control": "s-maxage=60, stale-while-revalidate=300",
        },
      }
    );
  }
}
