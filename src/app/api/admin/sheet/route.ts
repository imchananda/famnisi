import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const gasUrl = process.env.VITE_GAS_URL;

  if (!gasUrl) {
    return NextResponse.json(
      { error: "Missing VITE_GAS_URL in .env" },
      { status: 500 },
    );
  }

  const payload = await request.json().catch(() => null);
  if (!payload) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  try {
    const response = await fetch(gasUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const text = await response.text();
    const parsedResponse = parseJson(text);

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Google Apps Script denied the request. Check Web App access settings.",
          status: response.status,
          response: text,
        },
        { status: response.status },
      );
    }

    if (parsedResponse && parsedResponse.ok === false) {
      return NextResponse.json(
        {
          error: parsedResponse.error || "Google Apps Script returned an error.",
          status: response.status,
          response: parsedResponse,
        },
        { status: 400 },
      );
    }

    return NextResponse.json({
      ok: true,
      status: response.status,
      response: parsedResponse || text,
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to send request to Google Apps Script" },
      { status: 502 },
    );
  }
}

function parseJson(text: string) {
  try {
    return JSON.parse(text) as { ok?: boolean; error?: string };
  } catch {
    return null;
  }
}
