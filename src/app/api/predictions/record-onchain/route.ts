import { NextRequest, NextResponse } from "next/server";
import { BN } from "@coral-xyz/anchor";
import { OracleClient } from "@/lib/solana/oracle-client";
import {
  recordPredictionOnChain,
  OnChainPredictionData,
} from "@/lib/solana/prediction-recorder";

// ---------- Types ----------

interface RecordOnChainRequest {
  predictionId: string;
  agentId: string;
  tokenSymbol: string;
  direction: string; // "bullish" | "bearish" | "neutral"
  confidence: number; // 0-100
  entryPrice: number; // in USD or native units
  timeHorizon: number; // in seconds
}

// ---------- Helpers ----------

function mapDirectionToU8(direction: string): number {
  // Oracle program: 0 = bearish, 1 = bullish
  switch (direction.toLowerCase()) {
    case "bearish":
      return 0;
    case "bullish":
      return 1;
    default:
      throw new Error(`Invalid direction: ${direction}. Must be "bullish" or "bearish"`);
  }
}

function priceToU64(price: number): BN {
  // Convert price to fixed-point (multiply by 1e6 for 6 decimals)
  const scaledPrice = Math.floor(price * 1_000_000);
  return new BN(scaledPrice);
}

// ---------- API Route Handler ----------

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as RecordOnChainRequest;

    // Validate input
    if (
      !body.predictionId ||
      !body.agentId ||
      !body.tokenSymbol ||
      !body.direction ||
      body.confidence === undefined ||
      body.entryPrice === undefined ||
      body.timeHorizon === undefined
    ) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (body.confidence < 0 || body.confidence > 100) {
      return NextResponse.json(
        { error: "Confidence must be between 0 and 100" },
        { status: 400 }
      );
    }

    // Try recording with Oracle program first
    let method: "oracle" | "memo" = "memo";
    let txSignature: string | null = null;

    try {
      console.log(
        `Recording prediction ${body.predictionId} via Oracle program...`
      );

      const oracleClient = new OracleClient();

      // Ensure counter is initialized for this agent
      try {
        await oracleClient.initializeCounter(body.agentId);
      } catch (err) {
        console.log(`Counter already initialized or init failed:`, err);
      }

      // Record prediction
      const result = await oracleClient.recordPrediction({
        agentId: body.agentId,
        token: body.tokenSymbol,
        direction: mapDirectionToU8(body.direction),
        confidence: Math.round(body.confidence * 10), // API: 0-100 → Oracle: 0-1000
        entryPrice: priceToU64(body.entryPrice),
        timeHorizon: body.timeHorizon,
      });

      txSignature = result.signature;
      method = "oracle";

      console.log(
        `Prediction recorded via Oracle. Tx: ${txSignature}, PDA: ${result.predictionPda.toBase58()}`
      );
    } catch (oracleError) {
      console.warn(
        "Oracle program recording failed, falling back to SPL Memo:",
        oracleError
      );

      // Fall back to SPL Memo
      const memoData: OnChainPredictionData = {
        predictionId: body.predictionId,
        agentId: body.agentId,
        tokenSymbol: body.tokenSymbol,
        direction: body.direction,
        confidence: body.confidence,
        priceAtPrediction: body.entryPrice,
        priceAtResolution: 0, // Not yet resolved
        outcome: "pending",
        directionScore: 0,
        finalScore: 0,
      };

      txSignature = await recordPredictionOnChain(memoData);

      if (!txSignature) {
        return NextResponse.json(
          { error: "Failed to record prediction on-chain" },
          { status: 500 }
        );
      }

      method = "memo";
    }

    return NextResponse.json({
      success: true,
      txSignature,
      method,
    });
  } catch (error) {
    console.error("Error recording prediction on-chain:", error);
    return NextResponse.json(
      {
        error: "Internal server error",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
