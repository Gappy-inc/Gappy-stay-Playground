import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

// Wire lib/i18n/request.ts to next-intl. The default lookup path is
// ./src/i18n/request.ts | ./i18n/request.ts — we keep i18n under lib/.
const withNextIntl = createNextIntlPlugin("./lib/i18n/request.ts");

const nextConfig: NextConfig = {
  // Pin workspace root so Turbopack does not auto-infer it from a stray
  // lockfile in a parent directory (e.g. ~/package-lock.json). When the
  // inferred root drifts up, file conventions like proxy.ts can be
  // missed entirely under dev.
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },
};

export default withNextIntl(nextConfig);
