import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          // Named brand colours the whole site already uses — do not rename or
          // remove these, they appear in 100+ files.
          emerald: "#00A87B",
          teal: "#00B39B",
          sky: "#00AEEF",
          blue: "#0091E6",
          dark: "#0B3B36",
          ink: "#0F172A",

          // Numeric ladder derived from #00A87B (the emerald above sits at
          // 600), merged into the same key so both naming styles coexist.
          // Tints mix toward white; shades mix toward brand.ink so the dark end
          // stays in the same family as body text instead of drifting grey.
          //
          // Contrast on white, measured not guessed:
          //   600 #00a87b → 3.05  large text / UI fills only (AA needs 4.5)
          //   800 #05755f → 5.63  passes AA for body text and links
          //   1000 #09514a → 9.18 passes AAA
          // So: fills and buttons use 600, anything that is *read* uses 800.
          50: "#ebf8f4",
          100: "#d1efe7",
          200: "#9edecd",
          400: "#40be9c",
          600: "#00a87b",
          800: "#05755f",
          1000: "#09514a",
        },
        surface: {
          soft: "#F4FAF8",
          muted: "#EEF3F2",
        },

        // Warm neutral ladder (structure borrowed from the reference system;
        // values are ours). Useful for section backgrounds that shouldn't read
        // as cold grey.
        sand: {
          50: "#faf9f7",
          100: "#f7f6f2",
          200: "#ebe7e1",
          400: "#d4cec4",
          600: "#b2a495",
          800: "#89796c",
          1000: "#675a51",
        },
        // Greys tinted toward brand.ink rather than pure neutral, so borders
        // and muted text sit in the same family as the type colour.
        grey: {
          50: "rgba(15, 23, 42, 0.04)",
          100: "rgba(15, 23, 42, 0.08)",
          200: "#cbd2dc",
          400: "#8d97a8",
          600: "#6b7686",
          800: "#414b5c",
          1000: "#0F172A",
        },
      },
      fontFamily: {
        sans: [
          "var(--font-plex-thai)",
          "ui-sans-serif",
          "system-ui",
          "sans-serif",
        ],
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(90deg, #00A87B 0%, #00B39B 45%, #00AEEF 100%)",
        "brand-gradient-soft": "linear-gradient(135deg, #E6FBF5 0%, #E6F6FE 100%)",
        "brand-radial": "radial-gradient(120% 120% at 100% 0%, #E6F6FE 0%, #F4FAF8 60%)",
      },
      // Type ladder. All names are new — the site keeps using Tailwind's
      // text-sm/base/lg everywhere it already does; these are for new work that
      // wants a designed step rather than a nearest-guess.
      fontSize: {
        h1: ["3.2rem", { lineHeight: "1", letterSpacing: "-0.016em" }],
        h2: ["2.6rem", { lineHeight: "1", letterSpacing: "-0.016em" }],
        h3: ["2rem", { lineHeight: "1", letterSpacing: "-0.016em" }],
        h4: ["1.6rem", { lineHeight: "1.1", letterSpacing: "-0.016em" }],
        h5: ["1.2rem", { lineHeight: "1.1" }],
        h6: ["1rem", { lineHeight: "1.2" }],
        "title-l": ["1.2rem", { lineHeight: "1.2" }],
        title: ["1rem", { lineHeight: "1.2" }],
        "title-s": ["0.9rem", { lineHeight: "1.2" }],
        "body-xl": ["1.4rem", { lineHeight: "1.3" }],
        "body-l": ["1.2rem", { lineHeight: "1.3" }],
        body: ["1rem", { lineHeight: "1.4" }],
        "body-s": ["0.9rem", { lineHeight: "1.4" }],
        "body-xs": ["0.8rem", { lineHeight: "1.4" }],
        label: ["0.75rem", { lineHeight: "1.2" }],
        // Tags get the wide tracking that makes short uppercase-ish labels read
        // as a badge rather than as cramped body text.
        tag: ["0.7rem", { lineHeight: "1", letterSpacing: "0.08em" }],
      },

      // Layered shadows: several very light layers instead of one heavy blur,
      // tinted with brand.ink rather than black. `card`/`cardHover` below are
      // untouched — they are used in 70+ files and changing them would restyle
      // the live shop silently.
      boxShadow: {
        card: "0 1px 2px rgba(15, 23, 42, 0.04), 0 12px 32px -8px rgba(15, 23, 42, 0.08)",
        cardHover: "0 4px 8px rgba(0, 168, 123, 0.06), 0 24px 48px -12px rgba(0, 168, 123, 0.18)",
        "layer-xs":
          "0 3px 3px -1.5px rgba(15,23,42,0.04), 0 1px 1px -0.5px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)",
        "layer-sm":
          "0 6px 6px -3px rgba(15,23,42,0.04), 0 3px 3px -1.5px rgba(15,23,42,0.04), 0 1px 1px -0.5px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)",
        layer:
          "0 12px 12px -6px rgba(15,23,42,0.04), 0 6px 6px -3px rgba(15,23,42,0.04), 0 3px 3px -1.5px rgba(15,23,42,0.04), 0 1px 1px -0.5px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)",
        "layer-lg":
          "0 64px 64px -32px rgba(15,23,42,0.04), 0 32px 32px -16px rgba(15,23,42,0.04), 0 16px 16px -8px rgba(15,23,42,0.04), 0 12px 12px -6px rgba(15,23,42,0.04), 0 6px 6px -3px rgba(15,23,42,0.04), 0 3px 3px -1.5px rgba(15,23,42,0.04), 0 1px 1px -0.5px rgba(15,23,42,0.08), 0 0 0 1px rgba(15,23,42,0.04)",
      },

      borderRadius: {
        xl2: "1.25rem",
        // Only the steps whose names are free. `xl`, `2xl` and `3xl` are
        // deliberately NOT redefined: Tailwind already ships them and the site
        // uses rounded-xl in 49 places and rounded-2xl in 13, so overriding
        // would resize corners across the live site without anyone asking.
        "2xs": "0.1rem",
        xs: "0.2rem",
        s: "0.4rem",
        m: "0.8rem",
        l: "1.2rem",
        circle: "50%",
      },

      // Named spacing steps — usable anywhere Tailwind takes a spacing value
      // (p-, m-, gap-, w-, h-). None of these names exist in the default scale,
      // which is numeric.
      spacing: {
        "2xs": "0.2rem",
        xs: "0.4rem",
        s: "0.8rem",
        m: "1.2rem",
        l: "1.6rem",
        xl: "2.4rem",
        "2xl": "3.2rem",
        "3xl": "4rem",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pop: {
          "0%": { transform: "scale(1)" },
          "35%": { transform: "scale(1.45)" },
          "60%": { transform: "scale(0.9)" },
          "100%": { transform: "scale(1)" },
        },
        slideUp: {
          "0%": { transform: "translateY(100%)" },
          "100%": { transform: "translateY(0)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
        glowPulse: {
          "0%, 100%": { boxShadow: "0 0 0 0 rgba(0, 174, 239, 0.45)" },
          "50%": { boxShadow: "0 0 0 8px rgba(0, 174, 239, 0)" },
        },
        shimmer: {
          "0%": { backgroundPosition: "-200% 0" },
          "100%": { backgroundPosition: "200% 0" },
        },
        floatSlow: {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-8px)" },
        },
        tabPop: {
          "0%": { transform: "scale(1) translateY(0)" },
          "30%": { transform: "scale(0.8) translateY(2px)" },
          "55%": { transform: "scale(1.3) translateY(-4px)" },
          "80%": { transform: "scale(0.95) translateY(0)" },
          "100%": { transform: "scale(1) translateY(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.4s ease-out both",
        pop: "pop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) both",
        slideUp: "slideUp 0.25s cubic-bezier(0.16, 1, 0.3, 1) both",
        marquee: "marquee 16s linear infinite",
        glowPulse: "glowPulse 2s ease-out infinite",
        shimmer: "shimmer 2.5s linear infinite",
        floatSlow: "floatSlow 4s ease-in-out infinite",
        tabPop: "tabPop 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) both",
      },
    },
  },
  plugins: [],
};

export default config;
