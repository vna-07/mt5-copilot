import { NextRequest, NextResponse } from "next/server";
import { SETTINGS_COOKIE, decodeSettings, encodeSettings, normalizeSettings } from "@/lib/settings";

export async function GET(req: NextRequest) {
  return NextResponse.json({
    settings: decodeSettings(req.cookies.get(SETTINGS_COOKIE)?.value),
  });
}

export async function PUT(req: NextRequest) {
  try {
    const body = await req.json();
    const settings = normalizeSettings(body.settings ?? body);
    const res = NextResponse.json({ ok: true, settings });
    res.cookies.set(SETTINGS_COOKIE, encodeSettings(settings), {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return res;
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid settings payload." }, { status: 400 });
  }
}
