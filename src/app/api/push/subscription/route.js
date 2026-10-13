import { auth } from "@/auth";
import { getSql } from "@/lib/db";

function pushIsConfigured() {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.VAPID_SUBJECT,
  );
}

function isAllowedEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    const host = url.hostname.toLowerCase();
    const allowedHost =
      host === "fcm.googleapis.com" ||
      host === "push.services.mozilla.com" ||
      host.endsWith(".push.services.mozilla.com") ||
      host === "push.apple.com" ||
      host.endsWith(".push.apple.com") ||
      host.endsWith(".notify.windows.com");
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.port &&
      !url.hash &&
      allowedHost
    );
  } catch {
    return false;
  }
}

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "database_not_configured" }, { status: 503 });
  }

  const rows = await sql`
    SELECT EXISTS (
      SELECT 1 FROM push_subscriptions
      WHERE line_user_id = ${session.user.id}
    ) AS subscribed
  `;
  return Response.json(
    {
      ready: pushIsConfigured(),
      publicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null,
      subscribed: rows[0]?.subscribed ?? false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!pushIsConfigured()) {
    return Response.json({ error: "push_not_configured" }, { status: 503 });
  }

  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "database_not_configured" }, { status: 503 });
  }

  let subscription;
  try {
    subscription = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  const endpoint = subscription?.endpoint;
  const p256dh = subscription?.keys?.p256dh;
  const authKey = subscription?.keys?.auth;
  if (
    typeof endpoint !== "string" ||
    endpoint.length > 2048 ||
    !isAllowedEndpoint(endpoint) ||
    typeof p256dh !== "string" ||
    p256dh.length > 256 ||
    typeof authKey !== "string" ||
    authKey.length > 256
  ) {
    return Response.json({ error: "invalid_subscription" }, { status: 400 });
  }

  const expirationDate = Number.isFinite(subscription.expirationTime)
    ? new Date(subscription.expirationTime)
    : null;
  if (expirationDate && Number.isNaN(expirationDate.getTime())) {
    return Response.json({ error: "invalid_subscription" }, { status: 400 });
  }
  const expirationTime = expirationDate?.toISOString() ?? null;
  const rows = await sql`
    INSERT INTO push_subscriptions (
      line_user_id, endpoint, p256dh, auth, expiration_time, updated_at
    )
    VALUES (
      ${session.user.id}, ${endpoint}, ${p256dh}, ${authKey},
      ${expirationTime}, NOW()
    )
    ON CONFLICT (endpoint) DO UPDATE SET
      line_user_id = EXCLUDED.line_user_id,
      p256dh = EXCLUDED.p256dh,
      auth = EXCLUDED.auth,
      expiration_time = EXCLUDED.expiration_time,
      updated_at = NOW()
    WHERE push_subscriptions.line_user_id = EXCLUDED.line_user_id
    RETURNING id
  `;
  if (rows.length === 0) {
    return Response.json({ error: "subscription_conflict" }, { status: 409 });
  }
  return Response.json({ saved: true });
}

export async function DELETE() {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "database_not_configured" }, { status: 503 });
  }

  await sql`DELETE FROM push_subscriptions WHERE line_user_id = ${session.user.id}`;
  return Response.json({ removed: true });
}
