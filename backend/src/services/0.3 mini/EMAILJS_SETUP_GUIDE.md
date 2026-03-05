# EmailJS Setup Guide for MD Finance Contact Form

## Your EmailJS Public Key
**Public Key**: `sFwpqAdTOoobasQDE`

## Required Setup Steps

### 1. Create Email Service in EmailJS Dashboard
1. Go to [EmailJS Dashboard](https://dashboard.emailjs.com/)
2. Navigate to "Email Services"
3. Click "Add New Service"
4. Choose "Gmail" as your email service
5. Connect your Gmail account (`ggggzzzz0504133@gmail.com`)
6. **Important**: Name the service `service_contact_form`

### 2. Create Email Template
1. Go to "Email Templates" in EmailJS Dashboard
2. Click "Create New Template"
3. **Important**: Name the template `template_contact_form`
4. Use this template content:

**Subject**: `פנייה חדשה מאתר - {{subject}}`

**Body**:
```html
<h2>פנייה חדשה מאתר MD Finance</h2>
<p><strong>שם:</strong> {{from_name}}</p>
<p><strong>אימייל:</strong> {{from_email}}</p>
<p><strong>נושא:</strong> {{subject}}</p>
<p><strong>הודעה:</strong></p>
<p>{{message}}</p>
<hr>
<p><em>נשלח מאתר MD Finance</em></p>
```

### 3. Template Variables Used
- `{{from_name}}` - Full name from form
- `{{from_email}}` - User's email address
- `{{subject}}` - Selected subject from form
- `{{message}}` - User's message
- `{{to_email}}` - Your email address (ggggzzzz0504133@gmail.com)

## Current Implementation

The contact form is now configured to:
1. **Primary**: Send emails directly via EmailJS to `ggggzzzz0504133@gmail.com`
2. **Fallback**: If EmailJS fails, open user's email client with pre-filled content

## Testing
1. Fill out the contact form
2. Click "שלח הודעה"
3. Check your email at `ggggzzzz0504133@gmail.com`
4. You should receive a formatted email with all form data

## Troubleshooting
- If emails don't arrive, check EmailJS dashboard for error logs
- Ensure service and template names match exactly: `service_contact_form` and `template_contact_form`
- Verify Gmail connection in EmailJS dashboard
- Check spam folder for emails

## Current Status
✅ EmailJS integration implemented
✅ Public key configured: `sFwpqAdTOoobasQDE`
✅ Fallback mechanism in place
✅ Form validation working
✅ Success message displayed
