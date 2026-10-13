import { auth } from "@/auth";
import { getSql } from "@/lib/db";

const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request) {
  const session = await auth();
  if (!session?.user?.id) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  let input;
  try {
    input = await request.json();
  } catch {
    return Response.json({ error: "invalid_json" }, { status: 400 });
  }

  if (
    typeof input?.cardId !== "string" ||
    !uuidPattern.test(input.cardId) ||
    typeof input.liked !== "boolean"
  ) {
    return Response.json({ error: "invalid_input" }, { status: 400 });
  }

  const sql = getSql();
  if (!sql) {
    return Response.json({ error: "database_not_configured" }, { status: 503 });
  }

  const visibleCards = await sql`
    SELECT card.id
    FROM cards AS card
    WHERE card.id = ${input.cardId}
      AND (
        (
          card.receiver_id = ${session.user.id}
          AND card.unlock_at <= NOW()
        )
        OR (
          card.is_private = FALSE
          AND card.unlock_at <= NOW()
          AND card.unlock_at + INTERVAL '48 hours' > NOW()
          AND EXISTS (
            SELECT 1 FROM friendships AS friendship
            WHERE (
              friendship.owner_line_user_id = ${session.user.id}
              AND friendship.friend_line_user_id = card.receiver_id
            ) OR (
              friendship.friend_line_user_id = ${session.user.id}
              AND friendship.owner_line_user_id = card.receiver_id
            )
          )
          AND (
            NOT EXISTS (
              SELECT 1 FROM friend_blocks AS block
              WHERE block.blocker_line_user_id = card.receiver_id
                AND block.blocked_line_user_id = ${session.user.id}
            )
            OR card.sender_id = ${session.user.id}
          )
        )
      )
    LIMIT 1
  `;
  if (visibleCards.length === 0) {
    return Response.json({ error: "card_not_available" }, { status: 404 });
  }

  if (input.liked) {
    await sql`
      INSERT INTO card_reactions (card_id, user_line_user_id)
      VALUES (${input.cardId}, ${session.user.id})
      ON CONFLICT (card_id, user_line_user_id) DO NOTHING
    `;
  } else {
    await sql`
      DELETE FROM card_reactions
      WHERE card_id = ${input.cardId}
        AND user_line_user_id = ${session.user.id}
    `;
  }

  const reactions = await sql`
    SELECT
      COUNT(*)::int AS "likeCount",
      BOOL_OR(user_line_user_id = ${session.user.id}) AS liked
    FROM card_reactions
    WHERE card_id = ${input.cardId}
  `;
  return Response.json(
    {
      likeCount: reactions[0]?.likeCount ?? 0,
      liked: reactions[0]?.liked ?? false,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
