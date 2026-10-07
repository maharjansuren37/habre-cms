import { z } from "zod";

// AI settings (item 18b1). Kept apart from env.server.ts, which parses
// process.env when imported, so node --test can exercise these rules.
// env.server.ts spreads the fields and replaces the four variables with env.AI.

// A blank variable (`AI_PROVIDERS=` copied from .env.example) counts as unset.
const optional = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

// Only openrouter until item 18b2 adds the direct providers.
const KNOWN_PROVIDERS = ["openrouter"] as const;
type ProviderName = (typeof KNOWN_PROVIDERS)[number];

const isProviderName = (name: string): name is ProviderName =>
  (KNOWN_PROVIDERS as readonly string[]).includes(name);

const providers = z.string().transform((value, context): ProviderName[] => {
  const names = value.split(",").map((name) => name.trim());
  const valid = names.every(isProviderName) && new Set(names).size === names.length;
  if (!valid) {
    context.addIssue({
      code: "custom",
      message: `AI_PROVIDERS must be a comma-separated list of distinct names from: ${KNOWN_PROVIDERS.join(", ")}`,
    });
    return z.NEVER;
  }
  return names as ProviderName[];
});

const creditsPerMonth = z
  .string()
  .regex(/^(?:none|[1-9][0-9]*)$/, {
    message: "AI_CREDITS_PER_MONTH must be a whole number of credits from 1, or none",
  })
  .transform((value) => (value === "none" ? null : Number(value)));

export const aiEnvFields = {
  AI_PROVIDERS: optional(providers.default(["openrouter"])),
  // Blank or unset turns AI off.
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: optional(z.string().min(1).default("anthropic/claude-opus-5.5")),
  // Credits a site may use a month: a whole number, or null for no limit.
  // Unset gives 1000 (US$1 of provider cost), provisional.
  AI_CREDITS_PER_MONTH: optional(creditsPerMonth.default(1000)),
};

export type AiSettings = {
  providers: ProviderName[];
  openrouter: { apiKey: string; model: string };
  creditsPerMonth: number | null;
};

type AiEnvFields = z.output<z.ZodObject<typeof aiEnvFields>>;

// null when AI is off. The variables are validated either way.
export const toAiSettings = (fields: AiEnvFields): AiSettings | null =>
  fields.OPENROUTER_API_KEY
    ? {
        providers: fields.AI_PROVIDERS,
        openrouter: { apiKey: fields.OPENROUTER_API_KEY, model: fields.OPENROUTER_MODEL },
        creditsPerMonth: fields.AI_CREDITS_PER_MONTH,
      }
    : null;

export const aiEnvSchema = z
  .object(aiEnvFields)
  .transform((fields) => ({ AI: toAiSettings(fields) }));
