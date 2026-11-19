import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";

function safeEqual(a: string, b: string) {
  const A = Buffer.from(a), B = Buffer.from(b);
  if (A.length !== B.length) return false;
  return timingSafeEqual(A, B);
}

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    const expected = process.env.APP_ACCESS_CODE;
    const secret = process.env.APP_SESSION_SECRET;

    if (!expected || !secret) {
      console.error("Missing APP_ACCESS_CODE or APP_SESSION_SECRET in Vercel Env Vars");
      return NextResponse.json(
        { ok: false, error: "Server not configured. Missing environment variables." }, 
        { status: 500 }
      );
    }

    if (!code || !safeEqual(code.trim(), expected)) {
      return NextResponse.json({ ok: false, error: "Incorrect access code." }, { status: 401 });
    }

    const res = NextResponse.json({ ok: true });
    res.cookies.set("copilot_session", secret, { 
      httpOnly: true, 
      secure: process.env.NODE_ENV === "production", 
      sameSite: "lax", 
      path: "/", 
      maxAge: 60 * 60 * 24 * 30 
    });
    return res;
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Invalid request payload." }, { status: 400 });
  }
}