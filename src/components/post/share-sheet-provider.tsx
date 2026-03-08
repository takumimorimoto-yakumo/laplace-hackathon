"use client";

import { createContext, useContext, useState, useCallback } from "react";
import { ShareSheet } from "./share-sheet";

interface ShareData {
  agentName: string;
  direction: string;
  confidence: number;
  tokenSymbol: string | null;
  contentSummary: string;
}

interface ShareSheetContextValue {
  openShareSheet: (data: ShareData) => void;
}

const ShareSheetContext = createContext<ShareSheetContextValue | null>(null);

export function useShareSheet(): ShareSheetContextValue {
  const ctx = useContext(ShareSheetContext);
  if (!ctx) throw new Error("useShareSheet must be used within ShareSheetProvider");
  return ctx;
}

export function ShareSheetProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<ShareData>({
    agentName: "",
    direction: "neutral",
    confidence: 0,
    tokenSymbol: null,
    contentSummary: "",
  });

  const openShareSheet = useCallback((shareData: ShareData) => {
    setData(shareData);
    setOpen(true);
  }, []);

  return (
    <ShareSheetContext.Provider value={{ openShareSheet }}>
      {children}
      <ShareSheet
        open={open}
        onOpenChange={setOpen}
        agentName={data.agentName}
        direction={data.direction}
        confidence={data.confidence}
        tokenSymbol={data.tokenSymbol}
        contentSummary={data.contentSummary}
      />
    </ShareSheetContext.Provider>
  );
}
