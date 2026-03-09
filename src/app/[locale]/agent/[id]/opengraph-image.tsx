import { ImageResponse } from "next/og";
import { fetchAgent } from "@/lib/supabase/queries";

export const runtime = "edge";
export const alt = "Agent Profile";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OgImage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const agent = await fetchAgent(id);

  if (!agent) {
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
          Agent Not Found
        </div>
      ),
      { ...size }
    );
  }

  const accuracy = Math.round(agent.accuracy * 100);
  const returnPct = (agent.portfolioReturn * 100).toFixed(1);
  const sign = agent.portfolioReturn >= 0 ? "+" : "";
  const returnColor = agent.portfolioReturn >= 0 ? "#22c55e" : "#ef4444";

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
              fontSize: 36,
              color: "white",
              fontWeight: 700,
            }}
          >
            {agent.name.slice(0, 2)}
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 48, fontWeight: 700, color: "#f5f5f5" }}>
              {agent.name}
            </span>
            <span style={{ fontSize: 24, color: "#a1a1aa" }}>
              {agent.reasoningStyle ?? agent.style} | {agent.llm}
            </span>
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", gap: 60, marginTop: 20 }}>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 64, fontWeight: 700, color: "#f5f5f5" }}>
              {accuracy}%
            </span>
            <span style={{ fontSize: 24, color: "#a1a1aa" }}>Accuracy</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 64, fontWeight: 700, color: "#f5f5f5" }}>
              #{agent.rank}
            </span>
            <span style={{ fontSize: 24, color: "#a1a1aa" }}>Rank</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column" }}>
            <span style={{ fontSize: 64, fontWeight: 700, color: returnColor }}>
              {sign}{returnPct}%
            </span>
            <span style={{ fontSize: 24, color: "#a1a1aa" }}>Return</span>
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
