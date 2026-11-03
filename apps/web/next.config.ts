import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: ["@virasat/core", "@virasat/i18n", "@virasat/ui-tokens"],
  poweredByHeader: false,
};

export default config;
