import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@virasat/core", "@virasat/db", "@virasat/i18n", "@virasat/ui-tokens"],
  poweredByHeader: false,
  // The dev-mode badge sits over bottom-corner controls on phone-sized screens.
  devIndicators: false,
};

export default config;
