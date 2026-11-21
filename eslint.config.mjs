import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

const config = [
  ...nextVitals,
  ...nextTypescript,
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      // The existing React 18 app synchronizes local UI state from async data and browser APIs in effects.
      "react-hooks/set-state-in-effect": "off",
    },
  },
];

export default config;
