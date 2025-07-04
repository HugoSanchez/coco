-- Create email_communications table
-- Tracks all email communications between practitioners and their clients

CREATE TABLE email_communications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL, -- The practitioner sending the email
  client_id UUID REFERENCES clients(id), -- The client receiving the email

  -- Email details
  email_type VARCHAR NOT NULL, -- 'bill', 'reminder', etc.
  recipient_email VARCHAR NOT NULL, -- Email address where it was sent
  recipient_name VARCHAR, -- Name of the recipient
  subject VARCHAR, -- Email subject line

  -- Related records (flexible references)
  bill_id UUID REFERENCES bills(id), -- If email is related to a bill
  booking_id UUID REFERENCES bookings(id), -- If email is related to a booking

  -- Status tracking
  status VARCHAR NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed'
  sent_at TIMESTAMPTZ, -- When the email was successfully sent
  error_message TEXT, -- Error details if sending failed

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX email_communications_user_id_idx ON email_communications(user_id);
CREATE INDEX email_communications_client_id_idx ON email_communications(client_id);
CREATE INDEX email_communications_bill_id_idx ON email_communications(bill_id);
CREATE INDEX email_communications_status_idx ON email_communications(status);
CREATE INDEX email_communications_created_at_idx ON email_communications(created_at);

-- Add composite index for practitioner's email history (most common query)
CREATE INDEX email_communications_user_created_idx ON email_communications(user_id, created_at DESC);

-- Add RLS policies (Row Level Security)
ALTER TABLE email_communications ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see their own email communications
CREATE POLICY "Users can view their own email communications" ON email_communications
  FOR SELECT USING (auth.uid() = user_id);

-- Policy: Users can insert their own email communications
CREATE POLICY "Users can create their own email communications" ON email_communications
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own email communications
CREATE POLICY "Users can update their own email communications" ON email_communications
  FOR UPDATE USING (auth.uid() = user_id);
