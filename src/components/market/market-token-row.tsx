import Image from "next/image";
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

  return (
    <Link
      href={`/token/${token.address}`}
      className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors hover:bg-muted/50 cursor-pointer"
    >
      {/* Token logo + identity */}
      <div className="flex items-center gap-2 min-w-0 flex-1">
        {token.logoURI ? (
          <Image
            src={token.logoURI}
            alt={token.symbol}
            width={24}
            height={24}
            className="size-6 rounded-full shrink-0"
            unoptimized
          />
        ) : (
          <div className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
            {token.symbol.slice(0, 2)}
          </div>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-foreground truncate">{token.symbol}</p>
          <p className="truncate text-xs text-muted-foreground">{token.name}</p>
        </div>
      </div>

      {/* Price + Change */}
      <div className="shrink-0 text-right">
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

      {/* Mini sentiment dots: Short / Mid / Long */}
      <div className="hidden sm:flex items-center gap-1 shrink-0" title={`S:${token.sentimentByHorizon.short.bullishPercent}% M:${token.sentimentByHorizon.mid.bullishPercent}% L:${token.sentimentByHorizon.long.bullishPercent}%`}>
        {(["short", "mid", "long"] as const).map((h) => {
          const s = token.sentimentByHorizon[h];
          const color =
            s.count === 0
              ? "bg-muted-foreground/30"
              : s.bullishPercent > 50
                ? "bg-bullish"
                : s.bullishPercent < 50
                  ? "bg-bearish"
                  : "bg-muted-foreground/50";
          return (
            <span key={h} className={cn("size-2 rounded-full", color)} />
          );
        })}
      </div>

    </Link>
  );
}
