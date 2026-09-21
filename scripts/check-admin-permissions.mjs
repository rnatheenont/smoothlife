// Fails the build when an admin API route has no permission rule.
//
// The gate in src/proxy.ts already refuses an unlisted route at runtime, so
// nothing ships open either way. This turns that refusal into a build error
// instead of a 403 someone discovers by clicking the button — the difference
// between finding out on your machine and finding out in production.
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";

const ROUTES_DIR = "src/app/api/admin";
const MAP_FILE = "src/lib/admin-route-permissions.ts";

function routeFiles(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...routeFiles(full));
    else if (entry === "route.ts") out.push(full);
  }
  return out;
}

/** "src/app/api/admin/kb/articles/[id]/route.ts" -> "/api/admin/kb/articles/[id]" */
function toPathname(file) {
  return `/${file.replace(/^src\/app\//, "").replace(/\/route\.ts$/, "")}`;
}

const map = readFileSync(MAP_FILE, "utf8");
const prefixes = [...map.matchAll(/prefix:\s*"([^"]+)"/g)].map((m) => m[1]);
const publics = [...map.matchAll(/"(\/api\/admin\/[^"]+)",/g)]
  .map((m) => m[1])
  .filter((p) => map.slice(0, map.indexOf(p)).includes("PUBLIC_ADMIN_ROUTES"));

if (prefixes.length === 0) {
  console.error(`[admin-permissions] no rules found in ${MAP_FILE} — did its shape change?`);
  process.exit(1);
}

const covered = (pathname) =>
  [...prefixes, ...publics].some((p) => pathname === p || pathname.startsWith(`${p}/`));

const missing = routeFiles(ROUTES_DIR).map(toPathname).filter((p) => !covered(p));

if (missing.length > 0) {
  console.error(
    `\n[admin-permissions] ${missing.length} admin route(s) have no permission rule:\n` +
      missing.map((p) => `  ${p}`).join("\n") +
      `\n\nAdd each to ADMIN_ROUTE_RULES in ${MAP_FILE} (narrower paths above broader ones).\n` +
      `Until then they are refused at runtime, which is safe but silent.\n`
  );
  process.exit(1);
}

console.log(`[admin-permissions] ok — every admin route is covered by a rule`);
