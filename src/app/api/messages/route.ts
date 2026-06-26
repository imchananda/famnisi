import { NextResponse } from "next/server";
import { parseCSV } from "@/lib/csv";
import { defaultMessagePools } from "@/lib/messages";

export async function GET() {
  const sheetId = process.env.SHEET_ID;
  const gid = process.env.MESSAGES_GID;

  if (!sheetId || !gid) {
    return NextResponse.json({
      configured: false,
      source: "fallback",
      messages: defaultMessagePools,
    });
  }

  try {
    const response = await fetch(
      `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`,
      { next: { revalidate: 60 } },
    );

    if (!response.ok) {
      return NextResponse.json({
        configured: true,
        source: "fallback",
        messages: defaultMessagePools,
      });
    }

    const csvText = await response.text();
    const messages = parseMessagesFromCSV(csvText);
    const hasMessages = messages.th.length || messages.en.length;

    return NextResponse.json({
      configured: true,
      source: hasMessages ? "sheet" : "fallback",
      messages: hasMessages ? messages : defaultMessagePools,
    });
  } catch {
    return NextResponse.json({
      configured: true,
      source: "fallback",
      messages: defaultMessagePools,
    });
  }
}

function parseMessagesFromCSV(csvText: string) {
  const rows = parseCSV(csvText.replace(/^\uFEFF/, ""));
  const messages = { th: [] as string[], en: [] as string[] };
  if (rows.length === 0) return messages;

  const headers = rows[0].map((header) => header.toLowerCase().trim());
  const enIndex = headers.indexOf("en");
  const thIndex = headers.indexOf("th");

  rows.slice(1).forEach((row) => {
    const en = enIndex !== -1 ? row[enIndex]?.trim() : "";
    const th = thIndex !== -1 ? row[thIndex]?.trim() : "";

    if (en) messages.en.push(en);
    if (th) messages.th.push(th);
  });

  return messages;
}
