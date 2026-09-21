import { index, layout, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("features/public-site/home.tsx"),
  route("healthz", "features/public-site/healthz.ts"),
  route("admin/login", "features/auth/login.tsx"),
  route("admin/logout", "features/auth/logout.ts"),
  layout("features/admin-shell/layout.tsx", [
    route("admin", "features/admin-shell/home.ts"),
    route("admin/posts", "features/content/post-list.tsx"),
    // A short question, not a focused task - keeps the sidebar (post-delete.tsx).
    route("admin/posts/:id/delete", "features/content/post-delete.tsx"),
  ]),
  // Outside the admin shell on purpose: the editor drops the sidebar (design.md).
  route("admin/posts/new", "features/content/post-new.tsx"),
  route("admin/posts/:id", "features/content/post-edit.tsx"),
] satisfies RouteConfig;
