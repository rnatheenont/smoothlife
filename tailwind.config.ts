import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          emerald: "#00A87B",
          teal: "#00B39B",
          sky: "#00AEEF",
          blue: "#0091E6",
          dark: "#0B3B36",
          ink: "#0F172A",
        },
        surface: {
          soft: "#F4FAF8",
          muted: "#EEF3F2",
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
      boxShadow: {
        card: "0 2px 14px rgba(15, 23, 42, 0.06)",
        cardHover: "0 10px 30px rgba(0, 168, 123, 0.15)",
      },
      borderRadius: {
        xl2: "1.25rem",
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.4s ease-out both",
      },
    },
  },
  plugins: [],
};

export default config;
