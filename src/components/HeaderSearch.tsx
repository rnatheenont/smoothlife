"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";
import SearchSuggestions from "./SearchSuggestions";

// Self-contained search box + live results dropdown, used for both the
// desktop header bar and the mobile drawer's search field — each instance
// keeps its own query/open state rather than sharing it through Header, so
// neither has to know the other exists.
export default function HeaderSearch({
  placeholder,
  inputClassName,
  buttonClassName,
  buttonSize = 15,
  onNavigate,
}: {
  placeholder: string;
  inputClassName: string;
  buttonClassName: string;
  buttonSize?: number;
  onNavigate?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onDocMouseDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDocMouseDown);
    return () => document.removeEventListener("mousedown", onDocMouseDown);
  }, [open]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
    setOpen(false);
    onNavigate?.();
  }

  function handleSelect() {
    setOpen(false);
    setQuery("");
    onNavigate?.();
  }

  return (
    <div ref={wrapRef} className="relative flex-1">
      <form onSubmit={submit} className="flex">
        <input
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => query.trim() && setOpen(true)}
          type="text"
          placeholder={placeholder}
          className={inputClassName}
        />
        <button type="submit" className={buttonClassName} aria-label="ค้นหา">
          <Search size={buttonSize} />
        </button>
      </form>
      {open && <SearchSuggestions query={query} onSelect={handleSelect} />}
    </div>
  );
}
