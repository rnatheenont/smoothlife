// Plain layout wrapper — no entrance animation. Kept as a component (rather
// than removing every call site) so callers don't need to change.
export default function StaggerReveal({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <div className={className}>{children}</div>;
}
