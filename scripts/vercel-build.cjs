/**
 * Vercel build — uses Vite's programmatic API so we never rely on `vite` on PATH (exit 127).
 */
const path = require("path");

const root = path.join(__dirname, "..");

async function runBuild() {
  process.env.VERCEL = process.env.VERCEL || "1";

  const { build } = await import("vite");
  await build({
    root,
    configFile: path.join(root, "vite.config.js"),
    logLevel: "info",
  });
}

runBuild().catch((err) => {
  console.error(err);
  process.exit(1);
});
