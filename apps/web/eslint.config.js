import nextVitals from "eslint-config-next/core-web-vitals";
import { baseConfig } from "../../eslint.config.js";

// Next's config sets its own TS parser; the shared config goes last so type-aware linting wins.
const config = [...nextVitals, ...baseConfig, { ignores: ["next-env.d.ts"] }];

export default config;
