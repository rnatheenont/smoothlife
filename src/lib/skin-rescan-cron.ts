import { supabaseRest } from "@/lib/supabase-server";
import { RESCAN_AFTER_DAYS } from "@/lib/skin-coach";
import { lineOpenLink, linePushConfigured, pushLineText } from "@/lib/line-push";

// Daily: members whose latest saved Skin Coach scan is RESCAN_AFTER_DAYS old
// get one nudge to check again — a bell notification always, a LINE message
// too once the OA is connected. Only people who chose to save a scan are
// ever reminded, and the scan is stamped so it's one reminder per scan.

type Due = { user_id: string; scan_id: string; scanned_at: string; skin_age: number };

export async function remindSkinRescans() {
  const due = await supabaseRest<Due[]>("rpc/skin_rescan_due", {
    method: "POST",
    body: JSON.stringify({ p_days: RESCAN_AFTER_DAYS }),
  }).catch((err) => {
    console.error("[skin-rescan] due lookup failed", err);
    return [] as Due[];
  });

  const weeks = Math.round(RESCAN_AFTER_DAYS / 7);
  let notified = 0;
  let pushed = 0;
  for (const scan of due) {
    // No result in the text: a notification or LINE message can be seen on a
    // lock screen, and it outlives the scan if the member deletes it.
    const body = "สแกนอีกครั้งเพื่อดูว่าผิวเปลี่ยนไปแค่ไหนตั้งแต่ครั้งก่อน ใช้เวลาไม่ถึงนาที";
    try {
      await supabaseRest("notifications", {
        method: "POST",
        returning: false,
        body: JSON.stringify({
          user_id: scan.user_id,
          type: "skin_rescan",
          title: `ครบ ${weeks} สัปดาห์แล้ว มาเช็คผิวอีกครั้งไหม`,
          body,
          link: "/skin-coach",
          metadata: { scanId: scan.scan_id },
        }),
      });
      notified++;

      if (linePushConfigured()) {
        const [line] = await supabaseRest<{ provider_uid: string }[]>(
          `auth_identities?user_id=eq.${scan.user_id}&provider=eq.line&select=provider_uid&limit=1`
        );
        if (line && (await pushLineText(line.provider_uid, `ครบ ${weeks} สัปดาห์แล้ว มาเช็คผิวอีกครั้งไหม\n${body}\n${lineOpenLink("/skin-coach")}`))) {
          pushed++;
        }
      }

      // Stamped last, so a failure above leaves it due for tomorrow's run.
      await supabaseRest(`skin_scans?id=eq.${scan.scan_id}`, {
        method: "PATCH",
        returning: false,
        body: JSON.stringify({ reminded_at: new Date().toISOString() }),
      });
    } catch (err) {
      console.error("[skin-rescan] reminder failed", scan.scan_id, err);
    }
  }
  return { due: due.length, notified, pushed };
}
