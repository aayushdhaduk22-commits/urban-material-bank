ALTER TABLE materials ADD COLUMN IF NOT EXISTS seller_mobile text;
CREATE INDEX IF NOT EXISTS idx_materials_seller_mobile ON materials(seller_mobile);