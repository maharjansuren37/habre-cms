import { index, layout, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  layout("features/public-site/layout.tsx", [
    index("features/public-site/home.tsx"),
    // The post list's own address, whatever `/` shows (item 9). "posts" is a
    // reserved page slug (D68), so no page is ever shadowed by it.
    route("posts", "features/public-site/posts.tsx"),
    route("posts/:slug", "features/public-site/post.tsx"),
    // A single dynamic segment, registered after the literal "posts/:slug"
    // and "admin/*" routes above - path depth keeps it from ever matching
    // them, and reserved slugs (D68) keep a page from ever claiming one of
    // their names in the first place.
    route(":slug", "features/public-site/page.tsx"),
  ]),
  route("healthz", "features/public-site/healthz.ts"),
  route("admin/login", "features/auth/login.tsx"),
  route("admin/logout", "features/auth/logout.ts"),
  // Platform paths on the admin host until item 16 adds the platform host.
  route("signup", "features/signup/signup.tsx"),
  route("signup/sent", "features/signup/signup-sent.tsx"),
  route("verify", "features/signup/verify.tsx"),
  route("forgot-password", "features/signup/forgot-password.tsx"),
  route("reset-password", "features/signup/reset-password.tsx"),
  route("confirm-email", "features/account/confirm-email.tsx"),
  layout("features/admin-shell/layout.tsx", [
    route("admin", "features/admin-shell/home.ts"),
    route("admin/posts", "features/content/post-list.tsx"),
    // A short question, not a focused task - keeps the sidebar (post-delete.tsx).
    route("admin/posts/:id/delete", "features/content/post-delete.tsx"),
    route("admin/pages", "features/content/page-list.tsx"),
    route("admin/pages/:id/delete", "features/content/page-delete.tsx"),
    route("admin/media", "features/media/media-list.tsx"),
    route("admin/media/picker", "features/media/media-picker.ts"),
    route("admin/media/:id/delete", "features/media/media-delete.tsx"),
    route("admin/settings", "features/settings/settings.tsx"),
    route("admin/account", "features/account/account.tsx"),
    route("admin/account/delete", "features/account/account-delete.tsx"),
    route("admin/users", "features/users/user-list.tsx"),
    route("admin/users/new", "features/users/user-new.tsx"),
    route("admin/users/:id", "features/users/user-edit.tsx"),
  ]),
  // Outside the admin shell on purpose: the editor drops the sidebar (design.md).
  route("admin/posts/new", "features/content/post-new.tsx"),
  route("admin/posts/:id", "features/content/post-edit.tsx"),
  route("admin/pages/new", "features/content/page-new.tsx"),
  route("admin/pages/:id", "features/content/page-edit.tsx"),
] satisfies RouteConfig;
