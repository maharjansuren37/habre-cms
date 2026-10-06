import type { Role } from "#app/features/users/roles.ts";

// Security-relevant events, one JSON object per line on stderr, collected by the
// systemd journal. Never an email, password, token or hash: an id identifies
// the user, and the IP is kept because it is the only way to spot guessing.
export type SecurityEvent =
  | { event: "login_succeeded"; userId: string; ip: string }
  | {
      event: "login_failed";
      reason: "unknown_email" | "bad_password" | "deactivated" | "no_membership" | "unverified";
      userId?: string;
      ip: string;
    }
  | { event: "login_rate_limited"; scope: "email" | "ip" | "server"; ip: string }
  | { event: "logout"; userId: string }
  | { event: "signup_created"; userId: string; siteId: string; ip: string }
  | { event: "signup_rate_limited"; scope: "ip" | "server"; ip: string }
  | { event: "email_verified"; userId: string }
  | { event: "verification_resent"; userId: string }
  | { event: "resend_rate_limited"; scope: "ip" | "email"; ip: string }
  | { event: "password_reset_requested"; userId: string }
  | { event: "password_reset_completed"; userId: string }
  | { event: "reset_rate_limited"; scope: "ip" | "email"; ip: string }
  | { event: "email_changed"; userId: string }
  | { event: "email_change_requested"; userId: string }
  | { event: "email_change_rate_limited"; scope: "ip" | "email"; ip: string }
  | {
      event: "email_send_failed";
      purpose: "verify" | "reset" | "email_change" | "email_changed_notice" | "site_deleted_notice";
      userId: string;
    }
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
  | { event: "password_reset"; userId: string; actorId: string }
  | { event: "password_changed"; userId: string }
  | { event: "account_password_refused"; userId: string; ip: string }
  | { event: "account_deleted"; userId: string; siteId: string; siteDeleted: boolean };

export function logSecurityEvent(entry: SecurityEvent): void {
  console.warn(JSON.stringify(entry));
}
