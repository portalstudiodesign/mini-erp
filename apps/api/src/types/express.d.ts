import type { Role } from "../generated/prisma/enums.js";

declare global {
  namespace Express {
    interface Request {
      user?: { id: number; email: string; name: string; role: Role };
    }
  }
}

export {};
