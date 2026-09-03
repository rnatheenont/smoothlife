// ClickUp is where a conversation goes when answering it isn't the end of it —
// a complaint, a return, anything needing follow-up work after the chat closes
// (plan §7.4). The inbox stays the place for live replies; ClickUp is the
// place for work that outlives the conversation. Sending everything there
// would bury the real cases under "what size is this bottle".

const API = "https://api.clickup.com/api/v2";
const TOKEN = process.env.CLICKUP_API_TOKEN;
const LIST_ID = process.env.CLICKUP_LIST_ID;

export function clickUpConfigured() {
  return Boolean(TOKEN && LIST_ID);
}

export type ClickUpTask = { id: string; url: string };

/**
 * Creates a task and returns its id and URL.
 *
 * Throws rather than returning null on failure: the caller has just promised a
 * staff member their case was filed, and swallowing the error would leave a
 * customer complaint existing nowhere at all.
 */
export async function createClickUpTask(opts: {
  name: string;
  description: string;
  /** ClickUp priority: 1 urgent, 2 high, 3 normal, 4 low. */
  priority?: 1 | 2 | 3 | 4;
}): Promise<ClickUpTask> {
  if (!clickUpConfigured()) {
    throw new Error("ClickUp not configured — set CLICKUP_API_TOKEN and CLICKUP_LIST_ID");
  }

  const res = await fetch(`${API}/list/${LIST_ID}/task`, {
    method: "POST",
    headers: {
      // ClickUp's personal tokens go in Authorization verbatim — no "Bearer".
      Authorization: TOKEN!,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      name: opts.name.slice(0, 250),
      description: opts.description.slice(0, 8000),
      ...(opts.priority ? { priority: opts.priority } : {}),
    }),
  });

  const raw = await res.text();
  if (!res.ok) {
    throw new Error(`ClickUp task create failed: HTTP ${res.status} ${raw.slice(0, 300)}`);
  }
  const data = JSON.parse(raw) as { id?: string; url?: string };
  if (!data.id) throw new Error(`ClickUp returned no task id: ${raw.slice(0, 200)}`);

  return {
    id: data.id,
    // The API has always returned a url, but constructing the fallback costs
    // nothing and a case with no link is a case nobody opens.
    url: data.url || `https://app.clickup.com/t/${data.id}`,
  };
}
