const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 3001;

// Middleware
app.use(cors());
app.use(express.json());

// Email configuration
const transporter = nodemailer.createTransporter({
  service: 'gmail',
  auth: {
    user: 'ggggzzzz0504133@gmail.com', // Your email
    pass: 'YOUR_APP_PASSWORD' // You need to generate an App Password in Gmail
  }
});

// Contact form endpoint
app.post('/send-email', async (req, res) => {
  try {
    const { firstName, lastName, email, subject, message } = req.body;

    const mailOptions = {
      from: 'ggggzzzz0504133@gmail.com',
      to: 'ggggzzzz0504133@gmail.com',
      subject: `פנייה חדשה מאתר - ${subject}`,
      html: `
        <h2>פנייה חדשה מאתר MD Finance</h2>
        <p><strong>שם:</strong> ${firstName} ${lastName}</p>
        <p><strong>אימייל:</strong> ${email}</p>
        <p><strong>נושא:</strong> ${subject}</p>
        <p><strong>הודעה:</strong></p>
        <p>${message || 'אין הודעה נוספת'}</p>
        <hr>
        <p><em>נשלח מאתר MD Finance</em></p>
      `
    };

    await transporter.sendMail(mailOptions);
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Error sending email:', error);
    res.status(500).json({ success: false, message: 'Error sending email' });
  }
});

app.listen(PORT, () => {
  console.log(`Email server running on port ${PORT}`);
});
