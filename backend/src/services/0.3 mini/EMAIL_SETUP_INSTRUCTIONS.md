# Email Setup Instructions for MD Finance Contact Form

## Current Implementation
The contact form is currently set up to open the user's default email client with a pre-filled email to `ggggzzzz0504133@gmail.com`.

## How It Works
1. User fills out the contact form
2. When they click "שלח הודעה" (Send Message), it opens their email client
3. The email is pre-filled with:
   - To: ggggzzzz0504133@gmail.com
   - Subject: פנייה חדשה מאתר - [Selected Subject]
   - Body: All form data formatted nicely

## Advanced Email Setup (Optional)

### Option 1: EmailJS (Recommended for Production)
1. Go to [EmailJS.com](https://www.emailjs.com/)
2. Create a free account
3. Create an email service (Gmail)
4. Create an email template
5. Get your Public Key
6. Update the code in `src/app/pages/home/home.ts`:
   - Replace `YOUR_EMAILJS_PUBLIC_KEY` with your actual key
   - Replace `service_contact_form` with your service ID
   - Replace `template_contact_form` with your template ID

### Option 2: Backend Email Server
1. Install dependencies:
   ```bash
   npm install express nodemailer cors
   npm install -g nodemon
   ```

2. Set up Gmail App Password:
   - Go to Google Account settings
   - Enable 2-factor authentication
   - Generate an App Password for Gmail
   - Replace `YOUR_APP_PASSWORD` in `email-server.js`

3. Run the email server:
   ```bash
   node email-server.js
   ```

4. Update the frontend to use the backend API

## Current Status
✅ Contact form opens email client with pre-filled data
✅ Email is addressed to ggggzzzz0504133@gmail.com
✅ All form data is included in the email body
✅ Form validation is working
✅ Success message is shown

## Testing
1. Fill out the contact form
2. Click "שלח הודעה"
3. Your email client should open with the pre-filled email
4. Send the email to test the functionality
