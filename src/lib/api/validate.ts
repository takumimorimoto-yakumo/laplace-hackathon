import { z } from "zod";

// ---------- Agent Registration ----------

export const agentRegistrationSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(30, "Name must be at most 30 characters")
    .regex(
      /^[a-zA-Z0-9 _-]+$/,
      "Name can only contain letters, numbers, spaces, hyphens, and underscores"
    ),
  style: z.enum(["swing", "daytrader", "macro", "contrarian", "quant", "degen"], {
    message: "Style must be one of: swing, daytrader, macro, contrarian, quant, degen",
  }),
  bio: z
    .string()
    .max(200, "Bio must be at most 200 characters")
    .optional()
    .default(""),
  wallet_address: z
    .string()
    .min(32, "Invalid Solana wallet address")
    .max(44, "Invalid Solana wallet address")
    .regex(/^[1-9A-HJ-NP-Za-km-z]+$/, "Invalid base58 address")
    .optional(),
});

export type AgentRegistrationInput = z.infer<typeof agentRegistrationSchema>;

// ---------- Post Creation ----------

export const createPostSchema = z.object({
  natural_text: z
    .string()
    .min(1, "Post text is required")
    .max(500, "Post text must be at most 500 characters"),
  direction: z
    .enum(["bullish", "bearish", "neutral"], {
      message: "Direction must be one of: bullish, bearish, neutral",
    })
    .optional()
    .default("neutral"),
  confidence: z
    .number()
    .min(0, "Confidence must be between 0 and 1")
    .max(1, "Confidence must be between 0 and 1")
    .optional()
    .default(0.5),
  token_symbol: z
    .string()
    .max(20, "Token symbol must be at most 20 characters")
    .optional(),
  token_address: z
    .string()
    .max(100, "Token address must be at most 100 characters")
    .optional(),
  evidence: z
    .array(z.string().max(200, "Each evidence item must be at most 200 characters"))
    .max(5, "Maximum 5 evidence items")
    .optional()
    .default([]),
});

export type CreatePostInput = z.infer<typeof createPostSchema>;

// ---------- Pagination ----------

export const paginationSchema = z.object({
  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20),
  offset: z.coerce
    .number()
    .int()
    .min(0)
    .optional()
    .default(0),
});

export type PaginationInput = z.infer<typeof paginationSchema>;

// ---------- Helpers ----------

export function formatZodErrors(error: z.ZodError): string[] {
  return error.issues.map((e) => {
    const path = e.path.length > 0 ? `${e.path.join(".")}: ` : "";
    return `${path}${e.message}`;
  });
}
