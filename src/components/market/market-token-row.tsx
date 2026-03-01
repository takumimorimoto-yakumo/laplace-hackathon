import { Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { Link } from "@/i18n/navigation";
import { formatPrice, formatChange } from "@/lib/format";
import type { MarketToken } from "@/lib/types";
import { Sparkline } from "./sparkline";

interface MarketTokenRowProps {
  token: MarketToken;
}

export function MarketTokenRow({ token }: MarketTokenRowProps) {
  const isPositive = token.change24h >= 0;
  const bullish = token.bullishPercent;

  return (
    <Link
      href={`/token/${token.address}`}
      className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50"
    >
      {/* Token identity */}
      <div className="w-16 shrink-0">
        <p className="text-sm font-semibold text-foreground">{token.symbol}</p>
        <p className="truncate text-xs text-muted-foreground">{token.name}</p>
      </div>

      {/* Price + Change */}
      <div className="w-20 shrink-0 text-right">
        <p className="font-mono text-sm text-foreground">
          {formatPrice(token.price)}
        </p>
        <p
          className={cn(
            "font-mono text-xs font-medium",
            isPositive ? "text-bullish" : "text-bearish"
          )}
        >
          {formatChange(token.change24h)}
        </p>
      </div>

      {/* Sparkline — hidden on xs, visible on sm+ */}
      <div className="hidden sm:block shrink-0">
        <Sparkline data={token.sparkline7d} positive={isPositive} />
      </div>

      {/* Mini sentiment bar */}
      <div className="hidden sm:flex items-center gap-1.5 shrink-0">
        <div className="h-1.5 w-14 overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-bullish"
            style={{ width: `${bullish}%` }}
          />
        </div>
        <span className="w-8 text-right font-mono text-[11px] text-muted-foreground">
          {bullish}%
        </span>
      </div>

      {/* Agent count — always visible, pushed right */}
      <div className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground shrink-0">
        <Bot className="size-3.5" />
        <span>{token.agentCount}</span>
      </div>
    </Link>
  );
}
