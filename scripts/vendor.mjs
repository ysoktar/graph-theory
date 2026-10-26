// Third-party files the site needs at runtime, copied out of node_modules.
// Shared by build.mjs (copies them into dist/) and serve.mjs (serves them in development).
import { readdirSync } from "node:fs";
import { join } from "node:path";

const nm = (...p) => join(import.meta.dirname, "..", "node_modules", ...p);

export function vendorFiles() {
  const files = {
    "vendor/d3.min.js": nm("d3", "dist", "d3.min.js"),
    "vendor/katex/katex.min.js": nm("katex", "dist", "katex.min.js"),
    "vendor/katex/katex.min.css": nm("katex", "dist", "katex.min.css"),
    "vendor/katex/auto-render.min.js": nm("katex", "dist", "contrib", "auto-render.min.js"),
  };
  // Browsers that run this site all support woff2, so the .woff/.ttf fallbacks are never requested.
  for (const f of readdirSync(nm("katex", "dist", "fonts"))) {
    if (f.endsWith(".woff2")) files[`vendor/katex/fonts/${f}`] = nm("katex", "dist", "fonts", f);
  }
  return files;
}
