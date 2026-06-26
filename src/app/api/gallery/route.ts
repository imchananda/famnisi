import { readdir } from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";

const imageExtensions = new Set([".jpg", ".jpeg", ".png", ".webp", ".avif"]);

export async function GET() {
  const galleryDir = path.join(process.cwd(), "public", "images", "gall");

  try {
    const files = await readdir(galleryDir, { withFileTypes: true });
    const items = files
      .filter((file) => file.isFile())
      .map((file) => file.name)
      .filter((name) => imageExtensions.has(path.extname(name).toLowerCase()))
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
      .map((name, index) => ({
        id: `gall-${index + 1}`,
        title: `Gallery ${index + 1}`,
        image: `/images/gall/${encodeURIComponent(name)}`,
        filename: name,
      }));

    return NextResponse.json({ items });
  } catch {
    return NextResponse.json({ items: [] });
  }
}
