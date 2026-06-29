/**
 * Vercel build entrypoint — does not rely on `vite` being on PATH (avoids exit 127).
 */
const { execFileSync, execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const root = path.join(__dirname, "..");
const viteBin = path.join(root, "node_modules", "vite", "bin", "vite.js");

function ensureViteInstalled() {
  if (fs.existsSync(viteBin)) return;
  console.log("vite binary missing — running npm install...");
  execSync("npm install", { stdio: "inherit", cwd: root, env: process.env });
  if (!fs.existsSync(viteBin)) {
    throw new Error(`vite not found at ${viteBin} after npm install`);
  }
}

ensureViteInstalled();

execFileSync(process.execPath, [viteBin, "build"], {
  stdio: "inherit",
  cwd: root,
  env: process.env,
});
