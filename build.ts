#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";

const distDir = join(process.cwd(), "dist");
const srcDir = process.cwd();

// Clean and create dist directory
if (existsSync(distDir)) {
  await $`rm -rf ${distDir}`;
}
mkdirSync(distDir, { recursive: true });

// Copy necessary files
const filesToCopy = [
  "manifest.json",
  "popup.html",
  "popup.js",
  "background.js",
];

for (const file of filesToCopy) {
  const src = join(srcDir, file);
  const dest = join(distDir, file);
  if (existsSync(src)) {
    copyFileSync(src, dest);
    console.log(`✓ Copied ${file}`);
  } else {
    console.warn(`⚠ File not found: ${file}`);
  }
}

// Create icons directory if it doesn't exist
const iconsDir = join(distDir, "icons");
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// Check if icons exist, if not, try to generate them
const icon16 = join(iconsDir, "icon16.png");
const icon48 = join(iconsDir, "icon48.png");
const icon128 = join(iconsDir, "icon128.png");

if (!existsSync(icon16) || !existsSync(icon48) || !existsSync(icon128)) {
  console.log("⚠ Icons not found. Attempting to generate them...");
  try {
    // Import and run the icon generation
    const { spawn } = await import("child_process");
    const { promisify } = await import("util");
    const exec = promisify(spawn);
    
    const result = await $`bun run generate-icons.ts`.quiet();
    if (result.exitCode === 0) {
      console.log("✓ Icons generated successfully");
    } else {
      console.log("⚠ Could not auto-generate icons. Run 'bun run generate-icons' manually.");
    }
  } catch (error) {
    console.log("⚠ Could not auto-generate icons. Run 'bun run generate-icons' manually.");
  }
}

console.log("\n✅ Build complete! Extension files are in the 'dist' directory.");
console.log("📦 Load the 'dist' directory as an unpacked extension in Chrome.");

