import { randomUUID } from "node:crypto";
import { getSql } from "@/lib/db";

export const birthdayCardDesigns = [
  "classic",
  "rose",
  "lavender",
  "ocean",
  "mint",
  "sunshine",
  "midnight",
  "garden",
  "confetti",
  "kraft",
];

function getTokyoToday() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Tokyo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));

  return {
    year: Number(values.year),
    monthDay: `${values.month}-${values.day}`,
  };
}

export function getNextBirthdayUnlockAt(birthday) {
  const [month, day] = birthday.split("-").map(Number);
  const { year: currentYear, monthDay: today } = getTokyoToday();
  let year = currentYear;

  while (true) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day &&
      `${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}` >=
        today
    ) {
      return new Date(Date.UTC(year, month - 1, day, -9)).toISOString();
    }
    year += 1;
  }
}

export function getDaysUntilBirthday(birthday) {
  if (!birthday) return null;

  const [month, day] = birthday.split("-").map(Number);
  const { year: currentYear, monthDay: today } = getTokyoToday();
  const [todayMonth, todayDay] = today.split("-").map(Number);
  const todayUtc = Date.UTC(currentYear, todayMonth - 1, todayDay);
  let year = currentYear;

  while (true) {
    const birthdayUtc = Date.UTC(year, month - 1, day);
    const date = new Date(birthdayUtc);
    if (date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      year += 1;
      continue;
    }

    const daysUntil = Math.round((birthdayUtc - todayUtc) / 86400000);
    if (daysUntil >= 0) return daysUntil;
    year += 1;
  }
}

export async function getBirthdayFriends(lineUserId) {
  const sql = getSql();
  if (!sql) return [];

  const friends = await sql`
    SELECT DISTINCT ON (friend.line_user_id)
      friend.public_id::text AS "publicId",
      COALESCE(friend.display_name, 'LINEユーザー') AS name,
      friend.custom_id AS "customId",
      friend.profile_image AS "profileImage",
      friend.birthday_month_day AS birthday
    FROM friendships AS friendship
    JOIN user_profiles AS friend
      ON friend.line_user_id = CASE
        WHEN friendship.owner_line_user_id = ${lineUserId}
          THEN friendship.friend_line_user_id
        ELSE friendship.owner_line_user_id
      END
    WHERE (
      friendship.owner_line_user_id = ${lineUserId}
      OR friendship.friend_line_user_id = ${lineUserId}
    )
      AND friend.line_user_id <> ${lineUserId}
    ORDER BY friend.line_user_id, friend.display_name
  `;

  return friends.map((friend) => ({
    ...friend,
    daysUntilBirthday: getDaysUntilBirthday(friend.birthday),
  }));
}

export async function createBirthdayCard({
  senderId,
  senderName,
  receiverPublicId,
  message,
  isPrivate,
  designId,
}) {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");
  if (!birthdayCardDesigns.includes(designId)) {
    throw new Error("Invalid birthday card design.");
  }

  const recipients = await sql`
    SELECT receiver.line_user_id AS "lineUserId", receiver.birthday_month_day AS birthday,
      receiver.public_id::text AS "publicId"
    FROM user_profiles AS receiver
    WHERE receiver.public_id = ${receiverPublicId}
      AND receiver.birthday_month_day IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM friendships AS friendship
        WHERE (
          friendship.owner_line_user_id = ${senderId}
          AND friendship.friend_line_user_id = receiver.line_user_id
        ) OR (
          friendship.friend_line_user_id = ${senderId}
          AND friendship.owner_line_user_id = receiver.line_user_id
        )
      )
    LIMIT 1
  `;
  const recipient = recipients[0];
  if (!recipient) return null;

  await sql`
    INSERT INTO user_profiles (line_user_id, display_name)
    VALUES (${senderId}, ${senderName})
    ON CONFLICT (line_user_id)
    DO NOTHING
  `;

  const cardId = randomUUID();
  const unlockAt = getNextBirthdayUnlockAt(recipient.birthday);
  await sql`
    INSERT INTO cards (
      id, sender_id, receiver_id, message, is_private, unlock_at, design_id
    )
    VALUES (
      ${cardId}, ${senderId}, ${recipient.lineUserId}, ${message},
      ${isPrivate}, ${unlockAt}, ${designId}
    )
  `;

  return recipient.publicId;
}

