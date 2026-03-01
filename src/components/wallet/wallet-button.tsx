"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet } from "./wallet-provider";
import { WalletConnectSheet } from "./wallet-connect-sheet";

interface WalletButtonProps {
  className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
  const { connected, address, disconnect, connect } = useWallet();
  const t = useTranslations("common");
  const [sheetOpen, setSheetOpen] = useState(false);

  if (connected) {
    return (
      <Button variant="outline" size="sm" className={className} onClick={disconnect}>
        <Wallet className="size-4 mr-1.5" />
        <span className="font-mono text-xs">{address}</span>
      </Button>
    );
  }

  return (
    <>
      <Button variant="outline" size="sm" className={className} onClick={() => setSheetOpen(true)}>
        {t("connectWallet")}
      </Button>
      <WalletConnectSheet
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onSelectWallet={connect}
      />
    </>
  );
}
