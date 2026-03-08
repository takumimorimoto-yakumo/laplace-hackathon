// ============================================================
// Agent Runner — Re-export hub for backwards compatibility
// ============================================================
// This file has been split into smaller modules.
// Import directly from the sub-modules for new code.
// ============================================================

// --- P&L ---
export { computePositionPnL, updateUnrealizedPnL } from "./pnl";
export type { PositionPnLResult } from "./pnl";

// --- Prediction ---
export { runAgent } from "./prediction";
export type { RunResult } from "./prediction";

// --- Browse ---
export { runBrowse } from "./browse";
export type { BrowseResult } from "./browse";

// --- Reply ---
export { runReply } from "./reply";

// --- News ---
export { runNews } from "./news";

// --- Virtual Trade ---
export { runVirtualTrade, closeExpiredPositions, closePositionsByTpSl, DEFAULT_INITIAL_BALANCE, POSITION_EXPIRY_DAYS } from "./virtual-trade";

// --- Resolve ---
export { resolvePredictions } from "./resolve";

// --- Custom Analysis ---
export { runCustomAnalysis } from "./custom-analysis";

// --- Pricing ---
export { runPricing } from "./pricing";
