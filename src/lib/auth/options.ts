import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { connectToDatabase } from "@/lib/db/mongoose";
import { User } from "@/lib/db/models/User";

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;
        await connectToDatabase();
        const user = await User.findOne({ email: credentials.email.toLowerCase() });
        if (!user) return null;
        const valid = await bcrypt.compare(credentials.password, user.passwordHash);
        if (!valid) return null;
        return {
          id: user._id.toString(),
          name: user.displayName,
          email: user.email,
          image: user.avatar,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger, session }) {
      if (user) {
        token.uid = user.id;
        token.avatar = (user as { image?: string }).image ?? "fox";
        token.displayName = user.name ?? "Player";
      }
      // Allow client-driven session updates (e.g. avatar/name change).
      if (trigger === "update" && session) {
        if (session.avatar) token.avatar = session.avatar;
        if (session.displayName) token.displayName = session.displayName;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
        session.user.avatar = (token.avatar as string) ?? "fox";
        session.user.displayName = (token.displayName as string) ?? session.user.name ?? "Player";
        session.user.name = session.user.displayName;
      }
      return session;
    },
  },
  secret: process.env.NEXTAUTH_SECRET,
};
