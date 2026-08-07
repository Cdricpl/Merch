import js from "@eslint/js";
import tseslint from "typescript-eslint";
import reactHooks from "eslint-plugin-react-hooks";

// Configuration volontairement minimale : le seul but est d'attraper les
// erreurs qui ne se voient qu'en production minifiée — au premier rang
// desquelles l'ordre des hooks (React #300, « Rendered fewer hooks than
// expected »), qui se produit dès qu'un hook est appelé après un return
// conditionnel. C'est arrivé une fois ; le linter le bloque désormais.
export default tseslint.config(
  { ignores: ["dist-pages/**", "node_modules/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["src/**/*.{ts,tsx}"],
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-hooks/rules-of-hooks": "error",
      // Les dépendances manquantes sont signalées sans casser le build : on en
      // omet sciemment certaines (callbacks à identité stable, par exemple).
      "react-hooks/exhaustive-deps": "warn",
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
  {
    files: ["public/sw.js"],
    languageOptions: { globals: { self: "readonly", caches: "readonly", fetch: "readonly", URL: "readonly", Response: "readonly" } },
  },
);
