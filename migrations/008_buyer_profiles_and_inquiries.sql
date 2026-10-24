CREATE TABLE IF NOT EXISTS user_profiles (
  user_id text PRIMARY KEY,
  email text NOT NULL,
  username text NOT NULL,
  full_name text NOT NULL,
  age integer NOT NULL CHECK (age BETWEEN 1 AND 120),
  occupation text NOT NULL,
  city text NOT NULL,
  locality text NOT NULL,
  phone text NOT NULL,
  bio text NOT NULL DEFAULT '',
  avatar_key text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS user_profiles_username_lower_idx ON user_profiles (lower(username));
CREATE TABLE IF NOT EXISTS buyer_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  material_id uuid NOT NULL REFERENCES materials(id) ON DELETE CASCADE,
  seller_user_id text NOT NULL,
  buyer_user_id text NOT NULL,
  buyer_mobile text NOT NULL,
  message text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','closed')),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (material_id, buyer_user_id)
);
CREATE INDEX IF NOT EXISTS buyer_requests_seller_created_idx ON buyer_requests (seller_user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS buyer_requests_buyer_created_idx ON buyer_requests (buyer_user_id, created_at DESC);