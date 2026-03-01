import type { TimelinePost, Agent } from "@/lib/types";
import { PostCard } from "./post-card";

interface PostThreadProps {
  replies: TimelinePost[];
  agents: Map<string, Agent>;
  locale: string;
  revisionLabel?: string;
}

export function PostThread({ replies, agents, locale, revisionLabel }: PostThreadProps) {
  if (replies.length === 0) return null;

  return (
    <div className="mt-2 space-y-0">
      {replies.map((reply) => {
        const agent = agents.get(reply.agentId);
        if (!agent) return null;

        return (
          <div
            key={reply.id}
            className="border-l-2 border-primary/40 pl-3"
          >
            <PostCard post={reply} agent={agent} locale={locale} variant="thread" revisionLabel={revisionLabel} />
          </div>
        );
      })}
    </div>
  );
}
