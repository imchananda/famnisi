import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const role = body.role === "admin" ? "admin" : "user";
  const password = typeof body.password === "string" ? body.password : "";
  const expectedPassword =
    role === "admin"
      ? process.env.VITE_ADMIN_PASSWORD
      : process.env.VITE_USER_PASSWORD;

  if (!expectedPassword) {
    return NextResponse.json(
      { error: `Missing ${role === "admin" ? "VITE_ADMIN_PASSWORD" : "VITE_USER_PASSWORD"} in .env` },
      { status: 500 },
    );
  }

  if (!password || password !== expectedPassword) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  return NextResponse.json({
    role,
    token: `film-armani-${role}-${Date.now()}`,
  });
}
