import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";

// A variable, not a literal, so the typechecker does not try to resolve build output.
const BUILD_PATH = "./build/server/index.js";
const DEVELOPMENT = process.env.NODE_ENV === "development";
const PORT = Number.parseInt(process.env.PORT || "3000", 10);
// Localhost only: Caddy is the public entry point (plan section 8).
const HOST = "127.0.0.1";
const CLIENT_DIR = path.resolve("build/client");

// Content-Security-Policy is not here: it needs each page's own nonce, so
// app/entry.server.tsx sets it on HTML responses (F-100).
const SECURITY_HEADERS = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "X-Frame-Options": "DENY",
};

/** @type {Record<string, string>} */
const CONTENT_TYPES = {
  ".css": "text/css; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json",
  ".map": "application/json",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff2": "font/woff2",
};

/**
 * Serves a file from build/client if the request names one.
 * @param {import("node:http").IncomingMessage} req
 * @param {import("node:http").ServerResponse} res
 * @returns {Promise<boolean>} whether the request was handled
 */
async function serveStatic(req, res) {
  if (req.method !== "GET" && req.method !== "HEAD") return false;

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url ?? "/", "http://localhost").pathname);
  } catch {
    return false;
  }
  // Never serve dotfiles (e.g. build metadata), and never leave build/client.
  if (pathname.split("/").some((segment) => segment.startsWith("."))) return false;
  const filePath = path.join(CLIENT_DIR, pathname);
  if (!filePath.startsWith(CLIENT_DIR + path.sep)) return false;

  let info;
  try {
    info = await stat(filePath);
  } catch {
    return false;
  }
  if (!info.isFile()) return false;

  const isHashedAsset = pathname.startsWith("/assets/");
  res.writeHead(200, {
    "Content-Type": CONTENT_TYPES[path.extname(filePath)] ?? "application/octet-stream",
    "Content-Length": info.size,
    "Cache-Control": isHashedAsset ? "public, max-age=31536000, immutable" : "public, max-age=3600",
  });
  if (req.method === "HEAD") {
    res.end();
    return true;
  }
  createReadStream(filePath)
    .on("error", () => res.destroy())
    .pipe(res);
  return true;
}

/**
 * @param {import("node:http").ServerResponse} res
 * @param {unknown} error
 */
function failRequest(res, error) {
  console.error("Request failed:", error);
  if (res.headersSent) {
    res.destroy();
    return;
  }
  res.statusCode = 500;
  res.end("Internal Server Error");
}

/** @type {(req: import("node:http").IncomingMessage, res: import("node:http").ServerResponse) => void} */
let handleRequest;

if (DEVELOPMENT) {
  const vite = await import("vite");
  const viteDevServer = await vite.createServer({ server: { middlewareMode: true } });
  handleRequest = (req, res) => {
    viteDevServer.middlewares(req, res, async () => {
      try {
        const source = await viteDevServer.ssrLoadModule("./server/app.ts");
        await source.app(req, res);
      } catch (error) {
        if (error instanceof Error) viteDevServer.ssrFixStacktrace(error);
        failRequest(res, error);
      }
    });
  };
} else {
  const { app } = await import(BUILD_PATH);
  handleRequest = (req, res) => {
    serveStatic(req, res)
      .then((handled) => (handled ? undefined : app(req, res)))
      .catch((error) => failRequest(res, error));
  };
}

const server = createServer((req, res) => {
  for (const [name, value] of Object.entries(SECURITY_HEADERS)) res.setHeader(name, value);
  handleRequest(req, res);
});

server.listen(PORT, HOST, () => {
  console.log(
    `Server listening on http://${HOST}:${PORT} (${DEVELOPMENT ? "development" : "production"}); ` +
      `the platform is ${process.env.PLATFORM_URL}, sites are under ${process.env.SITES_URL}`,
  );
});
