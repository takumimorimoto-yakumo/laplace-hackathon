import { ImageResponse } from "next/og";
import { getToken } from "@/lib/tokens";
import { formatPrice, formatChange } from "@/lib/format";

export const runtime = "edge";
export const alt = "Token";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ address: string }>;
}) {
  const { address } = await params;
  const token = getToken(address);

  if (!token) {
    return new ImageResponse(
      (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "100%",
            height: "100%",
            background: "#0a0a0a",
            color: "#f5f5f5",
            fontSize: 48,
          }}
        >
          Token {address.slice(0, 8)}...
        </div>
      ),
      { ...size }
    );
  }

  const changeColor = token.change24h >= 0 ? "#22c55e" : "#ef4444";

  return new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          width: "100%",
          height: "100%",
          background: "linear-gradient(135deg, #0a0a0a 0%, #1a1a2e 100%)",
          padding: 60,
          fontFamily: "sans-serif",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: 24, marginBottom: 40 }}>
          <div
            style={{
              width: 80,
              height: 80,
              borderRadius: 40,
              background: "#7c3aed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              color: "white",
              fontWeight: 700,
            }}
          >
            {token.symbol.slice(0, 3)}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 48, fontWeight: 700, color: "#f5f5f5" }}>
              {token.name}
            </span>
            <span style={{ fontSize: 28, color: "#a1a1aa" }}>
              {token.symbol}
            </span>
          </div>
        </div>

        {/* Price */}
        <div style={{ display: "flex", alignItems: "baseline", gap: 24, marginBottom: 40 }}>
          <span style={{ fontSize: 72, fontWeight: 700, color: "#f5f5f5" }}>
            {formatPrice(token.price)}
          </span>
          <span style={{ fontSize: 36, fontWeight: 600, color: changeColor }}>
            {formatChange(token.change24h)}
          </span>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 60 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 36, fontWeight: 600, color: "#f5f5f5" }}>
              {token.agentCount}
            </span>
            <span style={{ fontSize: 20, color: "#a1a1aa" }}>Agents Analyzing</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 36, fontWeight: 600, color: "#f5f5f5" }}>
              {token.bullishPercent}%
            </span>
            <span style={{ fontSize: 20, color: "#a1a1aa" }}>Bullish</span>
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginTop: "auto",
            gap: 12,
          }}
        >
          <span style={{ fontSize: 28, fontWeight: 700, color: "#7c3aed" }}>
            LAPLACE
          </span>
          <span style={{ fontSize: 20, color: "#a1a1aa" }}>
            AI Agent City on Solana
          </span>
        </div>
      </div>
    ),
    { ...size }
  );
}
