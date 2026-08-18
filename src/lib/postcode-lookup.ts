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

// The reverse direction — pick province, then district, then subdistrict —
// for anyone who knows where they live but not their own postcode.
export function useThaiProvinces(country: string) {
  const [provinces, setProvinces] = useState<string[]>([]);

  useEffect(() => {
    if (country !== "TH") {
      setProvinces([]);
      return;
    }
    let cancelled = false;
    fetch("/api/postcode?mode=provinces")
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setProvinces(data?.provinces || []);
      })
      .catch(() => {
        if (!cancelled) setProvinces([]);
      });
    return () => {
      cancelled = true;
    };
  }, [country]);

  return provinces;
}

export function useThaiDistricts(country: string, province: string) {
  const [districts, setDistricts] = useState<string[]>([]);

  useEffect(() => {
    if (country !== "TH" || !province) {
      setDistricts([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/postcode?mode=districts&province=${encodeURIComponent(province)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setDistricts(data?.districts || []);
      })
      .catch(() => {
        if (!cancelled) setDistricts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [country, province]);

  return districts;
}

export type ThaiSubdistrict = { name: string; postal_code: string };

export function useThaiSubdistricts(country: string, province: string, district: string) {
  const [subdistricts, setSubdistricts] = useState<ThaiSubdistrict[]>([]);

  useEffect(() => {
    if (country !== "TH" || !province || !district) {
      setSubdistricts([]);
      return;
    }
    let cancelled = false;
    fetch(`/api/postcode?mode=subdistricts&province=${encodeURIComponent(province)}&district=${encodeURIComponent(district)}`)
      .then((r) => r.json())
      .then((data) => {
        if (!cancelled) setSubdistricts(data?.subdistricts || []);
      })
      .catch(() => {
        if (!cancelled) setSubdistricts([]);
      });
    return () => {
      cancelled = true;
    };
  }, [country, province, district]);

  return subdistricts;
}
