import { NextRequest, NextResponse } from "next/server";
import webPush from "web-push";
import type { PushSubscriptionPayload } from "@/lib/push";

const COOKIE = "copilot_push";

function configureWebPush() {
  const publicKey =
    process.env.VAPID_PUBLIC_KEY ||
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@example.com";
  if (!publicKey || !privateKey) return null;
  webPush.setVapidDetails(subject, publicKey, privateKey);
  return publicKey;
}

export async function GET() {
  const publicKey = configureWebPush();
  return NextResponse.json({ configured: Boolean(publicKey), publicKey });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (body.subscription) {
      const subscription = body.subscription as PushSubscriptionPayload;
      const res = NextResponse.json({ ok: true });
      res.cookies.set(COOKIE, Buffer.from(JSON.stringify(subscription)).toString("base64url"), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 30,
      });
      return res;
    }

    const publicKey = configureWebPush();
    if (!publicKey) {
      return NextResponse.json({ ok: false, error: "Web Push is not configured." }, { status: 503 });
    }
    const raw = req.cookies.get(COOKIE)?.value;
    if (!raw) return NextResponse.json({ ok: false, error: "No push subscription." }, { status: 404 });
    const subscription = JSON.parse(Buffer.from(raw, "base64url").toString("utf8")) as PushSubscriptionPayload;
    await webPush.sendNotification(subscription, JSON.stringify(body.payload ?? {
      title: "MT5 Co-Pilot",
      body: "A market update is ready.",
      url: "/",
    }));
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Push delivery failed." }, { status: 500 });
  }
}
