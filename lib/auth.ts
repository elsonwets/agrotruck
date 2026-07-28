import "server-only";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";
import { emailOTP } from "better-auth/plugins";
import { Resend } from "resend";
import { db } from "@/db";
import { accounts, sessions, users, verifications } from "@/db/schema";
import { getSiteUrl } from "@/lib/site-url";

export const auth = betterAuth({
  appName: "AgroTruck",
  baseURL: process.env.BETTER_AUTH_URL ?? getSiteUrl(),
  secret: process.env.BETTER_AUTH_SECRET ?? process.env.VERIFICATION_CODE_SECRET,
  trustedOrigins: [getSiteUrl()],
  database: drizzleAdapter(db, {
    provider: "pg",
    schema: { users, sessions, accounts, verifications },
  }),
  user: {
    modelName: "users",
    additionalFields: {
      accountType: { type: "string", required: false, defaultValue: "individual", input: false },
      phone: { type: "string", required: false },
      whatsapp: { type: "string", required: false },
      city: { type: "string", required: false },
      companyName: { type: "string", required: false },
    },
  },
  session: { modelName: "sessions" },
  account: { modelName: "accounts" },
  verification: { modelName: "verifications" },
  advanced: { database: { generateId: "uuid" } },
  plugins: [
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      allowedAttempts: 5,
      storeOTP: "hashed",
      async sendVerificationOTP({ email, otp }) {
        const apiKey = process.env.RESEND_API_KEY;
        const from = process.env.EMAIL_FROM;
        if (!apiKey || !from) throw new Error("RESEND_API_KEY and EMAIL_FROM must be configured");
        const result = await new Resend(apiKey).emails.send({
          from,
          to: email,
          subject: `${otp} — código de acesso AgroTruck`,
          html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:32px;color:#111"><h1 style="color:#0B3D2E">AgroTruck</h1><p>Use o código abaixo para entrar na sua conta:</p><p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#0B3D2E">${otp}</p><p>Este código expira em 10 minutos. Se não pediu este acesso, ignore esta mensagem.</p></div>`,
        });
        if (result.error) throw new Error(result.error.message);
      },
    }),
    nextCookies(),
  ],
});
