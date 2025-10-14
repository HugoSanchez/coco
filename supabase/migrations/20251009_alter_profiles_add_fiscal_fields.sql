-- Add fiscal identity fields to profiles
-- Up
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS tax_id TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_address_line1 TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_address_line2 TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_city TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_province TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_postal_code TEXT,
  ADD COLUMN IF NOT EXISTS fiscal_country TEXT DEFAULT 'ES';

-- Optional simple index on tax_id for faster lookups (not unique)
CREATE INDEX IF NOT EXISTS idx_profiles_tax_id ON profiles(tax_id);

-- Down (no-op for safety)
-- ALTER TABLE profiles DROP COLUMN tax_id;
-- ALTER TABLE profiles DROP COLUMN fiscal_address_line1;
-- ALTER TABLE profiles DROP COLUMN fiscal_address_line2;
-- ALTER TABLE profiles DROP COLUMN fiscal_city;
-- ALTER TABLE profiles DROP COLUMN fiscal_province;
-- ALTER TABLE profiles DROP COLUMN fiscal_postal_code;
-- ALTER TABLE profiles DROP COLUMN fiscal_country;

