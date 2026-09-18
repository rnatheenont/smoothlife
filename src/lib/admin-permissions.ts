import { supabaseRest } from "@/lib/supabase-server";
import { getAdminSession, verifyAdminToken, type AdminSession } from "@/lib/admin-auth";

// A legacy shared-password session has no admin_users row and no role, but it
// must keep being able to do everything it could do yesterday — otherwise
// turning this feature on breaks the team's access on day one. So it is
// treated as the highest-privilege role ("owner") everywhere here, rather
// than as "no permissions". Per-user sessions are the only ones actually
// checked against role_permissions.
const LEGACY_ROLE = "owner";

export type Role = { key: string; label: string };

/** role_key -> permission set, '*' meaning every permission. Small and
 *  changes rarely, so a short in-process cache is enough — no need to hit
 *  Supabase on every request just to answer "can this role do X". */
let cache: { at: number; byRole: Map<string, Set<string>> } | null = null;
const CACHE_MS = 30_000;

async function loadPermissions(): Promise<Map<string, Set<string>>> {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache.byRole;
  const rows = await supabaseRest<{ role_key: string; permission: string }[]>(
    "role_permissions?select=role_key,permission"
  ).catch((): { role_key: string; permission: string }[] => []);
  const byRole = new Map<string, Set<string>>();
  for (const row of rows) {
    if (!byRole.has(row.role_key)) byRole.set(row.role_key, new Set());
    byRole.get(row.role_key)!.add(row.permission);
  }
  cache = { at: Date.now(), byRole };
  return byRole;
}

/** Call after editing role_permissions from the admin UI so the change is
 *  visible immediately instead of waiting out the cache window. */
export function invalidatePermissionCache() {
  cache = null;
}

/**
 * Resolves a request's admin cookie to a session (legacy shared-password
 * sessions read as role "owner", see LEGACY_ROLE above) and reports whether
 * that role has the given permission. Returns `{ ok: false }` for a missing
 * or expired cookie — callers should treat that the same as any other failed
 * verifyAdminToken() check.
 */
export async function checkAdminPermission(
  token: string | undefined | null,
  permission: string
): Promise<{ ok: true; session: AdminSession; role: string } | { ok: false }> {
  if (!verifyAdminToken(token)) return { ok: false };
  const session = getAdminSession(token);

  // The role in a per-user token is a snapshot from login — a promotion,
  // demotion, or suspension only reaches someone's *next* login unless this
  // checks the row itself. That lag is fine for a role change (worst case,
  // stale permissions for up to the 12h cookie lifetime), but suspending
  // someone is meant to cut them off immediately (an offboarding, most
  // often), so status is re-checked here on every call rather than trusted
  // from the token.
  if (session) {
    const [row] = await supabaseRest<{ status: string }[]>(
      `admin_users?id=eq.${session.userId}&select=status&limit=1`
    ).catch((): { status: string }[] => []);
    if (!row || row.status !== "active") return { ok: false };
  }

  const role = session?.role ?? LEGACY_ROLE;
  const byRole = await loadPermissions();
  const granted = byRole.get(role);
  if (granted?.has("*") || granted?.has(permission)) return { ok: true, session, role };
  return { ok: false };
}

/**
 * The narrower gate for /admin/users itself (see that route for why it
 * isn't just `checkAdminPermission(token, "users.manage")`): only a
 * per-user session whose role is literally "owner", or a legacy
 * shared-password session, may pass. Suspension is re-checked against the
 * row for the same immediate-cutoff reason as checkAdminPermission above.
 */
export async function checkOwnerSession(
  token: string | undefined | null
): Promise<{ ok: true; session: AdminSession } | { ok: false; reason: "unauthenticated" | "forbidden" }> {
  if (!verifyAdminToken(token)) return { ok: false, reason: "unauthenticated" };
  const session = getAdminSession(token);
  if (!session) return { ok: true, session: null };

  const [row] = await supabaseRest<{ status: string; role_key: string }[]>(
    `admin_users?id=eq.${session.userId}&select=status,role_key&limit=1`
  ).catch((): { status: string; role_key: string }[] => []);
  if (!row || row.status !== "active" || row.role_key !== "owner") return { ok: false, reason: "forbidden" };
  return { ok: true, session };
}
