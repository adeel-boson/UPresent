import Credentials from "next-auth/providers/credentials";
import type { NextAuthConfig } from "next-auth";

import { prisma } from "@/lib/prisma";
import { verifyPassword } from "@/lib/auth/password";

export const authConfig = {
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
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
          return null;
        }

        const isValidPassword = await verifyPassword(
          password,
          user.hashedPassword,
        );
        if (!isValidPassword) {
          return null;
        }

        return { id: user.id, email: user.email, role: user.role };
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
