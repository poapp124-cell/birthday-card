import NextAuth from "next-auth"
import Line from "next-auth/providers/line"
import { ensureBirthdayProfile } from "@/lib/birthday-profile";

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Line({
      clientId: process.env.AUTH_LINE_ID,
      clientSecret: process.env.AUTH_LINE_SECRET,
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, account }) {
      if (account?.provider === "line") {
        const lineUserId = account.providerAccountId;
        if (!lineUserId) {
          throw new Error("LINE authentication did not return a stable user ID.");
        }

        token.sub = lineUserId;

        if (process.env.DATABASE_URL) {
          const created = await ensureBirthdayProfile(
            lineUserId,
            user?.name,
            user?.image,
          );
          console.info("[auth] LINE profile synchronized", {
            result: created ? "created" : "existing",
          });
        } else {
          console.info("[auth] LINE profile synchronization skipped", {
            reason: "database-not-configured",
          });
        }
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user && token.sub) {
        session.user.id = token.sub;
      }

      return session;
    },
  },
})