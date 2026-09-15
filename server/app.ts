import { createRequestListener } from "@react-router/node";

export const app = createRequestListener({
  build: () => import("virtual:react-router/server-build"),
});
