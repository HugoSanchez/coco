-- Add billing_settings_id foreign key to bookings table
ALTER TABLE bookings
ADD COLUMN billing_settings_id UUID REFERENCES billing_settings(id) ON DELETE SET NULL;

-- Add index for efficient queries
CREATE INDEX idx_bookings_billing_settings_id ON bookings(billing_settings_id);

-- Add comment to explain the relationship
COMMENT ON COLUMN bookings.billing_settings_id IS 'References the billing configuration used for this booking. Null means use default billing settings.';
