CREATE TABLE IF NOT EXISTS user_profiles (
  line_user_id TEXT PRIMARY KEY,
  public_id UUID NOT NULL DEFAULT gen_random_uuid(),
  display_name TEXT,
  profile_image TEXT,
  custom_id TEXT,
  birthday TEXT,
  birthday_month_day TEXT,
  allow_birthday_notification BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_profiles_birthday_format CHECK (
    birthday IS NULL OR (
      birthday ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      AND CASE
        WHEN substring(birthday, 1, 2) = '02' THEN substring(birthday, 4, 2) <= '29'
        WHEN substring(birthday, 1, 2) IN ('04', '06', '09', '11')
          THEN substring(birthday, 4, 2) <= '30'
        ELSE TRUE
      END
    )
  )
);

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS public_id UUID DEFAULT gen_random_uuid();
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS display_name TEXT;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS profile_image TEXT;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS custom_id TEXT;
ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS birthday_month_day TEXT;
UPDATE user_profiles SET public_id = gen_random_uuid() WHERE public_id IS NULL;
UPDATE user_profiles
SET birthday_month_day = birthday
WHERE birthday_month_day IS NULL AND birthday IS NOT NULL;
ALTER TABLE user_profiles ALTER COLUMN public_id SET DEFAULT gen_random_uuid();
ALTER TABLE user_profiles ALTER COLUMN public_id SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_public_id_idx
  ON user_profiles (public_id);
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_custom_id_idx
  ON user_profiles (custom_id)
  WHERE custom_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_custom_id_format'
      AND conrelid = 'user_profiles'::regclass
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_custom_id_format
      CHECK (
        custom_id IS NULL OR (
          custom_id = lower(custom_id)
          AND custom_id ~ '^[a-z0-9_]{3,20}$'
        )
      ) NOT VALID;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'user_profiles_birthday_month_day_format'
      AND conrelid = 'user_profiles'::regclass
  ) THEN
    ALTER TABLE user_profiles
      ADD CONSTRAINT user_profiles_birthday_month_day_format
      CHECK (
        birthday_month_day IS NULL OR (
          birthday_month_day ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
          AND CASE
            WHEN substring(birthday_month_day, 1, 2) = '02'
              THEN substring(birthday_month_day, 4, 2) <= '29'
            WHEN substring(birthday_month_day, 1, 2) IN ('04', '06', '09', '11')
              THEN substring(birthday_month_day, 4, 2) <= '30'
            ELSE TRUE
          END
        )
      ) NOT VALID;
  END IF;
END $$;

-- Each row means the owner wants to notify this friend about the owner's birthday.
CREATE TABLE IF NOT EXISTS friendships (
  owner_line_user_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  friend_line_user_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  notify_this_friend BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (owner_line_user_id, friend_line_user_id),
  CONSTRAINT friendships_no_self_reference CHECK (owner_line_user_id <> friend_line_user_id)
);

CREATE INDEX IF NOT EXISTS friendships_friend_idx
  ON friendships (friend_line_user_id);

CREATE TABLE IF NOT EXISTS friend_blocks (
  blocker_line_user_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  blocked_line_user_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (blocker_line_user_id, blocked_line_user_id),
  CONSTRAINT friend_blocks_no_self_reference
    CHECK (blocker_line_user_id <> blocked_line_user_id)
);

CREATE INDEX IF NOT EXISTS friend_blocks_blocked_idx
  ON friend_blocks (blocked_line_user_id);

CREATE TABLE IF NOT EXISTS friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  recipient_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT friend_requests_no_self_reference CHECK (requester_id <> recipient_id),
  CONSTRAINT friend_requests_status CHECK (status IN ('pending', 'accepted', 'rejected')),
  CONSTRAINT friend_requests_pair_unique UNIQUE (requester_id, recipient_id)
);

CREATE INDEX IF NOT EXISTS friend_requests_recipient_status_idx
  ON friend_requests (recipient_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS friend_requests_requester_status_idx
  ON friend_requests (requester_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS birthday_cards (
  share_token UUID PRIMARY KEY,
  owner_line_user_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  recipient_name TEXT NOT NULL,
  recipient_birthday TEXT NOT NULL,
  message TEXT NOT NULL,
  unlock_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT birthday_cards_recipient_name_length CHECK (
    char_length(recipient_name) BETWEEN 1 AND 80
  ),
  CONSTRAINT birthday_cards_message_length CHECK (
    char_length(message) BETWEEN 1 AND 2000
  ),
  CONSTRAINT birthday_cards_birthday_format CHECK (
    recipient_birthday ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
    AND CASE
      WHEN substring(recipient_birthday, 1, 2) = '02'
        THEN substring(recipient_birthday, 4, 2) <= '29'
      WHEN substring(recipient_birthday, 1, 2) IN ('04', '06', '09', '11')
        THEN substring(recipient_birthday, 4, 2) <= '30'
      ELSE TRUE
    END
  )
);

CREATE INDEX IF NOT EXISTS birthday_cards_owner_idx
  ON birthday_cards (owner_line_user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  receiver_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_private BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlock_at TIMESTAMPTZ NOT NULL,
  CONSTRAINT cards_no_self_reference CHECK (sender_id <> receiver_id),
  CONSTRAINT cards_message_length CHECK (char_length(message) BETWEEN 1 AND 1000)
);

ALTER TABLE cards DROP CONSTRAINT IF EXISTS cards_message_length;
ALTER TABLE cards
  ADD CONSTRAINT cards_message_length
  CHECK (char_length(message) BETWEEN 1 AND 1000) NOT VALID;

ALTER TABLE cards
  ADD COLUMN IF NOT EXISTS design_id TEXT NOT NULL DEFAULT 'classic';

CREATE INDEX IF NOT EXISTS cards_receiver_unlock_idx
  ON cards (receiver_id, unlock_at, created_at DESC);
CREATE INDEX IF NOT EXISTS cards_sender_created_idx
  ON cards (sender_id, created_at DESC);

CREATE TABLE IF NOT EXISTS card_reactions (
  card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE,
  user_line_user_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (card_id, user_line_user_id)
);

CREATE INDEX IF NOT EXISTS card_reactions_user_idx
  ON card_reactions (user_line_user_id);

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  line_user_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL UNIQUE,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  expiration_time TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx
  ON push_subscriptions (line_user_id);

CREATE TABLE IF NOT EXISTS push_notification_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  birthday_owner_line_user_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  recipient_line_user_id TEXT NOT NULL REFERENCES user_profiles(line_user_id) ON DELETE CASCADE,
  subscription_id UUID NOT NULL REFERENCES push_subscriptions(id) ON DELETE CASCADE,
  date_key DATE NOT NULL,
  reminder_type TEXT NOT NULL CHECK (reminder_type IN ('today', 'tomorrow')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT push_notification_deliveries_unique UNIQUE (
    birthday_owner_line_user_id,
    recipient_line_user_id,
    subscription_id,
    date_key,
    reminder_type
  )
);
