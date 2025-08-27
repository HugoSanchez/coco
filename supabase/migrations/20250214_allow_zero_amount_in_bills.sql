-- Allow zero-amount bills (0 EUR) by relaxing the CHECK constraint

-- 1) Drop the old constraint if it exists
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_amount_positive;

-- 2) Add new constraint allowing zero
ALTER TABLE bills ADD CONSTRAINT bills_amount_nonnegative CHECK (amount >= 0);

-- Note: Existing rows are unaffected unless they violate the new constraint (they won't).
-- This enables zero-total bookings to follow the normal flow with a bill recorded as 0.
