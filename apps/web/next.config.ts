import type { NextConfig } from "next";

const config: NextConfig = {
  // Workspace packages ship TypeScript source; Next compiles them.
  transpilePackages: [
    "@virasat/ai",
    "@virasat/core",
    "@virasat/db",
    "@virasat/i18n",
    "@virasat/jobs",
    "@virasat/ui-tokens",
  ],
  poweredByHeader: false,
  // The dev-mode badge sits over bottom-corner controls on phone-sized screens.
  devIndicators: false,
  headers() {
    // Recording links carry a secret token: never leak it in a Referer, never index it.
    return Promise.resolve([
      {
        source: "/record/:path*",
        headers: [
          { key: "Referrer-Policy", value: "no-referrer" },
          { key: "X-Robots-Tag", value: "noindex, nofollow" },
          { key: "Cache-Control", value: "no-store" },
        ],
      },
    ]);
  },
};

export default config;
