import type { NextAuthConfig } from "next-auth";
import type { AppRole, AppUserStatus } from "@/types/next-auth";

// Edge-safe config shared with middleware. No DB or Node-only deps here.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: { strategy: "jwt" },
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.clientAccountId = user.clientAccountId ?? null;
        token.status = user.status;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.role = token.role as AppRole;
        session.user.clientAccountId = (token.clientAccountId as string | null) ?? null;
        session.user.status = token.status as AppUserStatus;
      }
      return session;
    },
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const { pathname } = request.nextUrl;

      const isPublic =
        pathname === "/" ||
        pathname.startsWith("/login") ||
        pathname.startsWith("/api/auth") ||
        pathname.startsWith("/api/webhooks");

      if (isPublic) return true;
      if (!isLoggedIn) return false;

      const role = auth!.user.role;
      const isAgency = role === "admin" || role === "account_manager";
      const isPreviewing = Boolean(request.cookies.get("i3_preview_user")?.value);

      // Area isolation: clients cannot see the agency app and vice versa.
      if (pathname.startsWith("/agency") && !isAgency && !isPreviewing) {
        return Response.redirect(new URL("/portal", request.nextUrl));
      }
      if (pathname.startsWith("/portal") && isAgency && !isPreviewing) {
        return Response.redirect(new URL("/agency", request.nextUrl));
      }
      // Admin-only sections.
      if (pathname.startsWith("/agency/calendar") && role !== "admin") {
        return Response.redirect(new URL("/agency", request.nextUrl));
      }
      return true;
    },
  },
} satisfies NextAuthConfig;
