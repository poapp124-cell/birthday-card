import { getSql } from "@/lib/db";

export async function findUserByCustomId(customId, currentUserId) {
  const sql = getSql();
  if (!sql) return null;

  const rows = await sql`
    SELECT
      public_id::text AS "publicId",
      custom_id AS "customId",
      COALESCE(display_name, 'LINEユーザー') AS name,
      profile_image AS "profileImage"
    FROM user_profiles
    WHERE custom_id = ${customId}
      AND line_user_id <> ${currentUserId}
    LIMIT 1
  `;

  return rows[0] ?? null;
}

export async function sendFriendRequest(requesterId, customId) {
  const sql = getSql();
  if (!sql) return "unavailable";

  const targets = await sql`
    SELECT line_user_id AS "lineUserId"
    FROM user_profiles
    WHERE custom_id = ${customId}
      AND line_user_id <> ${requesterId}
    LIMIT 1
  `;
  const recipientId = targets[0]?.lineUserId;
  if (!recipientId) return "not-found";

  const friends = await sql`
    SELECT 1
    FROM friendships
    WHERE (owner_line_user_id = ${requesterId} AND friend_line_user_id = ${recipientId})
       OR (owner_line_user_id = ${recipientId} AND friend_line_user_id = ${requesterId})
    LIMIT 1
  `;
  if (friends.length > 0) return "already-friends";

  const incoming = await sql`
    SELECT status
    FROM friend_requests
    WHERE requester_id = ${recipientId}
      AND recipient_id = ${requesterId}
    LIMIT 1
  `;
  if (incoming[0]?.status === "pending") return "incoming-request";
  if (incoming[0]?.status === "accepted") return "already-friends";

  const existing = await sql`
    SELECT status
    FROM friend_requests
    WHERE requester_id = ${requesterId}
      AND recipient_id = ${recipientId}
    LIMIT 1
  `;
  if (existing[0]?.status === "pending") return "pending";
  if (existing[0]?.status === "accepted") return "already-friends";

  await sql`
    INSERT INTO friend_requests (requester_id, recipient_id, status)
    VALUES (${requesterId}, ${recipientId}, 'pending')
    ON CONFLICT (requester_id, recipient_id)
    DO UPDATE SET status = 'pending', updated_at = NOW()
  `;

  return "sent";
}

export async function getFriendRequestLists(userId) {
  const sql = getSql();
  if (!sql) return { incoming: [], outgoing: [], friends: [] };

  const incoming = await sql`
    SELECT
      request.id::text AS id,
      COALESCE(sender.display_name, 'LINEユーザー') AS name,
      sender.custom_id AS "customId",
      request.created_at AS "createdAt"
    FROM friend_requests AS request
    JOIN user_profiles AS sender ON sender.line_user_id = request.requester_id
    WHERE request.recipient_id = ${userId}
      AND request.status = 'pending'
    ORDER BY request.created_at DESC
  `;

  const outgoing = await sql`
    SELECT
      request.id::text AS id,
      COALESCE(recipient.display_name, 'LINEユーザー') AS name,
      recipient.custom_id AS "customId",
      request.status,
      request.created_at AS "createdAt"
    FROM friend_requests AS request
    JOIN user_profiles AS recipient ON recipient.line_user_id = request.recipient_id
    WHERE request.requester_id = ${userId}
      AND request.status = 'pending'
    ORDER BY request.updated_at DESC
    LIMIT 100
  `;

  const friends = await sql`
    SELECT DISTINCT ON (friend.line_user_id)
      friend.public_id::text AS "publicId",
      COALESCE(friend.display_name, 'LINEユーザー') AS name,
      friend.custom_id AS "customId"
    FROM friendships AS friendship
    JOIN user_profiles AS friend
      ON friend.line_user_id = CASE
        WHEN friendship.owner_line_user_id = ${userId}
          THEN friendship.friend_line_user_id
        ELSE friendship.owner_line_user_id
      END
    WHERE friendship.owner_line_user_id = ${userId}
       OR friendship.friend_line_user_id = ${userId}
    ORDER BY friend.line_user_id, friend.display_name
  `;

  return { incoming, outgoing, friends };
}

export async function getFriendManagementList(userId) {
  const sql = getSql();
  if (!sql) return [];

  return sql`
    SELECT DISTINCT ON (friend.line_user_id)
      friend.public_id::text AS "publicId",
      COALESCE(friend.display_name, 'LINEユーザー') AS name,
      friend.custom_id AS "customId",
      friend.birthday_month_day AS birthday,
      EXISTS (
        SELECT 1
        FROM friend_blocks AS block
        WHERE block.blocker_line_user_id = ${userId}
          AND block.blocked_line_user_id = friend.line_user_id
      ) AS blocked
    FROM friendships AS friendship
    JOIN user_profiles AS friend
      ON friend.line_user_id = CASE
        WHEN friendship.owner_line_user_id = ${userId}
          THEN friendship.friend_line_user_id
        ELSE friendship.owner_line_user_id
      END
    WHERE friendship.owner_line_user_id = ${userId}
       OR friendship.friend_line_user_id = ${userId}
    ORDER BY friend.line_user_id, friend.display_name
  `;
}

