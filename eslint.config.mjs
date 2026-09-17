import { defineConfig, globalIgnores } from "eslint/config";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default defineConfig([
  ...nextCoreWebVitals,
  {
    // React Compiler advice that arrived with eslint-plugin-react-hooks 7
    // (Next 16). The flagged code predates these rules and works; they stay
    // visible as warnings to fix one component at a time, instead of blocking
    // the upgrade on rewriting ~60 effects at once.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/use-memo": "warn",
      "react-hooks/refs": "warn",
      "react-hooks/purity": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
    },
  },
  globalIgnores([".next/**", "node_modules/**", "public/**", "next-env.d.ts", "src/data/*.generated.ts"]),
]);
