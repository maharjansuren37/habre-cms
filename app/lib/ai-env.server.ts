import { z } from "zod";

// AI settings (item 18b1). Kept apart from env.server.ts, which parses
// process.env when imported, so node --test can exercise these rules.
// env.server.ts spreads the fields and replaces the four variables with env.AI.

// A blank variable (`AI_PROVIDERS=` copied from .env.example) counts as unset.
const optional = <Schema extends z.ZodType>(schema: Schema) =>
  z.preprocess((value) => (value === "" ? undefined : value), schema);

const KNOWN_PROVIDERS = ["openrouter", "anthropic", "openai"] as const;
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

// US dollars per million tokens (item 18b2).
export type Price = { input: number; output: number; cacheRead: number; cacheWrite: number };

const PRICE_KEYS = ["input", "output", "cache_read", "cache_write"] as const;

// `input=<n>,output=<n>,cache_read=<n>,cache_write=<n>`: exactly these four
// keys, once each, every one a decimal from 0. The message names the variable,
// never the value.
const price = (variable: string) =>
  z.string().transform((value, context): Price => {
    const found = new Map<string, number>();
    let valid = true;
    for (const part of value.split(",")) {
      const [key = "", number = "", ...extra] = part.split("=");
      const known = (PRICE_KEYS as readonly string[]).includes(key);
      if (!known || extra.length > 0 || found.has(key) || !/^[0-9]+(?:\.[0-9]+)?$/.test(number)) {
        valid = false;
        break;
      }
      found.set(key, Number(number));
    }
    if (!valid || found.size !== PRICE_KEYS.length) {
      context.addIssue({
        code: "custom",
        message: `${variable} must be input=<n>,output=<n>,cache_read=<n>,cache_write=<n>, each a number from 0 in US dollars per million tokens`,
      });
      return z.NEVER;
    }
    return {
      input: found.get("input") ?? 0,
      output: found.get("output") ?? 0,
      cacheRead: found.get("cache_read") ?? 0,
      cacheWrite: found.get("cache_write") ?? 0,
    };
  });

export const aiEnvFields = {
  AI_PROVIDERS: optional(providers.default(["openrouter"])),
  // Blank or unset turns AI off when openrouter is the first provider.
  OPENROUTER_API_KEY: z.string().optional(),
  OPENROUTER_MODEL: optional(z.string().min(1).default("anthropic/claude-opus-5.5")),
  // The direct providers have no default model: a price belongs to one model.
  ANTHROPIC_API_KEY: optional(z.string().optional()),
  ANTHROPIC_MODEL: optional(z.string().min(1).optional()),
  ANTHROPIC_PRICE: optional(price("ANTHROPIC_PRICE").optional()),
  OPENAI_API_KEY: optional(z.string().optional()),
  OPENAI_MODEL: optional(z.string().min(1).optional()),
  OPENAI_PRICE: optional(price("OPENAI_PRICE").optional()),
  // Credits a site may use a month: a whole number, or null for no limit.
  // Unset gives 1000 (US$1 of provider cost), provisional.
  AI_CREDITS_PER_MONTH: optional(creditsPerMonth.default(1000)),
};

export type ProviderSettings =
  | { name: "openrouter"; apiKey: string; model: string }
  | { name: "anthropic" | "openai"; apiKey: string; model: string; price: Price };

export type AiSettings = {
  providers: ProviderSettings[];
  creditsPerMonth: number | null;
};

type AiEnvFields = z.output<z.ZodObject<typeof aiEnvFields>>;

// null when AI is off: the first provider has no key. When AI is on, every
// listed provider needs its key and a direct one its model and price; each
// missing one is reported by name through `missing`. The variables are
// validated either way.
export const toAiSettings = (
  fields: AiEnvFields,
  missing: (variable: string) => void,
): AiSettings | null => {
  const apiKey = {
    openrouter: fields.OPENROUTER_API_KEY,
    anthropic: fields.ANTHROPIC_API_KEY,
    openai: fields.OPENAI_API_KEY,
  };
  const [first] = fields.AI_PROVIDERS;
  if (!first || !apiKey[first]) return null;

  const providers: ProviderSettings[] = [];
  for (const name of fields.AI_PROVIDERS) {
    const key = apiKey[name];
    if (!key) {
      missing(`${name.toUpperCase()}_API_KEY`);
    } else if (name === "openrouter") {
      providers.push({ name, apiKey: key, model: fields.OPENROUTER_MODEL });
    } else {
      const model = name === "anthropic" ? fields.ANTHROPIC_MODEL : fields.OPENAI_MODEL;
      const price = name === "anthropic" ? fields.ANTHROPIC_PRICE : fields.OPENAI_PRICE;
      if (!model) missing(`${name.toUpperCase()}_MODEL`);
      if (!price) missing(`${name.toUpperCase()}_PRICE`);
      if (model && price) providers.push({ name, apiKey: key, model, price });
    }
  }
  return { providers, creditsPerMonth: fields.AI_CREDITS_PER_MONTH };
};

// Reports a missing variable as a Zod issue, so startup names it like any other.
export const reportMissing = (context: z.RefinementCtx) => (variable: string) =>
  context.addIssue({
    code: "custom",
    path: [variable],
    message: `${variable} is required when AI_PROVIDERS lists its provider and AI is on`,
  });

export const aiEnvSchema = z
  .object(aiEnvFields)
  .transform((fields, context) => ({ AI: toAiSettings(fields, reportMissing(context)) }));
