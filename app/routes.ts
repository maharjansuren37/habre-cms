import { index, layout, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("features/public-site/home.tsx"),
  route("healthz", "features/public-site/healthz.ts"),
  route("admin/login", "features/auth/login.tsx"),
  route("admin/logout", "features/auth/logout.ts"),
  layout("features/admin-shell/layout.tsx", [route("admin", "features/admin-shell/home.tsx")]),
] satisfies RouteConfig;
