"use client";

import { useTranslations } from "next-intl";
import { Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useWallet, useUnifiedWalletContext } from "./wallet-provider";

interface WalletButtonProps {
  className?: string;
}

export function WalletButton({ className }: WalletButtonProps) {
  const { connected, publicKey, disconnect } = useWallet();
  const { setShowModal } = useUnifiedWalletContext();
  const t = useTranslations("common");

  if (connected && publicKey) {
    const address = publicKey.toBase58();
    const short = `${address.slice(0, 4)}...${address.slice(-4)}`;

    return (
      <Button variant="outline" size="sm" className={className} onClick={() => disconnect()}>
        <Wallet className="size-4 mr-1.5" />
        <span className="font-mono text-xs">{short}</span>
      </Button>
    );
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className={className}
      onClick={() => setShowModal(true)}
    >
      {t("connectWallet")}
    </Button>
  );
}
