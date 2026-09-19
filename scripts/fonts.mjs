#!/usr/bin/env node
/**
 * فونت وزیرمتن باینری است و در گیت نگه داشته نمی‌شود؛
 * این اسکریپت وزن‌های لازم را از پکیج npm کنار public می‌گذارد.
 */
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "vazirmatn", "fonts", "webfonts");
const dest = join(root, "apps", "web", "public", "fonts");

if (!existsSync(src)) {
  console.warn("[fonts] پکیج vazirmatn پیدا نشد؛ از این مرحله رد شدیم.");
  process.exit(0);
}

mkdirSync(dest, { recursive: true });
const weights = ["Regular", "Medium", "SemiBold", "Bold"];
let n = 0;
for (const w of weights) {
  const file = `Vazirmatn-${w}.woff2`;
  const from = join(src, file);
  if (existsSync(from)) {
    copyFileSync(from, join(dest, file));
    n += 1;
  }
}
console.log(`[fonts] ${n} وزن فونت در apps/web/public/fonts قرار گرفت.`);
