#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync } from "fs";
import { join } from "path";

const distDir = join(process.cwd(), "dist");
const zipFile = join(process.cwd(), "cspbypass-extension.zip");

// Check if dist directory exists
if (!existsSync(distDir)) {
  console.error("❌ dist directory not found. Run 'bun run build' first.");
  process.exit(1);
}

// Remove old zip if it exists
if (existsSync(zipFile)) {
  await $`rm ${zipFile}`;
  console.log("🗑️  Removed old zip file");
}

// Create zip file from dist directory contents
console.log("📦 Creating zip file for Chrome Web Store...");
await $`cd ${distDir} && zip -r ${zipFile} .`.quiet();

if (existsSync(zipFile)) {
  console.log(`\n✅ Success! Created ${zipFile}`);
  console.log("📤 Ready to upload to Chrome Web Store!");
  console.log("   Go to: https://chrome.google.com/webstore/devconsole");
} else {
  console.error("❌ Failed to create zip file");
  process.exit(1);
}
