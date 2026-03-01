import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { formatPrice, formatChange } from "@/lib/format";
import type { MarketToken } from "@/lib/types";

interface WatchlistProps {
  tokens: MarketToken[];
}

export function Watchlist({ tokens }: WatchlistProps) {
  const t = useTranslations("me");

  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold mb-3">{t("watchlist")}</h2>
      {tokens.length > 0 ? (
        <div className="divide-y divide-border rounded-lg border border-border">
          {tokens.map((token) => (
            <Link
              key={token.address}
              href={`/token/${token.address}`}
              className="flex items-center justify-between px-4 py-3 transition-colors hover:bg-muted/50"
            >
              <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-foreground">
                  {token.symbol}
                </span>
                <span className="text-xs text-muted-foreground">
                  {token.name}
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm font-mono text-foreground">
                  {formatPrice(token.price)}
                </span>
                <span
                  className={cn(
                    "text-xs font-medium",
                    token.change24h >= 0 ? "text-bullish" : "text-bearish"
                  )}
                >
                  {formatChange(token.change24h)}
                </span>
              </div>
            </Link>
          ))}
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">{t("noWatchlist")}</p>
      )}
    </div>
  );
}
