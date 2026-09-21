import { NextRequest, NextResponse } from "next/server";
import { getAdminSession, verifyAdminToken, ADMIN_COOKIE } from "@/lib/admin-auth";
import { pgValue, supabaseRest } from "@/lib/supabase-server";
import { permissionsForRole } from "@/lib/admin-permissions";

export async function GET(req: NextRequest) {
  const token = req.cookies.get(ADMIN_COOKIE)?.value;
  if (!verifyAdminToken(token)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  const session = getAdminSession(token);
  // A legacy shared-password session has no admin_users row to describe —
  // the panel just shows nothing where a name would go, not an error. It is
  // treated as the owner everywhere else (see admin-permissions.ts), so it
  // gets the owner's reach here too rather than an empty menu.
  if (!session) return NextResponse.json({ ok: true, user: null, permissions: ["*"] });

  const [user] = await supabaseRest<{ id: string; display_name: string; email: string; role_key: string }[]>(
    `admin_users?id=eq.${pgValue(session.userId)}&select=id,display_name,email,role_key&limit=1`
  ).catch((): { id: string; display_name: string; email: string; role_key: string }[] => []);
  const permissions = user ? await permissionsForRole(user.role_key) : [];
  return NextResponse.json({ ok: true, user: user ?? null, permissions });
}