export async function blockFriend(userId, friendPublicId) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    INSERT INTO friend_blocks (blocker_line_user_id, blocked_line_user_id)
    SELECT ${userId}, friend.line_user_id
    FROM user_profiles AS friend
    WHERE friend.public_id = ${friendPublicId}::uuid
      AND EXISTS (
        SELECT 1
        FROM friendships AS friendship
        WHERE (friendship.owner_line_user_id = ${userId}
          AND friendship.friend_line_user_id = friend.line_user_id)
          OR (friendship.owner_line_user_id = friend.line_user_id
          AND friendship.friend_line_user_id = ${userId})
      )
    ON CONFLICT (blocker_line_user_id, blocked_line_user_id) DO NOTHING
    RETURNING blocked_line_user_id
  `;

  return rows.length > 0;
}

export async function unblockFriend(userId, friendPublicId) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    DELETE FROM friend_blocks AS block
    USING user_profiles AS friend
    WHERE block.blocker_line_user_id = ${userId}
      AND block.blocked_line_user_id = friend.line_user_id
      AND friend.public_id = ${friendPublicId}::uuid
    RETURNING block.blocked_line_user_id
  `;

  return rows.length > 0;
}

export async function removeFriend(userId, friendPublicId) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    WITH target AS (
      SELECT friend.line_user_id
      FROM user_profiles AS friend
      WHERE friend.public_id = ${friendPublicId}::uuid
        AND EXISTS (
          SELECT 1
          FROM friendships AS friendship
          WHERE (friendship.owner_line_user_id = ${userId}
            AND friendship.friend_line_user_id = friend.line_user_id)
            OR (friendship.owner_line_user_id = friend.line_user_id
            AND friendship.friend_line_user_id = ${userId})
        )
      LIMIT 1
    ), removed_friendships AS (
      DELETE FROM friendships AS friendship
      USING target
      WHERE (friendship.owner_line_user_id = ${userId}
        AND friendship.friend_line_user_id = target.line_user_id)
        OR (friendship.owner_line_user_id = target.line_user_id
        AND friendship.friend_line_user_id = ${userId})
      RETURNING friendship.owner_line_user_id
    ), removed_blocks AS (
      DELETE FROM friend_blocks AS block
      USING target
      WHERE (block.blocker_line_user_id = ${userId}
        AND block.blocked_line_user_id = target.line_user_id)
        OR (block.blocker_line_user_id = target.line_user_id
        AND block.blocked_line_user_id = ${userId})
      RETURNING block.blocker_line_user_id
    ), reset_requests AS (
      UPDATE friend_requests AS request
      SET status = 'rejected', updated_at = NOW()
      FROM target
      WHERE request.status = 'accepted'
        AND ((request.requester_id = ${userId}
          AND request.recipient_id = target.line_user_id)
          OR (request.requester_id = target.line_user_id
          AND request.recipient_id = ${userId}))
      RETURNING request.id
    )
    SELECT line_user_id FROM target
  `;

  return rows.length > 0;
}

export async function acceptFriendRequest(requestId, recipientId) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    WITH accepted AS (
      UPDATE friend_requests
      SET status = 'accepted', updated_at = NOW()
      WHERE id = ${requestId}::uuid
        AND recipient_id = ${recipientId}
        AND status = 'pending'
      RETURNING requester_id, recipient_id
    ), forward_friendship AS (
      INSERT INTO friendships (owner_line_user_id, friend_line_user_id)
      SELECT requester_id, recipient_id FROM accepted
      ON CONFLICT (owner_line_user_id, friend_line_user_id) DO NOTHING
      RETURNING owner_line_user_id
    ), reverse_friendship AS (
      INSERT INTO friendships (owner_line_user_id, friend_line_user_id)
      SELECT recipient_id, requester_id FROM accepted
      ON CONFLICT (owner_line_user_id, friend_line_user_id) DO NOTHING
      RETURNING owner_line_user_id
    )
    SELECT requester_id FROM accepted
  `;

  return rows.length > 0;
}

export async function rejectFriendRequest(requestId, recipientId) {
  const sql = getSql();
  if (!sql) return false;

  const rows = await sql`
    UPDATE friend_requests
    SET status = 'rejected', updated_at = NOW()
    WHERE id = ${requestId}::uuid
      AND recipient_id = ${recipientId}
      AND status = 'pending'
    RETURNING id
  `;

  return rows.length > 0;
}
