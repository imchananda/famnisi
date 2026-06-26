import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const sheetId = process.env.SHEET_ID;
  const { searchParams } = new URL(request.url);
  const gid = searchParams.get("gid") || process.env.MEDIA_GID || "0";

  if (!sheetId) {
    return NextResponse.json(
      { error: "Missing SHEET_ID in .env" },
      { status: 400 },
    );
  }

  try {
    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
      { cache: "no-store" },
    );

    if (!response.ok) {
      return NextResponse.json(
        { error: "Failed to fetch from Google Sheets" },
        { status: response.status },
      );
    }

    const text = await response.text();
    return new NextResponse(text, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Internal server error while fetching sheet data" },
      { status: 500 },
    );
  }
}
