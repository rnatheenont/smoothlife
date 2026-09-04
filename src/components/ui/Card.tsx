import clsx from "clsx";

// The white panel the whole site is built out of. `shadow-card` and
// `rounded-xl2` are the existing values, kept exactly — this wraps the pattern
// rather than restyling it, so a card rendered through here is
// indistinguishable from the 70 files that still hand-write it.

export default function Card({
  as: Tag = "div",
  padded = true,
  interactive,
  className,
  children,
  ...rest
}: {
  as?: "div" | "section" | "article" | "li";
  padded?: boolean;
  /** Adds the hover lift. Only for cards that are themselves a link or button. */
  interactive?: boolean;
  className?: string;
  children: React.ReactNode;
} & React.HTMLAttributes<HTMLElement>) {
  return (
    <Tag
      className={clsx(
        "rounded-xl2 bg-white shadow-card dark:bg-slate-900 dark:shadow-none dark:ring-1 dark:ring-slate-800",
        padded && "p-5",
        interactive && "transition hover:-translate-y-0.5 hover:shadow-cardHover",
        className
      )}
      {...rest}
    >
      {children}
    </Tag>
  );
}
