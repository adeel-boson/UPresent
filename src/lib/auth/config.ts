import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";
import { z } from "zod";

import { authenticateUser } from "@/lib/auth/authenticate";

const credentialsSchema = z.object({
  email: z.string().min(1),
  password: z.string().min(1),
});

export const authConfig = {
  // Auth.js won't trust the request's Host header in production unless told
  // to — needed for `npm run start` locally, and for self-hosting generally
  // (Vercel is trusted automatically). Safe here: nothing sits in front of
  // this app rewriting the Host header from an untrusted origin.
  trustHost: true,
  session: {
    // Credentials-based sign-in requires JWT sessions — Auth.js can't
    // persist a database session for a provider it doesn't control.
    strategy: "jwt",
  },
  pages: {
    signIn: "/login",
  },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const parsed = credentialsSchema.safeParse(credentials);
        if (!parsed.success) {
          return null;
        }
        return authenticateUser(parsed.data);
      },
    }),
  ],
  callbacks: {
    jwt: ({ token, user }) => {
      if (user) {
        token.role = user.role;
      }
      return token;
    },
    session: ({ session, token }) => {
      if (session.user && token.role) {
        session.user.role = token.role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
