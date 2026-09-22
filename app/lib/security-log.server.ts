// Security-relevant events, one JSON object per line on stderr, collected by the
// systemd journal. Never an email, password, token or hash: an id identifies
// the user, and the IP is kept because it is the only way to spot guessing.
// Users and roles (item 8) adds role_changed, user_deactivated, password_reset.
export type SecurityEvent =
  | { event: "login_succeeded"; userId: string; ip: string }
  | {
      event: "login_failed";
      reason: "unknown_email" | "bad_password" | "deactivated";
      userId?: string;
      ip: string;
    }
  | { event: "login_rate_limited"; scope: "email" | "ip" | "server"; ip: string }
  | { event: "logout"; userId: string }
  | { event: "request_refused"; reason: "cross_site"; method: string; path: string; ip: string }
  | { event: "request_refused"; reason: "role"; path: string; role: string; ip: string };

export function logSecurityEvent(entry: SecurityEvent): void {
  console.warn(JSON.stringify(entry));
}
