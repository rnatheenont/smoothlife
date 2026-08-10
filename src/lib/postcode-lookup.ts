"use client";

import { useEffect, useState } from "react";

export type PostcodeMatch = { province: string; district: string; subdistricts: string[] };

// Thailand only — /api/postcode is backed by a Thai postcode index, so other
// countries always fall back to manual entry (same rule the checkout address
// form already follows).
export function usePostcodeMatches(postalCode: string, country: string) {
  const [matches, setMatches] = useState<PostcodeMatch[]>([]);

  useEffect(() => {
    if (country !== "TH" || !/^\d{5}$/.test(postalCode)) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/postcode?code=${postalCode}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setMatches(data?.matches || []);
      })
      .catch(() => {
        if (!cancelled) setMatches([]);
      });
    return () => {
      cancelled = true;
    };
  }, [postalCode, country]);

  // Flattened list of every (subdistrict, district, province) combo across
  // all matches, so a zip that spans more than one district still lets the
  // user pick the right one instead of silently guessing the first match.
  const options = matches.flatMap((m) =>
    m.subdistricts.map((sub) => ({
      subdistrict: sub,
      district: m.district,
      province: m.province,
    }))
  );

  return options;
}
