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
const srcIconsDir = join(srcDir, "icons");
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// Copy icons from source if they exist, otherwise generate them
const icon16 = join(iconsDir, "icon16.png");
const icon48 = join(iconsDir, "icon48.png");
const icon128 = join(iconsDir, "icon128.png");

const srcIcon16 = join(srcIconsDir, "icon16.png");
const srcIcon48 = join(srcIconsDir, "icon48.png");
const srcIcon128 = join(srcIconsDir, "icon128.png");

// Copy icons from source if they exist
if (existsSync(srcIcon16) && existsSync(srcIcon48) && existsSync(srcIcon128)) {
  copyFileSync(srcIcon16, icon16);
  copyFileSync(srcIcon48, icon48);
  copyFileSync(srcIcon128, icon128);
  console.log("✓ Copied icons from source");
} else if (!existsSync(icon16) || !existsSync(icon48) || !existsSync(icon128)) {
  console.log("⚠ Icons not found. Attempting to generate them...");
  try {
    const result = await $`bun run generate-icons.ts`.quiet();
    if (result.exitCode === 0) {
      console.log("✓ Icons generated successfully");
      // Copy generated icons to dist
      if (existsSync(srcIcon16)) copyFileSync(srcIcon16, icon16);
      if (existsSync(srcIcon48)) copyFileSync(srcIcon48, icon48);
      if (existsSync(srcIcon128)) copyFileSync(srcIcon128, icon128);
    } else {
      console.log(
        "⚠ Could not auto-generate icons. Run 'bun run generate-icons' manually."
      );
    }
  } catch (error) {
    console.log(
      "⚠ Could not auto-generate icons. Run 'bun run generate-icons' manually."
    );
  }
}

console.log(
  "\n✅ Build complete! Extension files are in the 'dist' directory."
);
console.log("📦 Load the 'dist' directory as an unpacked extension in Chrome.");
