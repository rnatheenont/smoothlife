import { NextRequest, NextResponse } from "next/server";
import { postcodeIndex } from "@/data/postcodes.generated";

export const runtime = "nodejs";

type Match = { province: string; district: string; subdistricts: string[] };

// Every lookup shape the address forms need, all built once per warm lambda
// from the same raw postcode|province|district|subdistricts,... lines:
//   - byZip: postcode -> province/district (existing "type the postcode" flow)
//   - provinces: full sorted list, for the "pick province first" flow
//   - byProvince: province -> its districts
//   - byProvinceDistrict: province|district -> {subdistrict, postal_code}[]
type Indices = {
  byZip: Map<string, Match[]>;
  provinces: string[];
  byProvince: Map<string, Set<string>>;
  byProvinceDistrict: Map<string, Map<string, string>>; // subdistrict -> postal_code
};

let indices: Indices | null = null;

function getIndices(): Indices {
  if (indices) return indices;
  const byZip = new Map<string, Match[]>();
  const provinceSet = new Set<string>();
  const byProvince = new Map<string, Set<string>>();
  const byProvinceDistrict = new Map<string, Map<string, string>>();

  for (const line of postcodeIndex) {
    const [zip, province, district, subs] = line.split("|");
    if (!zip || !province || !district) continue;
    const subdistricts = (subs || "").split(",").filter(Boolean);

    const zipList = byZip.get(zip) || [];
    zipList.push({ province, district, subdistricts });
    byZip.set(zip, zipList);

    provinceSet.add(province);
    const districtSet = byProvince.get(province) || new Set<string>();
    districtSet.add(district);
    byProvince.set(province, districtSet);

    const key = `${province}|${district}`;
    const subMap = byProvinceDistrict.get(key) || new Map<string, string>();
    for (const sub of subdistricts) {
      if (!subMap.has(sub)) subMap.set(sub, zip); // first postcode seen wins
    }
    byProvinceDistrict.set(key, subMap);
  }

  indices = {
    byZip,
    provinces: [...provinceSet].sort((a, b) => a.localeCompare(b, "th")),
    byProvince,
    byProvinceDistrict,
  };
  return indices;
}

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const mode = params.get("mode");
  const idx = getIndices();

  if (idx.byZip.size === 0) {
    return NextResponse.json({ available: false, matches: [], provinces: [], districts: [], subdistricts: [] });
  }

  if (mode === "provinces") {
    return NextResponse.json({ available: true, provinces: idx.provinces });
  }

  if (mode === "districts") {
    const province = (params.get("province") || "").trim();
    const districts = [...(idx.byProvince.get(province) || [])].sort((a, b) => a.localeCompare(b, "th"));
    return NextResponse.json({ available: true, districts });
  }

  if (mode === "subdistricts") {
    const province = (params.get("province") || "").trim();
    const district = (params.get("district") || "").trim();
    const subMap = idx.byProvinceDistrict.get(`${province}|${district}`);
    const subdistricts = subMap
      ? [...subMap.entries()]
          .map(([name, postal_code]) => ({ name, postal_code }))
          .sort((a, b) => a.name.localeCompare(b.name, "th"))
      : [];
    return NextResponse.json({ available: true, subdistricts });
  }

  const code = (params.get("code") || "").trim();
  if (!/^\d{5}$/.test(code)) {
    return NextResponse.json({ available: true, matches: [] });
  }
  return NextResponse.json({
    available: true,
    matches: idx.byZip.get(code) || [],
  });
}
