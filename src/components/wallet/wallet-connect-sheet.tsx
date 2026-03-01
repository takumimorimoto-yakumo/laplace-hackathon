"use client";

import { useTranslations } from "next-intl";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { walletOptions } from "@/lib/config";
import type { WalletName } from "@/lib/types";

interface WalletConnectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectWallet: (name: WalletName) => void;
}

export function WalletConnectSheet({ open, onOpenChange, onSelectWallet }: WalletConnectSheetProps) {
  const t = useTranslations("wallet");

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("selectWallet")}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-2">
          {walletOptions.map((wallet) => (
            <Button
              key={wallet.name}
              variant="outline"
              className="w-full justify-start gap-3 h-14 text-base"
              onClick={() => {
                onSelectWallet(wallet.name);
                onOpenChange(false);
              }}
            >
              <span className="text-2xl">{wallet.icon}</span>
              <span>{wallet.label}</span>
            </Button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
