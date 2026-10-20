/**
 * The IndexNow key, served so the engines can check that whoever submits
 * URLs for this host actually controls it.
 *
 * The key is not a secret — proving control is the whole job, and it is
 * published on purpose. It lives in an environment variable rather than in
 * this file so that rotating it is a setting rather than a deploy.
 *
 * The response is the key and nothing else: no newline, no JSON, no
 * surrounding text. The engines compare the file's contents to the key in
 * the submission byte for byte.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const key = process.env.INDEXNOW_KEY;
  if (!key) return new Response("Not found", { status: 404 });

  return new Response(key, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
