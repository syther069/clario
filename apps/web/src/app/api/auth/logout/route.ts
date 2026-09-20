import { NextResponse } from "next/server";
import { serializeLogoutCookie } from "@/lib/auth/session";

export async function POST() {
  const response = NextResponse.json({ ok: true }, { status: 200 });
  response.headers.set("Set-Cookie", serializeLogoutCookie());
  return response;
}
