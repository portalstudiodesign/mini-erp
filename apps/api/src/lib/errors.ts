export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new AppError(400, "BAD_REQUEST", message, details);
export const unauthorized = (message = "Autentificare necesară") =>
  new AppError(401, "UNAUTHORIZED", message);
export const forbidden = (message = "Nu ai drepturi pentru această acțiune") =>
  new AppError(403, "FORBIDDEN", message);
export const notFound = (what: string) => new AppError(404, "NOT_FOUND", `${what} nu există`);
export const conflict = (code: string, message: string, details?: unknown) =>
  new AppError(409, code, message, details);
