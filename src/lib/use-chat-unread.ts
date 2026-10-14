"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { countUnread, getAnonId, readChatSeen } from "@/lib/chat-identity";

/** How often to ask whether a reply has arrived, for someone who is not
 *  looking at the conversation. */
const EVERY_MS = 30_000;

/**
 * Whether a staff reply has arrived since this device last looked.
 *
 * The launcher bubble's badge, and nothing else — so it can show one without
 * loading the conversation. The session hook keeps its own, faster poll for
 * while the panel is open.
 *
 * Two rules, both of which the old version did not have:
 *   • Nobody who has never chatted is polled. There is nothing to tell them,
 *     and every visitor asking a question every 30 seconds for the whole of
 *     their visit is a lot of requests for a badge that cannot appear.
 *   • A hidden tab is not polled at all. The interval used to keep firing
 *     and return early inside, which is the same number of timers.
 */
export function useChatUnread(paused: boolean): number {
  const { user } = useAuth();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    if (paused) {
      setUnread(0);
      return;
    }
    // A conversation exists if they are signed in (it follows the account)
    // or this device has been in one before.
    if (!user && !readChatSeen()) return;

    let cancelled = false;
    let timer: number | undefined;

    async function check() {
      try {
        const qs = user ? "" : `?anonId=${encodeURIComponent(getAnonId())}`;
        const data = await fetch(`/api/chat${qs}`).then((r) => r.json());
        if (cancelled || !Array.isArray(data?.messages)) return;
        setUnread(countUnread(data.messages, data.latestAt));
      } catch {
        // The next one is half a minute away.
      }
    }

    function start() {
      if (timer !== undefined) return;
      void check();
      timer = window.setInterval(check, EVERY_MS);
    }
    function stop() {
      if (timer === undefined) return;
      window.clearInterval(timer);
      timer = undefined;
    }

    function onVisibility() {
      if (document.hidden) stop();
      else start();
    }

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [paused, user]);

  return unread;
}
