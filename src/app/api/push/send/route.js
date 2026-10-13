import { timingSafeEqual } from "node:crypto";
import webpush from "web-push";
import { getSql } from "@/lib/db";

function hasValidCronToken(request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization") || "";
  const token = authorization.startsWith("Bearer ")
    ? authorization.slice("Bearer ".length)
    : "";
  if (!secret || !token) return false;

  const expectedBuffer = Buffer.from(secret);
  const tokenBuffer = Buffer.from(token);
  return (
    expectedBuffer.length === tokenBuffer.length &&
    timingSafeEqual(expectedBuffer, tokenBuffer)
  );
}

function configureWebPush() {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT;
  if (!publicKey || !privateKey || !subject) return false;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  return true;
}

export async function POST(request) {
  if (!hasValidCronToken(request)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!configureWebPush()) {
    return Response.json({ error: "push_not_configured" }, { status: 503 });
  }

  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "database_not_configured" }, { status: 503 });
  }

  const recipients = await sql`
    WITH tokyo_today AS (
      SELECT
        (NOW() AT TIME ZONE 'Asia/Tokyo')::date AS date_key,
        TO_CHAR((NOW() AT TIME ZONE 'Asia/Tokyo')::date, 'MM-DD') AS today,
        TO_CHAR((NOW() AT TIME ZONE 'Asia/Tokyo')::date + 1, 'MM-DD') AS tomorrow
    )
    SELECT
      birthday_owner.line_user_id AS "birthdayOwnerId",
      birthday_owner.display_name AS "birthdayOwnerName",
      friendship.friend_line_user_id AS "recipientId",
      subscription.id AS "subscriptionId",
      subscription.endpoint,
      subscription.p256dh,
      subscription.auth,
      tokyo_today.date_key AS "dateKey",
      CASE
        WHEN birthday_owner.birthday_month_day = tokyo_today.today THEN 'today'
        ELSE 'tomorrow'
      END AS "reminderType"
    FROM user_profiles AS birthday_owner
    JOIN friendships AS friendship
      ON friendship.owner_line_user_id = birthday_owner.line_user_id
    JOIN push_subscriptions AS subscription
      ON subscription.line_user_id = friendship.friend_line_user_id
    CROSS JOIN tokyo_today
    WHERE birthday_owner.allow_birthday_notification = TRUE
      AND birthday_owner.birthday_month_day IN (tokyo_today.today, tokyo_today.tomorrow)
    ORDER BY subscription.id
  `;

  let sent = 0;
  let removed = 0;
  let failed = 0;
  const origin = process.env.AUTH_URL || process.env.NEXTAUTH_URL;
  const notificationUrl = origin ? new URL("/", origin).toString() : "/";

  for (const recipient of recipients) {
    const claimed = await sql`
      INSERT INTO push_notification_deliveries (
        birthday_owner_line_user_id, recipient_line_user_id, subscription_id,
        date_key, reminder_type
      )
      VALUES (
        ${recipient.birthdayOwnerId},
        ${recipient.recipientId},
        ${recipient.subscriptionId},
        ${recipient.dateKey},
        ${recipient.reminderType}
      )
      ON CONFLICT (
        birthday_owner_line_user_id,
        recipient_line_user_id,
        subscription_id,
        date_key,
        reminder_type
      ) DO NOTHING
      RETURNING id
    `;
    if (claimed.length === 0) continue;

    const name = recipient.birthdayOwnerName || "フレンド";
    const body =
      recipient.reminderType === "today"
        ? `今日は${name}さんの誕生日です。バースデーカードを贈りましょう。`
        : `明日は${name}さんの誕生日です。バースデーカードを準備しましょう。`;

    try {
      await webpush.sendNotification(
        {
          endpoint: recipient.endpoint,
          keys: { p256dh: recipient.p256dh, auth: recipient.auth },
        },
        JSON.stringify({
          title: "バースデーカード",
          body,
          url: notificationUrl,
        }),
      );
      sent += 1;
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        await sql`DELETE FROM push_subscriptions WHERE id = ${recipient.subscriptionId}`;
        await sql`
          DELETE FROM push_notification_deliveries
          WHERE id = ${claimed[0].id}
        `;
        removed += 1;
      } else {
        await sql`
          DELETE FROM push_notification_deliveries
          WHERE id = ${claimed[0].id}
        `;
        failed += 1;
        console.error("[push] Notification delivery failed", {
          statusCode: error.statusCode || null,
        });
      }
    }
  }

  return Response.json({ sent, removed, failed });
}
