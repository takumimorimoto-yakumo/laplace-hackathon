"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Send } from "lucide-react";
import Image from "next/image";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/components/wallet/wallet-provider";
import { useAgentChat } from "@/hooks/use-agent-chat";
import { getAgentAvatarUrl } from "@/lib/avatar";

interface ChatSheetProps {
  agentId: string;
  agentName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ChatSheet({
  agentId,
  agentName,
  open,
  onOpenChange,
}: ChatSheetProps) {
  const t = useTranslations("chat");
  const { publicKey } = useWallet();
  const walletAddress = publicKey?.toBase58() ?? null;
  const { messages, sendMessage, loading, error } = useAgentChat(
    agentId,
    walletAddress
  );
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const handleSend = async () => {
    if (!input.trim() || loading) return;
    const text = input;
    setInput("");
    await sendMessage(text);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      void handleSend();
    }
  };

  const avatarUrl = getAgentAvatarUrl(agentName);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl flex flex-col h-[80vh] max-h-[80vh]"
      >
        <SheetHeader className="flex-shrink-0">
          <div className="flex items-center gap-3">
            <Image
              src={avatarUrl}
              alt={agentName}
              width={36}
              height={36}
              className="rounded-full bg-muted"
            />
            <SheetTitle>{agentName}</SheetTitle>
          </div>
        </SheetHeader>

        {/* Messages area */}
        <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3 min-h-0">
          {messages.length === 0 && !loading && (
            <p className="text-center text-sm text-muted-foreground py-8">
              {t("emptyState")}
            </p>
          )}

          {messages.map((msg, i) => (
            <div
              key={`${msg.timestamp}-${i}`}
              className={`flex ${
                msg.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-2xl px-4 py-2 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-foreground"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}

          {/* Typing indicator */}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-2">
                <div className="flex gap-1">
                  <span className="size-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:0ms]" />
                  <span className="size-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:150ms]" />
                  <span className="size-2 rounded-full bg-muted-foreground animate-bounce [animation-delay:300ms]" />
                </div>
              </div>
            </div>
          )}

          {/* Error display */}
          {error && (
            <p className="text-center text-sm text-destructive">{error}</p>
          )}

          <div ref={messagesEndRef} />
        </div>

        <SheetFooter className="flex-shrink-0">
          <div className="flex gap-2 w-full">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={t("inputPlaceholder")}
              disabled={loading}
              className="flex-1 rounded-full border border-border bg-muted px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={loading || !input.trim()}
              className="rounded-full shrink-0"
            >
              <Send className="size-4" />
              <span className="sr-only">{t("send")}</span>
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
