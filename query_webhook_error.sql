-- Query to investigate the second Sentry error
-- Stripe Session ID: cs_live_b1HUplQdEj9eUtDlrlCttMfujeKIpfQw8UoCXrRJQs01dGdesfHRcXnIAF
-- Practitioner User ID: 40930dc0-6efb-43fa-b3e2-6f5817827bbf

-- 1. Find the payment session for this Stripe session ID
SELECT
    ps.id as payment_session_id,
    ps.booking_id,
    ps.invoice_id,
    ps.status as payment_status,
    ps.amount,
    ps.created_at,
    ps.completed_at,
    ps.stripe_session_id,
    ps.stripe_payment_intent_id
FROM payment_sessions ps
WHERE ps.stripe_session_id = 'cs_live_b1HUplQdEj9eUtDlrlCttMfujeKIpfQw8UoCXrRJQs01dGdesfHRcXnIAF';

-- 2. If it has a booking_id, get booking details
-- (Run this if booking_id is not null from query 1)
SELECT
    b.id,
    b.user_id,
    b.client_id,
    b.start_time,
    b.end_time,
    b.status,
    b.series_id,
    b.occurrence_index
FROM bookings b
WHERE b.id = (
    SELECT booking_id
    FROM payment_sessions
    WHERE stripe_session_id = 'cs_live_b1HUplQdEj9eUtDlrlCttMfujeKIpfQw8UoCXrRJQs01dGdesfHRcXnIAF'
    LIMIT 1
);

-- 3. If it has an invoice_id, get invoice details (and check if it's the same as error 1)
-- (Run this if invoice_id is not null from query 1)
SELECT
    i.id,
    i.user_id,
    i.status,
    i.total,
    i.paid_at,
    i.created_at,
    i.stripe_receipt_url
FROM invoices i
WHERE i.id = (
    SELECT invoice_id
    FROM payment_sessions
    WHERE stripe_session_id = 'cs_live_b1HUplQdEj9eUtDlrlCttMfujeKIpfQw8UoCXrRJQs01dGdesfHRcXnIAF'
    LIMIT 1
);

-- 4. Check if the specific invoice from this payment session was paid
-- Invoice ID: 9a9de0e5-f050-4b39-891c-a58a1c150eel
SELECT
    i.id,
    i.status,
    i.total,
    i.paid_at,
    i.created_at,
    i.issued_at,
    i.stripe_receipt_url,
    ps.id as payment_session_id,
    ps.status as payment_session_status,
    ps.completed_at as payment_session_completed_at,
    ps.stripe_session_id,
    ps.stripe_payment_intent_id
FROM invoices i
LEFT JOIN payment_sessions ps ON ps.invoice_id = i.id
WHERE i.id = '9a9de0e5-f050-4b39-891c-a58a1c150eel';

-- 5. Check all invoices for this practitioner that are already paid
-- (To see if this matches error 1)
SELECT
    i.id,
    i.status,
    i.total,
    i.paid_at,
    i.created_at,
    ps.stripe_session_id,
    ps.booking_id
FROM invoices i
LEFT JOIN payment_sessions ps ON ps.invoice_id = i.id
WHERE i.user_id = '40930dc0-6efb-43fa-b3e2-6f5817827bbf'
  AND i.status = 'paid'
ORDER BY i.paid_at DESC
LIMIT 10;

