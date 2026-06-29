/**
 * Vercel build — uses Vite's programmatic API so we never rely on `vite` on PATH (exit 127).
 */
const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const vitePkg = path.join(root, "node_modules", "vite", "package.json");

function ensureDependencies() {
  if (fs.existsSync(vitePkg)) return;
  console.log("vite not installed — running npm install...");
  execSync("npm install", { stdio: "inherit", cwd: root, env: process.env });
  if (!fs.existsSync(vitePkg)) {
    throw new Error("vite package missing after npm install");
  }
}

async function runBuild() {
  ensureDependencies();
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
