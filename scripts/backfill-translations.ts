#!/usr/bin/env tsx
// ============================================================
// Backfill Translations — Translate existing posts missing ja/zh
// ============================================================
// Usage:
//   pnpm backfill:translations              # Translate up to 50 posts
//   pnpm backfill:translations --limit 100  # Custom limit
//   pnpm backfill:translations --dry-run    # Preview without updating
//   pnpm backfill:translations --evidence   # Also backfill evidence

import "dotenv/config";
import { config } from "dotenv";
import { resolve } from "path";
config({ path: resolve(__dirname, "../.env.local") });

import { createClient } from "@supabase/supabase-js";
import { translatePost, translateEvidence } from "../src/lib/agents/translate";

// ---------- Environment ----------

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getSupabase() {
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

// ---------- CLI Args ----------

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const backfillEvidence = args.includes("--evidence");
const limitIdx = args.indexOf("--limit");
const limit = limitIdx !== -1 ? parseInt(args[limitIdx + 1], 10) || 50 : 50;

// ---------- Helpers ----------

const DELAY_MS = 2000; // Delay between API calls to avoid rate limits
const MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateWithRetry(text: string): Promise<{ ja: string; zh: string }> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await translatePost(text);
    } catch (err) {
      if (attempt === MAX_RETRIES) throw err;
      console.log(`(retry ${attempt + 1}) `);
      await sleep(1000 * (attempt + 1));
    }
  }
  throw new Error("Unreachable");
}

function needsTranslation(localized: Record<string, string> | null, naturalText: string): boolean {
  if (!localized) return true;
  const ja = localized.ja ?? "";
  const zh = localized.zh ?? "";
  // Needs translation if ja/zh is empty or same as English (our fallback)
  return !ja || !zh || ja === naturalText || zh === naturalText;
}

function needsEvidenceTranslation(
  evidenceLocalized: Record<string, string>[] | null,
  evidence: string[]
): boolean {
  if (!evidence || evidence.length === 0) return false;
  if (!evidenceLocalized) return true;
  if (evidenceLocalized.length !== evidence.length) return true;
  return evidenceLocalized.some((e) => !e.ja || !e.zh);
}

// ---------- Main ----------

async function main() {
  const supabase = getSupabase();

  console.log("=== Backfill Translations ===");
  console.log(`  Limit: ${limit}`);
  console.log(`  Dry run: ${dryRun}`);
  console.log(`  Evidence: ${backfillEvidence}`);
  console.log("");

  // Fetch posts that might need translation
  // We fetch more than the limit since some may already be translated
  const { data: posts, error } = await supabase
    .from("timeline_posts")
    .select("id, natural_text, content_localized, evidence, evidence_localized")
    .order("created_at", { ascending: false })
    .limit(limit * 2);

  if (error) {
    console.error("Failed to fetch posts:", error.message);
    process.exit(1);
  }

  if (!posts || posts.length === 0) {
    console.log("No posts found.");
    return;
  }

  // Filter posts needing content translation
  const needsContentUpdate = posts.filter((p) =>
    needsTranslation(
      p.content_localized as Record<string, string> | null,
      p.natural_text as string
    )
  );

  // Filter posts needing evidence translation
  const needsEvidenceUpdate = backfillEvidence
    ? posts.filter((p) =>
        needsEvidenceTranslation(
          p.evidence_localized as Record<string, string>[] | null,
          p.evidence as string[]
        )
      )
    : [];

  console.log(`Total posts fetched: ${posts.length}`);
  console.log(`Posts needing content translation: ${needsContentUpdate.length}`);
  if (backfillEvidence) {
    console.log(`Posts needing evidence translation: ${needsEvidenceUpdate.length}`);
  }
  console.log("");

  // Process content translations
  const toProcess = needsContentUpdate.slice(0, limit);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < toProcess.length; i++) {
    const post = toProcess[i];
    const text = post.natural_text as string;
    const shortText = text.length > 60 ? text.slice(0, 60) + "..." : text;

    process.stdout.write(`[${i + 1}/${toProcess.length}] ${post.id} "${shortText}" `);

    if (dryRun) {
      console.log("→ SKIP (dry run)");
      continue;
    }

    try {
      const translations = await translateWithRetry(text);
      const ja = translations.ja || text;
      const zh = translations.zh || text;

      const { error: updateError } = await supabase
        .from("timeline_posts")
        .update({
          content_localized: { en: text, ja, zh },
        })
        .eq("id", post.id);

      if (updateError) {
        console.log(`→ DB ERROR: ${updateError.message}`);
        failCount++;
      } else {
        console.log("→ OK");
        successCount++;
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.log(`→ TRANSLATE ERROR: ${msg}`);
      failCount++;
    }

    if (i < toProcess.length - 1) {
      await sleep(DELAY_MS);
    }
  }

  // Process evidence translations
  let evidenceSuccessCount = 0;
  let evidenceFailCount = 0;

  if (backfillEvidence && needsEvidenceUpdate.length > 0) {
    console.log("\n--- Evidence Translations ---\n");
    const evidenceToProcess = needsEvidenceUpdate.slice(0, limit);

    for (let i = 0; i < evidenceToProcess.length; i++) {
      const post = evidenceToProcess[i];
      const evidence = post.evidence as string[];

      if (!evidence || evidence.length === 0) continue;

      process.stdout.write(
        `[${i + 1}/${evidenceToProcess.length}] ${post.id} (${evidence.length} evidence items) `
      );

      if (dryRun) {
        console.log("→ SKIP (dry run)");
        continue;
      }

      try {
        const evidenceLocalized = await translateEvidence(evidence);

        const { error: updateError } = await supabase
          .from("timeline_posts")
          .update({ evidence_localized: evidenceLocalized })
          .eq("id", post.id);

        if (updateError) {
          console.log(`→ DB ERROR: ${updateError.message}`);
          evidenceFailCount++;
        } else {
          console.log("→ OK");
          evidenceSuccessCount++;
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.log(`→ TRANSLATE ERROR: ${msg}`);
        evidenceFailCount++;
      }

      if (i < evidenceToProcess.length - 1) {
        await sleep(DELAY_MS);
      }
    }
  }

  // Summary
  console.log("\n=== Summary ===");
  console.log(`Content: ${successCount} success, ${failCount} failed`);
  if (backfillEvidence) {
    console.log(`Evidence: ${evidenceSuccessCount} success, ${evidenceFailCount} failed`);
  }
  if (dryRun) {
    console.log("(Dry run — no changes made)");
  }
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
