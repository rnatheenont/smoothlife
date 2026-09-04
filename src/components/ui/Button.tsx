import Link from "next/link";
import clsx from "clsx";
import { Loader2 } from "lucide-react";

// The site's primary call-to-action, written once.
//
// Before this existed, `bg-brand-gradient` was hand-assembled 272 times across
// 90 files, and the copies had drifted: disabled buttons faded to 40%, 50% or
// 60% depending on the file, some had a hover state and some didn't, padding
// ranged over py-2.5/3/3.5, and the weight was font-semibold in one place and
// font-bold in the next. None of that variation was a design decision.
//
// Not marked "use client": it holds no state, so it compiles into whichever
// bundle imports it rather than dragging server pages onto the client.

type Variant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const VARIANT: Record<Variant, string> = {
  primary: "bg-brand-gradient text-white hover:opacity-90",
  secondary:
    "border border-slate-200 bg-white text-slate-700 hover:border-brand-teal hover:bg-brand-gradient-soft " +
    "dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-brand-teal dark:hover:bg-slate-800",
  // brand-800, not the brand-600 fill: at 5.63 on white it is the lightest
  // step that carries readable text (see the ladder in tailwind.config.ts).
  // `dark:bg-none` is load-bearing: brand-gradient-soft is a backgroundImage,
  // and a dark backgroundColor paints *behind* it, so without this the pale
  // gradient survives into dark mode and the light text sits on top of it.
  soft:
    "bg-brand-gradient-soft text-brand-800 hover:brightness-95 " +
    "dark:bg-none dark:bg-slate-800 dark:text-brand-200",
  ghost: "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800",
  danger: "bg-rose-600 text-white hover:bg-rose-700",
};

const SIZE: Record<Size, string> = {
  sm: "px-4 py-2 text-xs gap-1.5",
  md: "px-5 py-2.5 text-sm gap-2",
  lg: "px-6 py-3.5 text-sm gap-2",
};

/**
 * Shared by every variant. The focus ring is the part that did not exist
 * anywhere before: the codebase had zero `focus-visible` rules, so a keyboard
 * user could not see which control they were on. `focus-visible` rather than
 * `focus` keeps it invisible to mouse users, which is why it can be added
 * globally without changing how the site looks to anyone clicking.
 */
const BASE =
  "inline-flex items-center justify-center rounded-full font-semibold transition " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-600 focus-visible:ring-offset-2 " +
  "dark:focus-visible:ring-offset-slate-950 " +
  "disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50";

type CommonProps = {
  variant?: Variant;
  size?: Size;
  fullWidth?: boolean;
  loading?: boolean;
  className?: string;
  children: React.ReactNode;
};

type ButtonProps = CommonProps &
  Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "children" | "className"> & { href?: undefined };

type LinkProps = CommonProps &
  Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "children" | "className" | "href"> & { href: string };

export default function Button(props: ButtonProps | LinkProps) {
  const {
    variant = "primary",
    size = "md",
    fullWidth,
    loading,
    className,
    children,
    ...rest
  } = props;

  const classes = clsx(BASE, VARIANT[variant], SIZE[size], fullWidth && "w-full", className);
  const content = (
    <>
      {loading && <Loader2 size={size === "sm" ? 13 : 15} className="animate-spin" aria-hidden />}
      {children}
    </>
  );

  if (typeof props.href === "string") {
    const { href, ...anchorRest } = rest as Omit<LinkProps, keyof CommonProps>;
    return (
      <Link href={href} className={classes} {...anchorRest}>
        {content}
      </Link>
    );
  }

  const buttonRest = rest as Omit<ButtonProps, keyof CommonProps>;
  return (
    <button
      {...buttonRest}
      // Defaults to "button": inside a <form>, HTML's default of "submit"
      // makes an unrelated button submit the form, which is never what the
      // caller meant when they didn't say.
      type={buttonRest.type ?? "button"}
      // A loading button must not be pressable twice — the duplicate-order
      // guard the hand-written copies kept forgetting.
      disabled={buttonRest.disabled || loading}
      aria-busy={loading || undefined}
      className={classes}
    >
      {content}
    </button>
  );
}
