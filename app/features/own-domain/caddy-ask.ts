import { findSiteByDomain } from "#app/features/sites/find-site.server.ts";

const HEADERS = { "Cache-Control": "no-store" };
const MAX_DOMAIN_LENGTH = 253;

// Caddy's on-demand TLS check (item 21c): it asks before getting a certificate
// for a name it has not seen. Loopback only - `classifyHost` refuses any other
// host. Caddy sets X-Forwarded-For and X-Forwarded-Host on everything it
// proxies and sends neither on its own `ask` call, so either header means a
// proxied request, which is refused. Silent on purpose: a handshake for any
// unknown name asks, and a log line per probe would be a flood.
export async function loader({ request }: { request: Request }) {
  const refuse = () => new Response(null, { status: 404, headers: HEADERS });
  if (request.headers.has("x-forwarded-for") || request.headers.has("x-forwarded-host")) {
    return refuse();
  }
  const values = new URL(request.url).searchParams.getAll("domain");
  if (values.length !== 1) return refuse();
  const domain = values[0].toLowerCase().replace(/\.$/, "");
  if (domain === "" || domain.length > MAX_DOMAIN_LENGTH) return refuse();
  const site = await findSiteByDomain(domain);
  return site ? new Response(null, { status: 200, headers: HEADERS }) : refuse();
}
