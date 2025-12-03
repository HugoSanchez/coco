-- Query to get all bills for a client from November, based on an invoice ID
--
-- This query:
-- 1. Takes an invoice ID
-- 2. Gets the client_id from that invoice
-- 3. Returns all bills for that client where the booking occurred in November
--
-- Usage: Replace :invoice_id with your actual invoice ID UUID

SELECT
    b.id AS bill_id,
    b.bill_number,
    b.amount,
    b.currency,
    b.status,
    b.created_at AS bill_created_at,
    b.sent_at,
    b.paid_at,
    b.client_id,
    b.client_name,
    b.client_email,
    bk.id AS booking_id,
    bk.start_time AS booking_start_time,
    bk.end_time AS booking_end_time,
    bk.status AS booking_status,
    i.id AS invoice_id,
    i.client_id AS invoice_client_id,
    i.year AS invoice_year,
    i.month AS invoice_month
FROM
    invoices i
    INNER JOIN bills b ON b.client_id = i.client_id
    INNER JOIN bookings bk ON bk.id = b.booking_id
WHERE
    i.id = :invoice_id  -- Replace with your invoice ID
    AND i.client_id IS NOT NULL
    AND EXTRACT(MONTH FROM bk.start_time) = 11  -- November
    AND EXTRACT(YEAR FROM bk.start_time) = COALESCE(i.year, EXTRACT(YEAR FROM CURRENT_DATE))
    -- If you want to use the invoice's year instead of the booking's year, use:
    -- AND EXTRACT(YEAR FROM bk.start_time) = COALESCE(i.year, EXTRACT(YEAR FROM CURRENT_DATE))
ORDER BY
    bk.start_time ASC;

-- Alternative version: If you want to filter by the invoice's issued_at month/year instead:
-- This would get bills from November of the year the invoice was issued

/*
SELECT
    b.id AS bill_id,
    b.bill_number,
    b.amount,
    b.currency,
    b.status,
    b.created_at AS bill_created_at,
    b.sent_at,
    b.paid_at,
    b.client_id,
    b.client_name,
    b.client_email,
    bk.id AS booking_id,
    bk.start_time AS booking_start_time,
    bk.end_time AS booking_end_time,
    bk.status AS booking_status,
    i.id AS invoice_id,
    i.client_id AS invoice_client_id,
    i.issued_at AS invoice_issued_at
FROM
    invoices i
    INNER JOIN bills b ON b.client_id = i.client_id
    INNER JOIN bookings bk ON bk.id = b.booking_id
WHERE
    i.id = :invoice_id
    AND i.client_id IS NOT NULL
    AND EXTRACT(MONTH FROM bk.start_time) = 11  -- November
    AND EXTRACT(YEAR FROM bk.start_time) = EXTRACT(YEAR FROM COALESCE(i.issued_at, i.created_at))
ORDER BY
    bk.start_time ASC;
*/

