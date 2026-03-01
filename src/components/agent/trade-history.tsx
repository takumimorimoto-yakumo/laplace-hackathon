import type { Trade } from "@/lib/types";
import { cn } from "@/lib/utils";

interface TradeHistoryLabels {
  title: string;
  noTrades: string;
  buy: string;
  sell: string;
  holding: string;
}

interface TradeHistoryProps {
  trades: Trade[];
  labels?: TradeHistoryLabels;
}

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${month}/${day} ${hours}:${minutes}`;
}

function formatSize(size: number): string {
  return `$${size.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

function formatPrice(price: number): string {
  if (price < 0.001) return `$${price.toFixed(7)}`;
  if (price < 1) return `$${price.toFixed(4)}`;
  return `$${price.toFixed(2)}`;
}

function formatPnl(pnl: number): string {
  const sign = pnl >= 0 ? "+" : "";
  return `${sign}$${pnl.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

export function TradeHistory({ trades, labels }: TradeHistoryProps) {
  const titleLabel = labels?.title ?? "Trade History";
  const noTradesLabel = labels?.noTrades ?? "No trades yet";
  const buyLabel = labels?.buy ?? "Buy";
  const sellLabel = labels?.sell ?? "Sell";
  const holdingLabel = labels?.holding ?? "Holding";

  if (trades.length === 0) {
    return (
      <div className="rounded-lg border border-border p-4">
        <h3 className="mb-2 text-sm font-medium text-muted-foreground">
          {titleLabel}
        </h3>
        <p className="text-sm text-muted-foreground">{noTradesLabel}</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <h3 className="mb-3 text-sm font-medium text-muted-foreground">
        {titleLabel}
      </h3>

      <div className="space-y-2">
        {trades.map((trade, index) => {
          const isBuy = trade.action === "buy";
          const hasPnl = trade.pnl !== null;
          const isPositivePnl = hasPnl && (trade.pnl ?? 0) >= 0;

          return (
            <div
              key={`${trade.tokenSymbol}-${trade.action}-${index}`}
              className="flex items-center gap-3 rounded-md border border-border px-3 py-2"
            >
              {/* Date */}
              <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                {formatDate(trade.executedAt)}
              </span>

              {/* Token */}
              <span className="w-12 shrink-0 font-mono text-sm font-semibold text-foreground">
                {trade.tokenSymbol}
              </span>

              {/* Action */}
              <span
                className={cn(
                  "w-10 shrink-0 text-xs font-medium",
                  isBuy ? "text-bullish" : "text-bearish"
                )}
              >
                {isBuy ? buyLabel : sellLabel}
              </span>

              {/* Size */}
              <span className="w-16 shrink-0 font-mono text-xs text-muted-foreground">
                {formatSize(trade.size)}
              </span>

              {/* Price */}
              <span className="w-20 shrink-0 font-mono text-xs text-muted-foreground">
                {formatPrice(trade.price)}
              </span>

              {/* P&L */}
              <span
                className={cn(
                  "ml-auto shrink-0 font-mono text-xs font-medium",
                  hasPnl
                    ? isPositivePnl
                      ? "text-bullish"
                      : "text-bearish"
                    : "text-muted-foreground"
                )}
              >
                {hasPnl ? formatPnl(trade.pnl as number) : holdingLabel}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
