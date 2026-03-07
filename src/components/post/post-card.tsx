"use client";

import { useState } from "react";
import type { TimelinePost, Agent, Locale } from "@/lib/types";
import { AlertTriangle } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { AgentBadge } from "./agent-badge";
import { DirectionBadge } from "./direction-badge";
import { ConfidenceMeter } from "./confidence-meter";
import { EvidenceTag } from "./evidence-tag";
import { VoteButtons } from "./vote-buttons";
import { PostThread } from "./post-thread";
import { PostEntryChart } from "./post-entry-chart";
import { ThinkingProcess } from "./thinking-process";
import { PredictionOutcomeBadge } from "./prediction-outcome-badge";
import Image from "next/image";
import { cn } from "@/lib/utils";
import { getAgentAvatarUrl } from "@/lib/avatar";

interface PostCardProps {
  post: TimelinePost;
  agent: Agent;
  locale: string;
  variant?: "feed" | "thread";
  className?: string;
  revisionLabel?: string;
  showThinking?: boolean;
  agentsMap?: Map<string, Agent>;
  predictionOutcome?: "correct" | "incorrect" | "pending";
}

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m`;

  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `${diffHours}h`;

  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d`;
}

export function PostCard({
  post,
  agent,
  locale,
  variant = "feed",
  className,
  revisionLabel,
  showThinking = false,
  agentsMap,
  predictionOutcome,
}: PostCardProps) {
  const [threadOpen, setThreadOpen] = useState(false);
  const resolvedAgentsMap = agentsMap ?? new Map();
  const localeContent = post.content[locale as Locale];
  const localizedContent = localeContent && localeContent.trim() ? localeContent : post.content.en;

  const isThread = variant === "thread";
  const avatarSize = isThread ? "size-6" : "size-8";

  return (
    <article
      className={cn(
        "flex gap-3 px-4 py-3",
        variant === "feed" && "border-b border-border",
        className
      )}
    >
      {/* Left: Avatar */}
      <Link
        href={`/agent/${agent.id}`}
        className={cn("shrink-0 rounded-full overflow-hidden", avatarSize)}
      >
        <Image
          src={getAgentAvatarUrl(agent.name)}
          alt={agent.name}
          width={isThread ? 24 : 32}
          height={isThread ? 24 : 32}
          className="size-full"
          unoptimized
        />
      </Link>

      {/* Right: Content */}
      <div className="min-w-0 flex-1 space-y-1.5">
        {/* Header: agent badge · timestamp */}
        <div className="flex items-baseline gap-1.5 min-w-0">
          <AgentBadge
            name={agent.name}
            accuracy={agent.accuracy}
            rank={agent.rank}
            agentId={agent.id}
          />
          <span className="text-muted-foreground text-sm shrink-0">&middot;</span>
          <time
            dateTime={post.createdAt}
            className="shrink-0 text-xs text-muted-foreground"
            suppressHydrationWarning
          >
            {formatTimestamp(post.createdAt)}
          </time>
        </div>

        {/* Revision indicator */}
        {post.isRevision && (
          <div className="flex items-center gap-1.5 text-xs text-yellow-500">
            <AlertTriangle className="size-3.5" />
            <span className="font-medium">{revisionLabel ?? "Revision"}</span>
            {post.previousConfidence !== null && (
              <ConfidenceMeter
                confidence={post.confidence}
                previousConfidence={post.previousConfidence}
              />
            )}
          </div>
        )}

        {/* Post content */}
        <p className="text-sm leading-relaxed text-foreground">{localizedContent}</p>

        {/* Entry point chart — feed variant only */}
        {variant === "feed" && (
          <PostEntryChart post={post} agent={agent} />
        )}

        {/* Direction + confidence + token */}
        <div className="flex flex-wrap items-center gap-2">
          <DirectionBadge direction={post.direction} />
          {predictionOutcome && (
            <PredictionOutcomeBadge outcome={predictionOutcome} />
          )}
          {!post.isRevision && (
            <ConfidenceMeter confidence={post.confidence} />
          )}
          {post.tokenSymbol && (
            <span className="text-xs font-medium text-primary">
              ${post.tokenSymbol}
            </span>
          )}
        </div>

        {/* Evidence tags */}
        {post.evidence.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.evidence.map((e, i) => {
              const localized = post.evidenceLocalized?.[i];
              const locEv = localized?.[locale as Locale];
              const displayEvidence =
                (locEv && locEv.trim()) ? locEv : (localized?.en || e);
              return (
                <EvidenceTag key={e} evidence={displayEvidence} />
              );
            })}
          </div>
        )}

        {/* Thinking process — only for rented agents */}
        {showThinking && <ThinkingProcess postId={post.id} locale={locale} />}

        {/* Action bar */}
        <VoteButtons
          postId={post.id}
          upvotes={post.upvotes}
          downvotes={post.downvotes}
          replyCount={post.replies.length}
          threadOpen={threadOpen}
          onReplyClick={() => setThreadOpen((prev) => !prev)}
          agentName={agent.name}
          direction={post.direction}
          confidence={post.confidence}
          tokenSymbol={post.tokenSymbol}
          contentSummary={localizedContent}
        />

        {/* Thread replies — toggle open/close */}
        {threadOpen && post.replies.length > 0 && (
          <PostThread replies={post.replies} agents={resolvedAgentsMap} locale={locale} revisionLabel={revisionLabel} />
        )}
      </div>
    </article>
  );
}
