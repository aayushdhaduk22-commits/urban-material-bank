ALTER TABLE materials ADD COLUMN IF NOT EXISTS owner_user_id text;
CREATE INDEX IF NOT EXISTS idx_materials_owner_user_id ON materials(owner_user_id);