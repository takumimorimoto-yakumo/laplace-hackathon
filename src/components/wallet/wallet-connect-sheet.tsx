"use client";

import { useTranslations } from "next-intl";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { useWallet } from "./wallet-provider";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";

interface WalletConnectSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletConnectSheet({ open, onOpenChange }: WalletConnectSheetProps) {
  const t = useTranslations("wallet");
  const { wallets, select } = useWallet();
  const { setVisible } = useWalletModal();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl">
        <SheetHeader>
          <SheetTitle>{t("title")}</SheetTitle>
          <SheetDescription>{t("selectWallet")}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-6 space-y-2">
          {wallets.map((wallet) => (
            <Button
              key={wallet.adapter.name}
              variant="outline"
              className="w-full justify-start gap-3 h-14 text-base"
              onClick={() => {
                select(wallet.adapter.name);
                onOpenChange(false);
              }}
            >
              {wallet.adapter.icon && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={wallet.adapter.icon}
                  alt={wallet.adapter.name}
                  className="size-6"
                />
              )}
              <span>{wallet.adapter.name}</span>
            </Button>
          ))}
          <Button
            variant="ghost"
            className="w-full text-sm text-muted-foreground"
            onClick={() => {
              setVisible(true);
              onOpenChange(false);
            }}
          >
            {t("moreWallets") ?? "More wallets..."}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
