'use strict';

require('dotenv').config();

const REQUIRED_VARS = [
  'NODE_ENV',
  'PORT',
  'JWT_SECRET',
  'JWT_ACCESS_EXPIRE',
  'JWT_REFRESH_SECRET',
  'JWT_REFRESH_EXPIRE',
];

const missing = REQUIRED_VARS.filter((key) => !process.env[key]);

if (missing.length > 0) {
  throw new Error(
    `[Config] Missing required environment variables:\n  ${missing.join('\n  ')}\n` +
      `Please check your .env file.`
  );
}

const config = Object.freeze({
  env: process.env.NODE_ENV,
  port: Number(process.env.PORT),

  jwt: {
    secret: process.env.JWT_SECRET,
    accessExpire: process.env.JWT_ACCESS_EXPIRE,
    refreshSecret: process.env.JWT_REFRESH_SECRET,
    refreshExpire: process.env.JWT_REFRESH_EXPIRE,
  },

  app: {
    name: process.env.APP_NAME || 'BillingPro',
    frontendUrl: process.env.FRONTEND_URL || 'http://localhost:5174',
  },

  smtp: {
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.EMAIL_FROM || 'noreply@billingpro.com',
  },

  oauth: {
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    },
    github: {
      clientId: process.env.GITHUB_CLIENT_ID,
      clientSecret: process.env.GITHUB_CLIENT_SECRET,
    },
  },

  razorpay: {
    keyId: process.env.RAZORPAY_KEY_ID,
    keySecret: process.env.RAZORPAY_KEY_SECRET,
    webhookSecret: process.env.RAZORPAY_WEBHOOK_SECRET,
  },

  twilio: {
    accountSid: process.env.TWILIO_ACCOUNT_SID,
    authToken: process.env.TWILIO_AUTH_TOKEN,
    whatsappFrom: process.env.TWILIO_WHATSAPP_FROM, // e.g. 'whatsapp:+14155238886'
    smsFrom: process.env.TWILIO_SMS_FROM,
  },

  security: {
    bcryptRounds: Number(process.env.BCRYPT_ROUNDS) || 12,
    maxLoginAttempts: Number(process.env.MAX_LOGIN_ATTEMPTS) || 5,
    lockoutDuration: Number(process.env.LOCKOUT_DURATION) || 15, // minutes
  },

  isDev: process.env.NODE_ENV === 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest: process.env.NODE_ENV === 'test',
});

module.exports = config;
