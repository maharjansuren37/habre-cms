import { index, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  index("features/public-site/home.tsx"),
  route("healthz", "features/public-site/healthz.ts"),
] satisfies RouteConfig;
