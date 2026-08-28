import type { DefaultSession } from "next-auth";

export type AppRole = "admin" | "account_manager" | "content_writer" | "client";
export type AppUserStatus = "invited" | "active" | "disabled";

declare module "next-auth" {
  interface User {
    role: AppRole;
    clientAccountId?: string | null;
    status: AppUserStatus;
  }

  interface Session {
    user: {
      id: string;
      role: AppRole;
      clientAccountId: string | null;
      status: AppUserStatus;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role: AppRole;
    clientAccountId?: string | null;
    status: AppUserStatus;
  }
}
