/* eslint-disable */
// Pulls a Thai province/district/subdistrict dataset at build time and writes a
// compact postcode index to src/data/postcodes.generated.ts. Server-side only —
// the index is queried through /api/postcode so it never ships to the browser.
// If every source fails the build still succeeds; the address form then falls
// back to manual entry with validation but no auto-fill.

const fs = require("fs");
const path = require("path");

const OUT = path.join(__dirname, "..", "src", "data", "postcodes.generated.ts");

const SOURCES = [
  "https://raw.githubusercontent.com/kongvut/thai-province-data/master/data/raw/sub_districts.json",
  "https://raw.githubusercontent.com/parsilver/thailand-address/main/database/tambons.json",
  "https://raw.githubusercontent.com/Sitthiphong/thailand-address/master/thailand-address.json",
];

const PROVINCE_SRC = [
  "https://raw.githubusercontent.com/kongvut/thai-province-data/master/data/raw/provinces.json",
];
const AMPHURE_SRC = [
  "https://raw.githubusercontent.com/kongvut/thai-province-data/master/data/raw/districts.json",
];

async function getJson(url) {
  const res = await fetch(url, {
    headers: { "user-agent": "SmoothLifeDemoBuild/1.0", accept: "application/json" },
  });
  if (!res.ok) throw new Error("HTTP " + res.status);
  return res.json();
}

async function firstOk(urls) {
  let lastErr;
  for (const u of urls) {
    try {
      const j = await getJson(u);
      if (j && (Array.isArray(j) ? j.length : Object.keys(j).length)) {
        console.log("  source ok: " + u);
        return j;
      }
    } catch (e) {
      lastErr = e;
    }
  }
  throw lastErr || new Error("no source responded");
}

function nameTh(row, keys) {
  for (const k of keys) if (row && row[k]) return String(row[k]).trim();
  return "";
}

async function buildFromKongvut() {
  const [tambons, amphures, provinces] = await Promise.all([
    firstOk([SOURCES[0]]),
    firstOk(AMPHURE_SRC),
    firstOk(PROVINCE_SRC),
  ]);
  const provById = new Map(provinces.map((p) => [p.id, nameTh(p, ["name_th", "name"])]));
  const ampById = new Map(
    amphures.map((a) => [a.id, { name: nameTh(a, ["name_th", "name"]), province: a.province_id }])
  );

  const rows = [];
  for (const t of tambons) {
    const zip = String(t.zip_code || t.zipcode || "").padStart(5, "0");
    if (!/^\d{5}$/.test(zip)) continue;
    const amp = ampById.get(t.district_id || t.amphure_id);
    if (!amp) continue;
    const province = provById.get(amp.province) || "";
    const sub = nameTh(t, ["name_th", "name"]);
    if (!province || !amp.name || !sub) continue;
    rows.push([zip, province, amp.name, sub]);
  }
  return rows;
}

async function buildGeneric() {
  const data = await firstOk(SOURCES.slice(1));
  const list = Array.isArray(data) ? data : Object.values(data).flat();
  const rows = [];
  for (const r of list) {
    const zip = String(
      r.zipcode || r.zip_code || r.postcode || r.post_code || ""
    ).padStart(5, "0");
    if (!/^\d{5}$/.test(zip)) continue;
    const province = nameTh(r, ["province", "province_name", "changwat"]);
    const district = nameTh(r, ["amphoe", "district", "amphure", "amphur"]);
    const sub = nameTh(r, ["district", "tambon", "subdistrict", "sub_district"]);
    if (!province || !district || !sub) continue;
    rows.push([zip, province, district, sub]);
  }
  return rows;
}

function serialise(rows) {
  // "zip:province:district:sub1,sub2,..." — one line per zip+district pair.
  const byKey = new Map();
  for (const [zip, province, district, sub] of rows) {
    const key = zip + "\u0001" + province + "\u0001" + district;
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key).add(sub);
  }
  const lines = [...byKey.entries()]
    .map(([key, subs]) => {
      const [zip, province, district] = key.split("\u0001");
      return `${zip}|${province}|${district}|${[...subs].join(",")}`;
    })
    .sort();
  return (
    "// AUTO-GENERATED at build time — do not edit. Server-side only.\n" +
    "// Format: postcode|province|district|subdistrict,subdistrict,...\n" +
    "export const postcodeIndex: string[] = " +
    JSON.stringify(lines) +
    ";\n"
  );
}

async function main() {
  console.log("[postcodes] fetching Thai address dataset");
  let rows = [];
  try {
    rows = await buildFromKongvut();
  } catch (e) {
    console.log("  primary source failed (" + e.message + "), trying alternates");
    rows = await buildGeneric();
  }
  if (rows.length < 1000) throw new Error("only " + rows.length + " rows");
  fs.writeFileSync(OUT, serialise(rows), "utf8");
  const zips = new Set(rows.map((r) => r[0]));
  console.log(
    "[postcodes] wrote " + zips.size + " postcodes / " + rows.length + " subdistricts"
  );
}

main().catch((e) => {
  console.warn("[postcodes] lookup unavailable, form falls back to manual entry:", e.message);
  if (!fs.existsSync(OUT)) {
    fs.writeFileSync(OUT, "export const postcodeIndex: string[] = [];\n", "utf8");
  }
  process.exit(0);
});
