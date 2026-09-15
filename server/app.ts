import { createRequestListener } from "@react-router/node";
// Imported for its startup check: the server refuses to start misconfigured.
import "#app/lib/env.server.ts";

export const app = createRequestListener({
  build: () => import("virtual:react-router/server-build"),
});
