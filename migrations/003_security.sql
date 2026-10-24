CREATE TABLE IF NOT EXISTS listing_rate_limits (
  fingerprint TEXT PRIMARY KEY,
  window_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_materials_created_at ON materials(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_materials_category_location ON materials(category, location);