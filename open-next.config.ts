import { defineCloudflareConfig } from "@opennextjs/cloudflare";

export default {
  ...defineCloudflareConfig(),
  // `npm run build` runs the full OpenNext build, so point OpenNext's inner
  // Next.js build at `next build` directly to avoid recursing into it.
  buildCommand: "npx next build",
};
