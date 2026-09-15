// The three roles, matching the `users_role_check` constraint in 0001_users.sql.
export const roles = ["admin", "editor", "author"] as const;

export type Role = (typeof roles)[number];
