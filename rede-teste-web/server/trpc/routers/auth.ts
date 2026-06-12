import { router, protectedProcedure, publicProcedure } from "../trpc";
import { getUserPermissions } from "@/lib/rbac";

export const authRouter = router({
  me: protectedProcedure.query(async ({ ctx }) => {
    const user = await ctx.prisma.user.findUnique({
      where: { id: ctx.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        image: true,
        emailVerified: true,
        twoFactorEnabled: true,
        createdAt: true,
      },
    });
    const perms = await getUserPermissions(ctx.user.id);
    return { user, permissions: Array.from(perms) };
  }),
  ping: publicProcedure.query(() => ({ ok: true, ts: new Date().toISOString() })),
});
