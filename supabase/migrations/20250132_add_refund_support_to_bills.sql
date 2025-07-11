-- Add refund support to bills table
-- This migration enables full refund tracking for paid consultations

-- Add refund tracking fields to bills table
ALTER TABLE bills
ADD COLUMN refunded_amount DECIMAL(10,2) DEFAULT 0 NOT NULL,
ADD COLUMN stripe_refund_id VARCHAR(255), -- Store Stripe refund ID for tracking
ADD COLUMN refunded_at TIMESTAMPTZ, -- When refund was processed
ADD COLUMN refund_reason TEXT; -- Optional reason for refund

-- Update the existing status constraint to include 'refunded'
ALTER TABLE bills DROP CONSTRAINT IF EXISTS bills_status_check;
ALTER TABLE bills ADD CONSTRAINT bills_status_check
CHECK (status IN ('pending', 'sent', 'paid', 'disputed', 'canceled', 'refunded'));

-- Add constraint to ensure refunded amount doesn't exceed bill amount
ALTER TABLE bills
ADD CONSTRAINT bills_refund_amount_valid
CHECK (refunded_amount >= 0 AND refunded_amount <= amount);

-- Add index for efficient refund queries
CREATE INDEX idx_bills_refund_status ON bills(status) WHERE status = 'refunded';
CREATE INDEX idx_bills_stripe_refund_id ON bills(stripe_refund_id) WHERE stripe_refund_id IS NOT NULL;

-- Add helpful comments
COMMENT ON COLUMN bills.refunded_amount IS 'Amount refunded to customer (equals amount for full refunds)';
COMMENT ON COLUMN bills.stripe_refund_id IS 'Stripe refund ID for tracking refund status and webhooks';
COMMENT ON COLUMN bills.refunded_at IS 'Timestamp when refund was successfully processed';
COMMENT ON COLUMN bills.refund_reason IS 'Optional reason for issuing the refund';

-- Update table comment to reflect refund support
COMMENT ON TABLE bills IS 'Individual charges for consultations with full refund support. Bills can be: pending → sent → paid → refunded. Each booking generates one bill.';
