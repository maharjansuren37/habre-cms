import type { RunKind } from "./run-generation.ts";

/** The fixed descriptions `npm run ai:measure` runs against each provider (18b2). */
export const MEASURE_SAMPLES: readonly { kind: RunKind; description: string }[] = [
  {
    kind: "website",
    description:
      "A small neighbourhood bakery in Hobart that sells sourdough, pastries and wedding cakes. We want people to find our opening hours, see the menu and order a cake.",
  },
  {
    kind: "blog",
    description:
      "A personal blog about cycling across Tasmania, with trip reports, gear reviews and route notes. Friendly and practical, written by one person on weekends.",
  },
  {
    kind: "business",
    description:
      "A two-person bookkeeping firm for sole traders and small cafes. We offer monthly bookkeeping, tax returns and payroll. Clients should be able to book a free call.",
  },
  {
    kind: "portfolio",
    description:
      "A freelance illustrator who makes children's book art and posters. Show a selection of past projects, a short bio and a way to ask about commissions.",
  },
];
