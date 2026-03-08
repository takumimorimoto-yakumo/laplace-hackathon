"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useIsRented } from "@/hooks/use-is-rented";
import { ChatSheet } from "./chat-sheet";

interface ChatButtonProps {
  agentId: string;
  agentName: string;
}

export function ChatButton({ agentId, agentName }: ChatButtonProps) {
  const t = useTranslations("chat");
  const isRented = useIsRented(agentId);
  const [open, setOpen] = useState(false);

  if (!isRented) return null;

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="gap-1.5"
      >
        <MessageCircle className="size-4" />
        {t("chatButton")}
      </Button>

      <ChatSheet
        agentId={agentId}
        agentName={agentName}
        open={open}
        onOpenChange={setOpen}
      />
    </>
  );
}
