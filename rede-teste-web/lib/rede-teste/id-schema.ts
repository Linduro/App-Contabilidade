import { z } from "zod";

/** `User.id` no banco (cuid Prisma ou identificador gerado pelo Better Auth). */
export const jqUserIdSchema = z.string().min(1).max(128);

/** Entidades criadas pelo Prisma com `@default(cuid())`. */
export const jqCuidSchema = z.string().cuid();
