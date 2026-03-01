import { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { PostCard } from "@/components/post/post-card";
import {
  getPostById as mockGetPostById,
  getAgent as mockGetAgent,
  getRootPost as mockGetRootPost,
} from "@/lib/mock-data";
import { fetchPostById, fetchAgent } from "@/lib/supabase/queries";

interface PostPageProps {
  params: Promise<{ locale: string; id: string }>;
}

export async function generateMetadata({
  params,
}: PostPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = (await fetchPostById(id)) ?? mockGetPostById(id);
  if (!post) return { title: "Post Not Found" };

  const agent = (await fetchAgent(post.agentId)) ?? mockGetAgent(post.agentId);
  const agentName = agent?.name ?? "Agent";
  const direction = post.direction;
  const confidence = Math.round(post.confidence * 100);
  const token = post.tokenSymbol ?? "";
  const description = `${agentName} — ${direction} (${confidence}%) on ${token}`;

  return {
    title: `${agentName} on ${token || "Crypto"} | Laplace`,
    description,
    openGraph: {
      title: `${agentName} on ${token || "Crypto"} | Laplace`,
      description,
      type: "article",
    },
    twitter: {
      card: "summary_large_image",
      title: `${agentName} on ${token || "Crypto"} | Laplace`,
      description,
    },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { locale, id } = await params;
  const t = await getTranslations("postDetail");
  const tTimeline = await getTranslations("timeline");

  // Fetch post from Supabase, fallback to mock
  const post = (await fetchPostById(id)) ?? mockGetPostById(id);

  if (!post) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-semibold text-foreground">Post Not Found</p>
          <Link
            href={`/${locale}`}
            className="mt-4 text-sm text-primary hover:underline"
          >
            {t("back")}
          </Link>
        </div>
      </AppShell>
    );
  }

  // Fetch agent from Supabase, fallback to mock
  const agent = (await fetchAgent(post.agentId)) ?? mockGetAgent(post.agentId);
  if (!agent) return null;

  // Get root post if this is a reply
  let rootPost = post;
  let showAsThread = false;
  if (post.parentId) {
    const parentPost = (await fetchPostById(post.parentId)) ?? mockGetPostById(post.parentId);
    if (parentPost) {
      rootPost = mockGetRootPost(parentPost);
      showAsThread = rootPost.id !== post.id;
    }
  }

  return (
    <AppShell>
      {/* Back button */}
      <Link
        href={`/${locale}`}
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground mb-4 transition-colors"
      >
        <ArrowLeft className="size-4" />
        {t("back")}
      </Link>

      {/* If this post is a reply, show the root post first */}
      {showAsThread && (
        <div className="mb-2 opacity-60">
          {await (async () => {
            const rootAgent = (await fetchAgent(rootPost.agentId)) ?? mockGetAgent(rootPost.agentId);
            if (!rootAgent) return null;
            return (
              <PostCard
                post={rootPost}
                agent={rootAgent}
                locale={locale}
                revisionLabel={tTimeline("revision")}
              />
            );
          })()}
        </div>
      )}

      {/* Main post */}
      <PostCard
        post={post}
        agent={agent}
        locale={locale}
        revisionLabel={tTimeline("revision")}
        showThinking
      />
    </AppShell>
  );
}
