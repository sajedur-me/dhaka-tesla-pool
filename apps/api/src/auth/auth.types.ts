import "@fastify/jwt";

type AuthUserRole = "PASSENGER" | "DRIVER";

declare module "@fastify/jwt" {
  interface FastifyJWT {
    payload: {
      sub: string;
      role: AuthUserRole;
    };

    user: {
      sub: string;
      role: AuthUserRole;
    };
  }
}

export type AuthenticatedUser = {
  sub: string;
  role: AuthUserRole;
};
