-- Fix billing types to support new per_booking/monthly system
-- This migration removes the obsolete trigger function since due_date column was dropped

-- Drop the obsolete trigger and function since due_date column no longer exists
DROP TRIGGER IF EXISTS calculate_bill_due_date_trigger ON bills;
DROP FUNCTION IF EXISTS calculate_bill_due_date();
