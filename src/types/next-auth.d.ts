import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role?: string;
    memberId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      email?: string | null;
      name?: string | null;
      role: string;
      memberId: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    memberId?: string | null;
  }
}
