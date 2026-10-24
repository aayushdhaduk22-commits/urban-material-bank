ALTER TABLE materials ADD COLUMN IF NOT EXISTS age_years integer;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS previous_use text;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS dimensions text;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS carbon_factor_kg numeric DEFAULT 0;
ALTER TABLE materials ADD COLUMN IF NOT EXISTS inspection_status text DEFAULT 'Not inspected';