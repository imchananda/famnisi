import { NextResponse } from "next/server";
import { mockMediaItems, parseMediaItemsFromCSV } from "@/lib/media";

export async function GET(request: Request) {
  const sheetId = process.env.SHEET_ID;
  const { searchParams } = new URL(request.url);
  const gid = searchParams.get("gid") || process.env.MEDIA_GID || "0";

  if (!sheetId) {
    return NextResponse.json({
      configured: false,
      source: "mock",
      items: mockMediaItems,
    });
  }

  try {
    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) {
      return NextResponse.json(
        {
          configured: true,
          source: "mock",
          error: "Failed to fetch Google Sheet. Using mock media.",
          items: mockMediaItems,
        },
        { status: 200 },
      );
    }

    const csvText = await response.text();
    const items = parseMediaItemsFromCSV(csvText);

    return NextResponse.json({
      configured: true,
      source: items.length ? "sheet" : "mock",
      items: items.length ? items : mockMediaItems,
    });
  } catch {
    return NextResponse.json(
      {
        configured: true,
        source: "mock",
        error: "Unable to load Google Sheet. Using mock media.",
        items: mockMediaItems,
      },
      { status: 200 },
    );
  }
}
