"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { useWallet } from "./wallet-provider";
import type { Wallet } from "@solana/wallet-adapter-react";

interface WalletModalProps {
  open: boolean;
  onClose: () => void;
}

export function WalletModal({ open, onClose }: WalletModalProps) {
  const { wallets, select } = useWallet();
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  const handleOverlayClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === overlayRef.current) onClose();
    },
    [onClose]
  );

  const handleSelect = useCallback(
    async (wallet: Wallet) => {
      select(wallet.adapter.name);
      onClose();
      try {
        await wallet.adapter.connect();
      } catch {
        // User rejected or wallet error
      }
    },
    [select, onClose]
  );

  // Deduplicate wallets by name, keeping the first occurrence
  const uniqueWallets = useMemo(() => {
    const seen = new Set<string>();
    return wallets.filter((w) => {
      const name = w.adapter.name;
      if (seen.has(name)) return false;
      seen.add(name);
      return true;
    });
  }, [wallets]);

  // Split into installed and not-installed
  const { installed, available } = useMemo(() => {
    const inst: Wallet[] = [];
    const avail: Wallet[] = [];
    for (const w of uniqueWallets) {
      if (
        w.readyState === "Installed" ||
        w.readyState === "Loadable"
      ) {
        inst.push(w);
      } else {
        avail.push(w);
      }
    }
    return { installed: inst, available: avail };
  }, [uniqueWallets]);

  if (!open) return null;

  return createPortal(
    <div
      ref={overlayRef}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={handleOverlayClick}
    >
      <div className="w-full max-w-sm rounded-2xl bg-[#1a1a2e] border border-white/10 shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-5 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Connect Wallet
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              You need to connect a Solana wallet.
            </p>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-white/10 hover:text-foreground transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Wallet list */}
        <div className="px-5 pb-5 space-y-4">
          {installed.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Detected
              </p>
              <div className="grid grid-cols-2 gap-2">
                {installed.map((w) => (
                  <WalletItem
                    key={w.adapter.name}
                    wallet={w}
                    onClick={() => handleSelect(w)}
                  />
                ))}
              </div>
            </div>
          )}

          {available.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                More wallets
              </p>
              <div className="grid grid-cols-2 gap-2">
                {available.map((w) => (
                  <WalletItem
                    key={w.adapter.name}
                    wallet={w}
                    onClick={() => handleSelect(w)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body
  );
}

function WalletItem({
  wallet,
  onClick,
}: {
  wallet: Wallet;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="flex items-center gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-3 text-sm font-medium text-foreground hover:bg-white/10 transition-colors w-full"
    >
      {wallet.adapter.icon && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={wallet.adapter.icon}
          alt={wallet.adapter.name}
          className="size-8 rounded-lg"
        />
      )}
      <span className="truncate">{wallet.adapter.name}</span>
    </button>
  );
}
