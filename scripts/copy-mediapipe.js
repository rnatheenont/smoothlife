// Copies MediaPipe's WASM runtime out of node_modules into public/, so the
// live face scan loads it from this site rather than a third-party CDN, and
// always at the exact version the JS was installed at. Runs before every
// build (see "prebuild"); public/mediapipe is gitignored because it is
// ~15 MB of generated binaries that would otherwise ride along in git.
const fs = require("fs");
const path = require("path");

const src = path.join(__dirname, "..", "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = path.join(__dirname, "..", "public", "mediapipe", "wasm");

if (!fs.existsSync(src)) {
  console.warn("[copy-mediapipe] @mediapipe/tasks-vision not installed — live face scan will fall back to photos");
  process.exit(0);
}
fs.mkdirSync(dest, { recursive: true });
let copied = 0;
for (const file of fs.readdirSync(src)) {
  // The ES-module build is only used with forVisionTasks(path, true); the
  // classic SIMD and no-SIMD builds cover every browser we load it in.
  if (file.includes("_module_")) continue;
  fs.copyFileSync(path.join(src, file), path.join(dest, file));
  copied++;
}
console.log(`[copy-mediapipe] ${copied} files → public/mediapipe/wasm`);