export async function getBirthdayTimeline(viewerId, publicId) {
  const sql = getSql();
  if (!sql) return null;

  const profiles = await sql`
    SELECT
      line_user_id AS "lineUserId",
      COALESCE(display_name, 'LINEユーザー') AS name,
      profile_image AS "profileImage",
      birthday_month_day AS birthday,
      public_id::text AS "publicId"
    FROM user_profiles
    WHERE public_id = ${publicId}
    LIMIT 1
  `;
  const profile = profiles[0];
  if (!profile) return null;

  const isOwner = profile.lineUserId === viewerId;
  let stealthView = false;
  if (!isOwner) {
    const relationships = await sql`
      SELECT
        EXISTS (
          SELECT 1
          FROM friendships
          WHERE (owner_line_user_id = ${viewerId}
            AND friend_line_user_id = ${profile.lineUserId})
            OR (owner_line_user_id = ${profile.lineUserId}
            AND friend_line_user_id = ${viewerId})
        ) AS friends,
        EXISTS (
          SELECT 1
          FROM friend_blocks
          WHERE blocker_line_user_id = ${profile.lineUserId}
            AND blocked_line_user_id = ${viewerId}
        ) AS "viewerBlocked"
    `;
    if (!relationships[0]?.friends) return null;
    stealthView = relationships[0].viewerBlocked;
  }

  const cards = isOwner
    ? await sql`
        SELECT
          card.id::text AS id,
          card.message,
          card.is_private AS "isPrivate",
          card.design_id AS "designId",
          card.created_at AS "createdAt",
          card.unlock_at AS "unlockAt",
          card.unlock_at + INTERVAL '48 hours' <= NOW() AS archived,
          sender.display_name AS "senderName",
          (
            SELECT COUNT(*)::int FROM card_reactions AS reaction
            WHERE reaction.card_id = card.id
          ) AS "likeCount",
          EXISTS (
            SELECT 1 FROM card_reactions AS reaction
            WHERE reaction.card_id = card.id
              AND reaction.user_line_user_id = ${viewerId}
          ) AS "viewerLiked"
        FROM cards AS card
        JOIN user_profiles AS sender ON sender.line_user_id = card.sender_id
        WHERE card.receiver_id = ${profile.lineUserId}
          AND card.unlock_at <= NOW()
        ORDER BY card.created_at ASC
      `
    : stealthView
      ? await sql`
          SELECT
            card.id::text AS id,
            card.message,
            card.created_at AS "createdAt",
            card.design_id AS "designId",
            sender.display_name AS "senderName",
            (
              SELECT COUNT(*)::int FROM card_reactions AS reaction
              WHERE reaction.card_id = card.id
            ) AS "likeCount",
            EXISTS (
              SELECT 1 FROM card_reactions AS reaction
              WHERE reaction.card_id = card.id
                AND reaction.user_line_user_id = ${viewerId}
            ) AS "viewerLiked"
          FROM cards AS card
          JOIN user_profiles AS sender ON sender.line_user_id = card.sender_id
          WHERE card.receiver_id = ${profile.lineUserId}
            AND card.sender_id = ${viewerId}
            AND card.is_private = FALSE
            AND card.unlock_at <= NOW()
            AND card.unlock_at + INTERVAL '48 hours' > NOW()
          ORDER BY card.created_at ASC
        `
    : await sql`
        SELECT
          card.id::text AS id,
          card.message,
          card.created_at AS "createdAt",
          card.design_id AS "designId",
          sender.display_name AS "senderName",
          (
            SELECT COUNT(*)::int FROM card_reactions AS reaction
            WHERE reaction.card_id = card.id
          ) AS "likeCount",
          EXISTS (
            SELECT 1 FROM card_reactions AS reaction
            WHERE reaction.card_id = card.id
              AND reaction.user_line_user_id = ${viewerId}
          ) AS "viewerLiked"
        FROM cards AS card
        JOIN user_profiles AS sender ON sender.line_user_id = card.sender_id
        WHERE card.receiver_id = ${profile.lineUserId}
          AND card.is_private = FALSE
          AND card.unlock_at <= NOW()
          AND card.unlock_at + INTERVAL '48 hours' > NOW()
        ORDER BY card.created_at ASC
      `;

  const pending = isOwner
    ? await sql`
        SELECT COUNT(*)::int AS count, MIN(unlock_at) AS "nextUnlockAt"
        FROM cards
        WHERE receiver_id = ${profile.lineUserId}
          AND unlock_at > NOW()
      `
    : stealthView
      ? await sql`
          SELECT COUNT(*)::int AS count, MIN(unlock_at) AS "nextUnlockAt"
          FROM cards
          WHERE receiver_id = ${profile.lineUserId}
            AND sender_id = ${viewerId}
            AND is_private = FALSE
            AND unlock_at > NOW()
        `
    : await sql`
        SELECT COUNT(*)::int AS count, MIN(unlock_at) AS "nextUnlockAt"
        FROM cards
        WHERE receiver_id = ${profile.lineUserId}
          AND is_private = FALSE
          AND unlock_at > NOW()
      `;

  const nextUnlockAt = pending[0]?.nextUnlockAt;
  return {
    profile,
    isOwner,
    cards,
    pendingCount: pending[0]?.count ?? 0,
    nextUnlockAt: nextUnlockAt
      ? new Date(nextUnlockAt).toISOString()
      : null,
  };

}
