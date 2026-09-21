import { index, layout, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  layout("features/public-site/layout.tsx", [
    index("features/public-site/home.tsx"),
    route("posts/:slug", "features/public-site/post.tsx"),
  ]),
  route("healthz", "features/public-site/healthz.ts"),
  route("admin/login", "features/auth/login.tsx"),
  route("admin/logout", "features/auth/logout.ts"),
  layout("features/admin-shell/layout.tsx", [
    route("admin", "features/admin-shell/home.ts"),
    route("admin/posts", "features/content/post-list.tsx"),
    // A short question, not a focused task - keeps the sidebar (post-delete.tsx).
    route("admin/posts/:id/delete", "features/content/post-delete.tsx"),
    route("admin/media", "features/media/media-list.tsx"),
    route("admin/media/:id/delete", "features/media/media-delete.tsx"),
  ]),
  // Outside the admin shell on purpose: the editor drops the sidebar (design.md).
  route("admin/posts/new", "features/content/post-new.tsx"),
  route("admin/posts/:id", "features/content/post-edit.tsx"),
] satisfies RouteConfig;
