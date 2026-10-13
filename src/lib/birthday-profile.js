import { getSql } from "@/lib/db";

export async function getBirthdayProfile(lineUserId) {
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    SELECT
      public_id::text AS "publicId",
      display_name AS "displayName",
      profile_image AS "profileImage",
      custom_id AS "customId",
      birthday_month_day AS birthday,
      allow_birthday_notification AS "allowBirthdayNotification"
    FROM user_profiles
    WHERE line_user_id = ${lineUserId}
    LIMIT 1
  `;

  return rows[0] ?? {
    publicId: null,
    displayName: null,
    profileImage: null,
    customId: null,
    birthday: "",
    allowBirthdayNotification: false,
  };
}

export async function ensureBirthdayProfile(lineUserId, displayName, profileImage) {
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    INSERT INTO user_profiles (line_user_id, display_name, profile_image)
    VALUES (${lineUserId}, ${displayName}, ${profileImage})
    ON CONFLICT (line_user_id)
    DO UPDATE SET
      display_name = COALESCE(user_profiles.display_name, EXCLUDED.display_name),
      profile_image = COALESCE(EXCLUDED.profile_image, user_profiles.profile_image),
      updated_at = NOW()
    RETURNING (xmax = 0) AS created
  `;

  return rows[0]?.created ?? false;
}

export async function saveBirthdayProfile(
  lineUserId,
  birthday,
  allowBirthdayNotification,
) {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");

  await sql`
    INSERT INTO user_profiles (
      line_user_id,
      birthday,
      birthday_month_day,
      allow_birthday_notification
    )
    VALUES (
      ${lineUserId},
      ${birthday},
      ${birthday},
      ${allowBirthdayNotification}
    )
    ON CONFLICT (line_user_id)
    DO UPDATE SET
      birthday = EXCLUDED.birthday,
      birthday_month_day = EXCLUDED.birthday_month_day,
      allow_birthday_notification = EXCLUDED.allow_birthday_notification,
      updated_at = NOW()
  `;
}

export async function saveProfileSettings(
  lineUserId,
  { displayName, birthdayMonthDay, allowBirthdayNotification, customId },
) {
  const sql = getSql();
  if (!sql) throw new Error("DATABASE_URL is not configured.");

  await sql`
    INSERT INTO user_profiles (
      line_user_id,
      display_name,
      birthday_month_day,
      birthday,
      allow_birthday_notification,
      custom_id
    )
    VALUES (
      ${lineUserId},
      ${displayName},
      ${birthdayMonthDay},
      ${birthdayMonthDay},
      ${allowBirthdayNotification},
      ${customId}
    )
    ON CONFLICT (line_user_id)
    DO UPDATE SET
      display_name = EXCLUDED.display_name,
      birthday_month_day = EXCLUDED.birthday_month_day,
      birthday = EXCLUDED.birthday,
      allow_birthday_notification = EXCLUDED.allow_birthday_notification,
      custom_id = EXCLUDED.custom_id,
      updated_at = NOW()
  `;
}

export async function isCustomIdAvailable(customId, currentUserId) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    SELECT 1
    FROM user_profiles
    WHERE custom_id = ${customId}
      AND line_user_id <> ${currentUserId}
    LIMIT 1
  `;

  return rows.length === 0;
}
