import type { Role } from "#app/features/users/roles.ts";

// Security-relevant events, one JSON object per line on stderr, collected by the
// systemd journal. Never an email, password, token or hash: an id identifies
// the user, and the IP is kept because it is the only way to spot guessing.
export type SecurityEvent =
  | { event: "login_succeeded"; userId: string; ip: string }
  | {
      event: "login_failed";
      reason: "unknown_email" | "bad_password" | "deactivated" | "no_membership";
      userId?: string;
      ip: string;
    }
  | { event: "login_rate_limited"; scope: "email" | "ip" | "server"; ip: string }
  | { event: "logout"; userId: string }
  | { event: "signup_created"; userId: string; siteId: string; ip: string }
  | { event: "signup_rate_limited"; scope: "ip" | "server"; ip: string }
  | { event: "verification_resent"; userId: string }
  | { event: "resend_rate_limited"; scope: "ip" | "email"; ip: string }
  | { event: "email_send_failed"; purpose: "verify"; userId: string }
  | { event: "request_refused"; reason: "cross_site"; method: string; path: string; ip: string }
  | {
      event: "request_refused";
      reason: "wrong_host";
      method: string;
      path: string;
      host: string;
      ip: string;
    }
  | { event: "request_refused"; reason: "role"; path: string; role: Role; ip: string }
  | { event: "role_changed"; userId: string; fromRole: Role; toRole: Role; actorId: string }
  | { event: "user_deactivated"; userId: string; actorId: string }
  | { event: "user_reactivated"; userId: string; actorId: string }
  | { event: "password_reset"; userId: string; actorId: string };

export function logSecurityEvent(entry: SecurityEvent): void {
  console.warn(JSON.stringify(entry));
}
