// Plain layout wrapper — no entrance animation. `stagger` is accepted and
// ignored so existing call sites don't need to change.
export default function StaggerGrid({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
  stagger?: number;
}) {
  return <div className={className}>{children}</div>;
}
