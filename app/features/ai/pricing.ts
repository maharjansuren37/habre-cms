import type { Price } from "#app/lib/ai-env.server.ts";
import type { Usage } from "./run-generation.ts";

/**
 * A run's cost in US dollars from its tokens and a price in dollars per
 * million tokens. `usage.input` counts every input token, cache reads and
 * writes included, so those two are taken out and priced at their own rates.
 */
export function costFromUsage(usage: Usage, price: Price): number {
  const { input, cacheRead, cacheWrite, output } = usage;
  for (const count of [input, cacheRead, cacheWrite, output]) {
    if (!Number.isFinite(count) || count < 0) {
      throw new RangeError("A usage's token counts must be finite numbers, 0 or more.");
    }
  }
  if (cacheRead + cacheWrite > input) {
    throw new RangeError("A usage's cache tokens cannot exceed its input tokens.");
  }
  const uncached = input - cacheRead - cacheWrite;
  return (
    (uncached * price.input +
      cacheRead * price.cacheRead +
      cacheWrite * price.cacheWrite +
      output * price.output) /
    1_000_000
  );
}
