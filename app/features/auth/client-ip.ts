/**
 * The visitor's IP address, for rate limiting and security logs. The app listens
 * only on 127.0.0.1 behind Caddy, which sets X-Forwarded-For; the rightmost
 * entry is the one Caddy added. Without Caddy (development) the header is
 * whatever the client sent, which does not matter there.
 */
export function clientIp(headers: Headers): string {
  const forwardedFor = headers.get("X-Forwarded-For") ?? "";
  const nearest = forwardedFor.split(",").at(-1)?.trim();
  return nearest || "unknown";
}

/**
 * The key an IP is rate-limited under. One IPv6 subscriber usually holds a whole
 * /64, so limiting each address separately would give an attacker billions of
 * fresh budgets; the /64 is the unit instead. IPv4 and anything unparseable are
 * used as they are.
 */
export function rateLimitKeyForIp(ip: string): string {
  const address = ip.split("%", 1)[0].toLowerCase();
  if (!address.includes(":")) return ip;

  const mappedIpv4 = /^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/.exec(address);
  if (mappedIpv4) return mappedIpv4[1];

  const groups = expandIpv6(address);
  if (!groups) return ip;
  return `${groups.slice(0, 4).join(":")}::/64`;
}

/** The eight groups of an IPv6 address, without leading zeros, or null if it is not one. */
function expandIpv6(address: string): string[] | null {
  const halves = address.split("::");
  if (halves.length > 2) return null;
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length === 2 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  if (halves.length === 1 ? missing !== 0 : missing < 1) return null;

  const groups = [...head, ...Array<string>(missing).fill("0"), ...tail];
  if (!groups.every((group) => /^[0-9a-f]{1,4}$/.test(group))) return null;
  return groups.map((group) => Number.parseInt(group, 16).toString(16));
}
