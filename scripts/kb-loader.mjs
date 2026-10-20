// Lets a plain node script import the app's own TypeScript.
//
// The import and the evaluation both need the chunking rules in src/lib/kb.ts,
// and a second copy of those rules in a script is the thing most likely to
// drift: the day somebody changes what the assistant sees, the importer would
// go on writing the old shape and nobody would notice until a search missed.
//
// Two things node cannot do on its own with this codebase: resolve the "@/"
// alias from tsconfig, and add the ".ts" that the source files omit.
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { dirname, resolve as resolvePath } from "node:path";

const SRC = pathToFileURL(resolvePath(dirname(fileURLToPath(import.meta.url)), "..", "src") + "/").href;

export async function resolve(specifier, context, next) {
  let target = specifier;
  if (target.startsWith("@/")) target = SRC + target.slice(2);

  if (!/\.[a-z]+$/i.test(target)) {
    for (const ext of [".ts", ".tsx"]) {
      try {
        const candidate = new URL(target + ext, target.startsWith("file:") ? undefined : context.parentURL);
        if (existsSync(fileURLToPath(candidate))) return next(candidate.href, context);
      } catch {
        // Not a resolvable URL on its own — let node try the original.
      }
    }
  }
  return next(target, context);
}
