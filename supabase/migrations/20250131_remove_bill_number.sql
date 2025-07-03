-- Remove bill_number column and related function
-- Migration: Remove bill_number field from bills table

-- Drop the generate_bill_number function
DROP FUNCTION IF EXISTS generate_bill_number();

-- Remove the bill_number column from bills table
ALTER TABLE bills DROP COLUMN IF EXISTS bill_number;
