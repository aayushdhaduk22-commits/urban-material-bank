CREATE TABLE IF NOT EXISTS materials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  location TEXT NOT NULL,
  distance_km NUMERIC(6,2) NOT NULL DEFAULT 0,
  price NUMERIC(12,2) NOT NULL,
  unit TEXT NOT NULL,
  quantity NUMERIC(12,2) NOT NULL,
  quality TEXT NOT NULL,
  condition_note TEXT NOT NULL,
  seller_name TEXT NOT NULL,
  seller_type TEXT NOT NULL DEFAULT 'Contractor',
  verified BOOLEAN NOT NULL DEFAULT false,
  image_theme TEXT NOT NULL DEFAULT 'brick',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)