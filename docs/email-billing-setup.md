# Email Billing System Setup

This document explains how to set up and use the email billing system for sending consultation bills to clients.

## 🎯 Overview

The email billing system automatically sends professional consultation bills to clients based on their billing schedule. It uses **Resend** for reliable email delivery and **React Email** for beautiful HTML templates.

### Features

- ✅ Professional HTML email templates
- ✅ Automatic consultation bill processing
- ✅ Bulk email sending with error tracking
- ✅ Support for before/after consultation billing
- ✅ Email delivery tracking
- ✅ Automatic billing schedule status updates

## 🔧 Setup

### 1. Get a Resend API Key

1. Go to [Resend.com](https://resend.com) and create an account
2. Navigate to the **API Keys** section in your dashboard
3. Create a new API key (starts with `re_`)
4. Copy the API key for the next step

### 2. Environment Variables

Add these variables to your `.env.local` file:

```bash
# Resend Email Configuration
RESEND_API_KEY=re_YourActualAPIKey_FromResendDashboard
EMAIL_FROM=billing@yourdomain.com
EMAIL_REPLY_TO=support@yourdomain.com
```

**Important Notes:**

- `EMAIL_FROM` must be a domain you own and verify with Resend
- For testing, you can use `onboarding@resend.dev` as `EMAIL_FROM`
- `EMAIL_REPLY_TO` is optional but recommended

### 3. Domain Verification (Production)

For production use:

1. Add your domain in Resend dashboard
2. Follow Resend's domain verification steps
3. Update `EMAIL_FROM` to use your verified domain

## 🧪 Testing

### Test Email Configuration

Test that your email setup is working:

```bash
# Test with default settings
curl -X GET http://localhost:3000/api/test-email

# Send test email to your address
curl -X POST http://localhost:3000/api/test-email \
  -H "Content-Type: application/json" \
  -d '{
    "to": "your-email@example.com",
    "clientName": "Test Client",
    "amount": 100,
    "billingTrigger": "before_consultation"
  }'
```

Expected response for successful setup:

```json
{
	"success": true,
	"message": "Test email sent successfully!",
	"email_id": "re_abc123...",
	"email_details": {
		"to": "your-email@example.com",
		"subject": "Factura de Consulta - Pago Requerido | 2025-01-20",
		"amount": 100,
		"trigger": "before_consultation"
	}
}
```

## 📧 Using the Email Billing System

### 1. Get Consultation Bills Due Today

See what consultation bills are ready to be sent:

```bash
curl -X GET http://localhost:3000/api/billing/consultation
```

This returns all consultation bills that are due for processing today.

### 2. Send All Consultation Bills

Send emails for all consultation bills due today:

```bash
curl -X POST http://localhost:3000/api/billing/consultation
```

### 3. Preview Emails (Dry Run)

See what emails would be sent without actually sending them:

```bash
curl -X POST http://localhost:3000/api/billing/consultation \
  -H "Content-Type: application/json" \
  -d '{"dry_run": true}'
```

### 4. Send Specific Consultation Bills

Send emails for specific bookings only:

```bash
curl -X POST http://localhost:3000/api/billing/consultation \
  -H "Content-Type: application/json" \
  -d '{
    "booking_ids": ["booking-uuid-1", "booking-uuid-2"]
  }'
```

## 📊 Email Response Format

When sending emails, the API returns detailed results:

```json
{
	"success": true,
	"total": 5,
	"emails_sent": 4,
	"emails_failed": 1,
	"results": [
		{
			"to": "client@example.com",
			"clientName": "Hugo Sanchez",
			"amount": 80,
			"billingTrigger": "before_consultation",
			"emailId": "re_abc123...",
			"status": "sent"
		}
	],
	"errors": [
		{
			"to": "invalid-email",
			"error": "Invalid email address",
			"status": "failed"
		}
	]
}
```

## 🔄 Automation (Optional)

For automated billing, you can set up a cron job or scheduled task:

### Daily Billing Cron Job

Add to your crontab (runs daily at 9 AM):

```bash
0 9 * * * curl -X POST http://localhost:3000/api/billing/consultation
```

### Using GitHub Actions

Create `.github/workflows/daily-billing.yml`:

```yaml
name: Daily Consultation Billing
on:
    schedule:
        - cron: '0 9 * * *' # 9 AM daily
jobs:
    send-bills:
        runs-on: ubuntu-latest
        steps:
            - name: Send consultation bills
              run: |
                  curl -X POST ${{ secrets.APP_URL }}/api/billing/consultation
```

## 🎨 Email Template

The system includes a professional Spanish email template with:

- **Header**: Professional branding with your practice name
- **Bill Details**: Client name, consultation date, amount, billing type
- **Instructions**: Clear payment instructions based on billing trigger
- **Footer**: Professional closing and contact information

### Email Template Features

- ✅ Responsive design (works on mobile and desktop)
- ✅ Professional styling with consistent branding
- ✅ Spanish language support
- ✅ Different content for before/after consultation billing
- ✅ Clear call-to-action for payments

## 🔧 Troubleshooting

### Common Issues

**"RESEND_API_KEY is required"**

- Add your Resend API key to `.env.local`
- Restart your development server

**"Invalid sender email domain"**

- Verify your domain with Resend
- Or use `onboarding@resend.dev` for testing

**"No consultation bills to process"**

- Check that you have booking data with billing schedules
- Use the seed endpoints to create test data
- Verify the consultation date triggers billing correctly

**Emails not being received**

- Check spam/junk folders
- Verify email addresses are correct
- Check Resend dashboard for delivery status

### Debug Mode

Enable detailed logging by checking your server console when making requests. All email operations log detailed information with emoji prefixes:

- 🧪 `[TEST]` - Email testing operations
- 📧 `[EMAIL]` - Email sending operations
- ✅ `[EMAIL]` - Successful email sends
- ❌ `[EMAIL]` - Email failures
- 📧 `[API]` - API billing operations

## 🎯 Next Steps

Once you have emails working:

1. **Customize Email Template**: Edit `src/lib/emails/consultation-bill.tsx`
2. **Add Payment Links**: Include payment processor links in emails
3. **Set up Webhooks**: Track email opens and clicks with Resend webhooks
4. **Add Email Preferences**: Let clients choose email preferences
5. **Multi-language Support**: Add email templates in other languages

## 📚 API Reference

### Email Service Functions

```typescript
// Send single consultation bill email
await sendConsultationBillEmail({
	to: 'client@example.com',
	clientName: 'Hugo Sanchez',
	consultationDate: '2025-01-20',
	amount: 80,
	billingTrigger: 'before_consultation',
	practitionerName: 'Dr. María González'
})

// Send multiple consultation bills
await sendBulkConsultationBills([...bills])

// Validate email configuration
const validation = validateEmailConfig()
```

### API Endpoints

| Endpoint                    | Method | Purpose                             |
| --------------------------- | ------ | ----------------------------------- |
| `/api/test-email`           | GET    | Test email configuration            |
| `/api/test-email`           | POST   | Send test email to specific address |
| `/api/billing/consultation` | GET    | Get consultation bills due today    |
| `/api/billing/consultation` | POST   | Send consultation bill emails       |

---

## 📞 Support

If you need help setting up the email billing system:

1. Check the troubleshooting section above
2. Verify your environment variables are correct
3. Test with the `/api/test-email` endpoint first
4. Check server logs for detailed error messages

The email billing system is designed to be reliable and easy to use. Once set up, it will handle all consultation billing automatically!
