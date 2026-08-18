import { NextRequest, NextResponse } from "next/server";
import { supabaseRest, supabaseConfigured } from "@/lib/supabase-server";
import { verifySessionToken, SESSION_COOKIE } from "@/lib/session";

export type NotificationRow = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  metadata: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
};

function requireUid(req: NextRequest) {
  return verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value);
}

export async function GET(req: NextRequest) {
  const uid = requireUid(req);
  if (!uid || !supabaseConfigured()) {
    return NextResponse.json({ loggedIn: false, notifications: [], unreadCount: 0 });
  }
  const [notifications, unread] = await Promise.all([
    supabaseRest<NotificationRow[]>(
      `notifications?user_id=eq.${uid}&select=id,type,title,body,link,metadata,read_at,created_at&order=created_at.desc&limit=30`
    ),
    supabaseRest<{ id: string }[]>(`notifications?user_id=eq.${uid}&read_at=is.null&select=id`),
  ]);
  return NextResponse.json({ loggedIn: true, notifications, unreadCount: unread.length });
}
