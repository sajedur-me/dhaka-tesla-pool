import type {
  FastifyReply,
  FastifyRequest,
} from "fastify";

import type { AuthenticatedUser } from "./auth.types.js";

type AuthUserRole = AuthenticatedUser["role"];

export function requireRole(...allowedRoles: AuthUserRole[]) {
  return async function roleGuard(
    request: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> {
    if (!allowedRoles.includes(request.user.role)) {
      await reply.code(403).send({
        error: "Forbidden",
      });
    }
  };
}
