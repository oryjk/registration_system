import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, resolve, sep } from "node:path";

const args = process.argv.slice(2);

function option(name, fallback) {
  const index = args.indexOf(name);
  return index === -1 ? fallback : args[index + 1];
}

function normalizeBase(value) {
  const normalized = `/${String(value || "/").replace(/^\/+|\/+$/g, "")}/`;
  return normalized === "//" ? "/" : normalized;
}

const port = Number(option("--port", "5185"));
const routeBase = normalizeBase(option("--base", "/"));
const distRoot = resolve(process.cwd(), "dist");
const mimeTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function sendText(response, statusCode, body) {
  response.writeHead(statusCode, {
    "content-type": "text/plain; charset=utf-8",
  });
  response.end(body);
}

function insideDist(candidate) {
  return candidate === distRoot || candidate.startsWith(`${distRoot}${sep}`);
}

async function resolveFile(pathname) {
  let decoded;
  try {
    decoded = decodeURIComponent(pathname);
  } catch {
    return null;
  }
  if (!decoded.startsWith(routeBase)) return null;

  const relativePath = decoded.slice(routeBase.length);
  const candidate = resolve(distRoot, relativePath || "index.html");
  if (!insideDist(candidate)) return null;

  try {
    const details = await stat(candidate);
    if (details.isFile()) return candidate;
  } catch {
    if (extname(relativePath)) return null;
  }

  return resolve(distRoot, "index.html");
}

const server = createServer(async (request, response) => {
  const pathname = new URL(request.url || "/", "http://127.0.0.1").pathname;
  if (routeBase !== "/" && pathname === routeBase.slice(0, -1)) {
    response.writeHead(308, { location: routeBase });
    response.end();
    return;
  }

  const filePath = await resolveFile(pathname);
  if (!filePath) {
    sendText(response, 404, "Not found");
    return;
  }

  try {
    await stat(filePath);
    response.writeHead(200, {
      "cache-control":
        extname(filePath) === ".html"
          ? "no-cache"
          : "public, max-age=31536000, immutable",
      "content-type":
        mimeTypes.get(extname(filePath)) || "application/octet-stream",
    });
    if (request.method === "HEAD") {
      response.end();
      return;
    }
    createReadStream(filePath).pipe(response);
  } catch {
    sendText(response, 404, "Not found");
  }
});

server.listen(port, "127.0.0.1", () => {
  console.log(`Serving ${distRoot} at http://127.0.0.1:${port}${routeBase}`);
});
