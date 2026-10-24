ALTER TABLE materials ADD COLUMN IF NOT EXISTS listing_status text NOT NULL DEFAULT 'active';
CREATE INDEX IF NOT EXISTS idx_materials_owner_status ON materials(owner_user_id, listing_status);
UPDATE materials SET listing_status='active' WHERE listing_status IS NULL;