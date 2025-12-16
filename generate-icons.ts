#!/usr/bin/env bun

import { $ } from "bun";
import { existsSync, mkdirSync, copyFileSync } from "fs";
import { join } from "path";

const iconsDir = join(process.cwd(), "dist", "icons");
const srcImage = join(process.cwd(), "csp_logo.png");

// Create icons directory if it doesn't exist
if (!existsSync(iconsDir)) {
  mkdirSync(iconsDir, { recursive: true });
}

// Try sips (macOS built-in)
const hasSips = await $`which sips`
  .quiet()
  .nothrow()
  .then((r) => r.exitCode === 0);

if (hasSips && existsSync(srcImage)) {
  console.log("🖼️  Generating icons from csp_logo.png using sips (macOS)...");

  try {
    await $`sips -z 16 16 ${srcImage} --out ${join(iconsDir, "icon16.png")}`;
    await $`sips -z 48 48 ${srcImage} --out ${join(iconsDir, "icon48.png")}`;
    await $`sips -z 128 128 ${srcImage} --out ${join(iconsDir, "icon128.png")}`;
    console.log("✅ Icons generated successfully using sips!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error generating icons with sips:", error);
  }
}

// Try ImageMagick
const hasImageMagick = await $`which convert`
  .quiet()
  .nothrow()
  .then((r) => r.exitCode === 0);

if (hasImageMagick && existsSync(srcImage)) {
  console.log("🖼️  Generating icons from csp_logo.png using ImageMagick...");

  try {
    await $`convert ${srcImage} -resize 16x16 ${join(iconsDir, "icon16.png")}`;
    await $`convert ${srcImage} -resize 48x48 ${join(iconsDir, "icon48.png")}`;
    await $`convert ${srcImage} -resize 128x128 ${join(
      iconsDir,
      "icon128.png"
    )}`;
    console.log("✅ Icons generated successfully using ImageMagick!");
    process.exit(0);
  } catch (error) {
    console.error("❌ Error generating icons with ImageMagick:", error);
  }
}

// Fallback: Create minimal placeholder icons
console.log("📦 Creating minimal placeholder icons...");

// Create a simple 1x1 PNG data URL and write it as a file
// This is a minimal valid PNG (1x1 transparent pixel)
const minimalPNG = Buffer.from([
  0x89,
  0x50,
  0x4e,
  0x47,
  0x0d,
  0x0a,
  0x1a,
  0x0a, // PNG signature
  0x00,
  0x00,
  0x00,
  0x0d,
  0x49,
  0x48,
  0x44,
  0x52, // IHDR chunk
  0x00,
  0x00,
  0x00,
  0x01,
  0x00,
  0x00,
  0x00,
  0x01, // 1x1 dimensions
  0x08,
  0x06,
  0x00,
  0x00,
  0x00,
  0x1f,
  0x15,
  0xc4,
  0x89,
  0x00,
  0x00,
  0x00,
  0x0a,
  0x49,
  0x44,
  0x41,
  0x54,
  0x78,
  0x9c,
  0x63,
  0x00,
  0x01,
  0x00,
  0x00,
  0x05,
  0x00,
  0x01,
  0x0d,
  0x0a,
  0x2d,
  0xb4,
  0x00,
  0x00,
  0x00,
  0x00,
  0x49,
  0x45,
  0x4e,
  0x44,
  0xae,
  0x42,
  0x60,
  0x82,
]);

// For now, let's use a better approach - copy the source image and resize if possible
// Or create a simple colored square icon
if (existsSync(srcImage)) {
  // Try to use the source image directly for now (Chrome will scale it)
  console.log("📋 Copying source image as placeholder...");
  copyFileSync(srcImage, join(iconsDir, "icon16.png"));
  copyFileSync(srcImage, join(iconsDir, "icon48.png"));
  copyFileSync(srcImage, join(iconsDir, "icon128.png"));
  console.log("⚠️  Placeholder icons created (using source image).");
  console.log("   Chrome will scale these, but for best results:");
  console.log("   - Install ImageMagick: brew install imagemagick");
  console.log("   - Or use an image editor to create proper sized icons");
} else {
  // Fallback to old logo if new one doesn't exist
  const fallbackImage = join(process.cwd(), "cspbypass.png");
  if (existsSync(fallbackImage)) {
    console.log("📋 Using fallback logo (cspbypass.png)...");
    copyFileSync(fallbackImage, join(iconsDir, "icon16.png"));
    copyFileSync(fallbackImage, join(iconsDir, "icon48.png"));
    copyFileSync(fallbackImage, join(iconsDir, "icon128.png"));
  } else {
    // Create minimal valid PNG files
    await Bun.write(join(iconsDir, "icon16.png"), minimalPNG);
    await Bun.write(join(iconsDir, "icon48.png"), minimalPNG);
    await Bun.write(join(iconsDir, "icon128.png"), minimalPNG);
    console.log("⚠️  Minimal placeholder icons created.");
    console.log("   Please replace these with proper icons:");
    console.log("   - dist/icons/icon16.png (16x16 pixels)");
    console.log("   - dist/icons/icon48.png (48x48 pixels)");
    console.log("   - dist/icons/icon128.png (128x128 pixels)");
  }
}
