"use client";

import { createAuthClient } from "better-auth/react";
import { emailOTPClient, inferAdditionalFields, phoneNumberClient } from "better-auth/client/plugins";
import type { auth } from "@/lib/auth";

export const authClient = createAuthClient({
  plugins: [inferAdditionalFields<typeof auth>(), emailOTPClient(), phoneNumberClient()],
  sessionOptions: {
    refetchInterval: 0,
    refetchOnWindowFocus: false,
    refetchWhenOffline: false,
  },
});
