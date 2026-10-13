import { createHash } from "node:crypto";
import nextEnv from "@next/env";
import { neon } from "@neondatabase/serverless";

const { loadEnvConfig } = nextEnv;
loadEnvConfig(process.cwd());

const args = new Set(process.argv.slice(2));
const valueAfter = (name) => {
  const index = process.argv.indexOf(name);
  return index === -1 ? null : process.argv[index + 1] || null;
};
const myId = valueAfter("--my-id")?.trim().replace(/^@/, "").toLowerCase();
const cleanup = args.has("--cleanup");
const unlockNow = args.has("--unlock-now");
const usage = [
  "Birthday Card test fixture utility",
  "",
  "Seed:   npm run test:seed -- --my-id <your-my-id> [--unlock-now]",
  "Remove: npm run test:seed -- --my-id <your-my-id> --cleanup",
  "",
  "Requires DATABASE_URL and TEST_DATABASE_URL to point to the same dedicated test database.",
  "--unlock-now makes the test card visible immediately for local UI checks.",
  "To preview birthday-day UI, temporarily set your birthday to today in settings.",
].join("\n");

if (args.has("--help")) {
  console.info(usage);
  process.exit(0);
}
if (!myId || !/^[a-z0-9_]{3,20}$/.test(myId)) {
  console.error(usage);
  process.exit(1);
}

if (process.env.NODE_ENV === "production") {
  throw new Error("Test fixtures cannot be written when NODE_ENV is production.");
}

const testDatabaseUrl = process.env.TEST_DATABASE_URL;
if (!testDatabaseUrl) {
  throw new Error("Set TEST_DATABASE_URL to a dedicated test database in .env.local.");
}
if (!process.env.DATABASE_URL || testDatabaseUrl !== process.env.DATABASE_URL) {
  throw new Error(
    "For seeded data to appear in the app, DATABASE_URL and TEST_DATABASE_URL must match and point to a dedicated test database.",
  );
}

const sql = neon(testDatabaseUrl);
const owners = await sql`
  SELECT line_user_id AS "lineUserId", birthday_month_day AS birthday
  FROM user_profiles
  WHERE custom_id = ${myId}
  LIMIT 1
`;
const owner = owners[0];
if (!owner) {
  throw new Error(`No profile found for My ID @${myId} in the test database.`);
}

const testFriendId = `birthday-test:${owner.lineUserId}`;
const cardHash = createHash("sha256")
  .update(`birthday-test-card:${owner.lineUserId}`)
  .digest("hex")
  .slice(0, 32);
const cardId = `${cardHash.slice(0, 8)}-${cardHash.slice(8, 12)}-4${cardHash.slice(13, 16)}-8${cardHash.slice(17, 20)}-${cardHash.slice(20, 32)}`;

if (cleanup) {
  await sql`
    DELETE FROM cards
    WHERE id = ${cardId}::uuid
      AND sender_id = ${testFriendId}
      AND receiver_id = ${owner.lineUserId}
  `;
  await sql`
    DELETE FROM friendships
    WHERE (owner_line_user_id = ${owner.lineUserId}
      AND friend_line_user_id = ${testFriendId})
      OR (owner_line_user_id = ${testFriendId}
      AND friend_line_user_id = ${owner.lineUserId})
  `;
  await sql`
    DELETE FROM user_profiles
    WHERE line_user_id = ${testFriendId}
  `;
  console.info("Removed the Birthday Card test friend and seeded card.");
  process.exit(0);
}

if (!owner.birthday) {
  throw new Error(
    "Set a birthday for your profile in the test database before seeding.",
  );
}

const todayTokyo = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
}).format(new Date());
const [currentYear, currentMonth, currentDay] = todayTokyo.split("-").map(Number);
const [birthMonth, birthDay] = owner.birthday.split("-").map(Number);
let unlockAt = new Date().toISOString();

if (!unlockNow) {
  for (let year = currentYear; ; year += 1) {
    const date = new Date(Date.UTC(year, birthMonth - 1, birthDay));
    if (
      date.getUTCMonth() === birthMonth - 1 &&
      date.getUTCDate() === birthDay &&
      (year > currentYear ||
        birthMonth > currentMonth ||
        (birthMonth === currentMonth && birthDay >= currentDay))
    ) {
      unlockAt = new Date(Date.UTC(year, birthMonth - 1, birthDay, -9)).toISOString();
      break;
    }
  }
}

await sql`
  INSERT INTO user_profiles (line_user_id, display_name, birthday_month_day)
  VALUES (${testFriendId}, 'テストフレンド', ${todayTokyo.slice(5)})
  ON CONFLICT (line_user_id)
  DO UPDATE SET
    display_name = EXCLUDED.display_name,
    birthday_month_day = EXCLUDED.birthday_month_day,
    updated_at = NOW()
`;
await sql`
  INSERT INTO friendships (owner_line_user_id, friend_line_user_id)
  VALUES
    (${owner.lineUserId}, ${testFriendId}),
    (${testFriendId}, ${owner.lineUserId})
  ON CONFLICT DO NOTHING
`;
await sql`
  INSERT INTO cards (id, sender_id, receiver_id, message, is_private, unlock_at)
  VALUES (
    ${cardId}::uuid,
    ${testFriendId},
    ${owner.lineUserId},
    'これは表示確認用のテストカードです。',
    FALSE,
    ${unlockAt}
  )
  ON CONFLICT (id)
  DO UPDATE SET
    message = EXCLUDED.message,
    is_private = EXCLUDED.is_private,
    unlock_at = EXCLUDED.unlock_at
`;

console.info(
  [
    "Test fixture is ready.",
    "Friend: テストフレンド (birthday today)",
    `Card visibility: ${unlockNow ? "unlocks immediately" : `on ${owner.birthday}`}`,
    "Open the home page and the birthday card page to verify.",
    "Cleanup: npm run test:seed -- --my-id <your-my-id> --cleanup",
  ].join("\n"),
);
