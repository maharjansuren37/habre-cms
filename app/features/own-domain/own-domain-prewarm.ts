// The pre-warm (item 21c, Step 6): one request to a newly verified domain so
// Caddy asks for its certificate now, not on a visitor's first page load.
// `fetch` is injected so this runs without a network or the environment.

export const PREWARM_TIMEOUT_MS = 5000;

export function prewarmRequest(domain: string): { url: string; init: RequestInit } {
  return {
    url: `https://${domain}/`,
    init: {
      method: "HEAD",
      // The answer is not needed, only the handshake; never follow it anywhere.
      redirect: "manual",
      signal: AbortSignal.timeout(PREWARM_TIMEOUT_MS),
    },
  };
}

/** Never throws: a failed pre-warm costs the first visitor a slower page, nothing more. */
export async function prewarmWith(
  domain: string,
  deps: {
    fetch: (url: string, init?: RequestInit) => Promise<unknown>;
    log: (line: Record<string, unknown>) => void;
  },
): Promise<void> {
  const { url, init } = prewarmRequest(domain);
  try {
    await deps.fetch(url, init);
  } catch (error) {
    deps.log({
      event: "own_domain_prewarm_failed",
      domain,
      error: error instanceof Error ? error.message : "unknown",
    });
  }
}
