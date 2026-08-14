// Public-facing leaderboard names show a real first name + last-initial only
// (e.g. "Natheenont S.") — never the full name — since points_balance rank
// is visible to every member, not just the account owner.
export function formatLeaderboardName(displayName: string | null | undefined): string {
  const trimmed = (displayName || "").trim();
  if (!trimmed) return "สมาชิก";
  const parts = trimmed.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[1].charAt(0)}.`;
}
