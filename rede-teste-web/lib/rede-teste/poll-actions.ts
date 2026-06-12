import type { PrismaClient } from "@prisma/client";
import { TRPCError } from "@trpc/server";
import { jqPublicationVisibleWhere } from "@/lib/rede-teste/global-scope";
import { pollIsOpen } from "@/lib/rede-teste/poll-db";

export async function voteJqPoll(
  prisma: PrismaClient,
  userId: string,
  publicationId: string,
  optionId: string,
) {
  const pub = await prisma.redeTestePublication.findFirst({
    where: jqPublicationVisibleWhere(userId, {
      id: publicationId,
      parentId: null,
    }),
    select: { id: true },
  });
  if (!pub) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Publicação não encontrada" });
  }

  const poll = await prisma.redeTestePoll.findUnique({
    where: { publicationId },
    include: { options: { orderBy: { position: "asc" } } },
  });
  if (!poll) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Enquete inválida" });
  }
  if (!pollIsOpen(poll.expiresAt)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Enquete encerrada" });
  }
  const option = poll.options.find((o) => o.id === optionId);
  if (!option) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Opção inválida" });
  }

  const existing = await prisma.redeTestePollVote.findUnique({
    where: { pollId_userId: { pollId: poll.id, userId } },
  });

  await prisma.$transaction(async (tx) => {
    if (existing) {
      if (existing.pollOptionId === optionId) return;
      await tx.juridiquesPollOption.update({
        where: { id: existing.pollOptionId },
        data: { votesCount: { decrement: 1 } },
      });
      await tx.juridiquesPollVote.update({
        where: { id: existing.id },
        data: { pollOptionId: optionId },
      });
      await tx.juridiquesPollOption.update({
        where: { id: optionId },
        data: { votesCount: { increment: 1 } },
      });
    } else {
      await tx.juridiquesPollVote.create({
        data: { pollId: poll.id, pollOptionId: optionId, userId },
      });
      await tx.juridiquesPollOption.update({
        where: { id: optionId },
        data: { votesCount: { increment: 1 } },
      });
    }
  });

  return getJqPollResults(prisma, userId, publicationId);
}

export async function removeJqPollVote(
  prisma: PrismaClient,
  userId: string,
  publicationId: string,
) {
  const poll = await prisma.redeTestePoll.findUnique({
    where: { publicationId },
  });
  if (!poll) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Enquete não encontrada" });
  }
  if (!pollIsOpen(poll.expiresAt)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "Enquete encerrada" });
  }

  const existing = await prisma.redeTestePollVote.findUnique({
    where: { pollId_userId: { pollId: poll.id, userId } },
  });
  if (!existing) return getJqPollResults(prisma, userId, publicationId);

  await prisma.$transaction([
    prisma.redeTestePollVote.delete({ where: { id: existing.id } }),
    prisma.redeTestePollOption.update({
      where: { id: existing.pollOptionId },
      data: { votesCount: { decrement: 1 } },
    }),
  ]);

  return getJqPollResults(prisma, userId, publicationId);
}

export async function getJqPollResults(
  prisma: PrismaClient,
  userId: string,
  publicationId: string,
) {
  const poll = await prisma.redeTestePoll.findUnique({
    where: { publicationId },
    include: {
      options: { orderBy: { position: "asc" } },
      votes: { where: { userId }, select: { pollOptionId: true } },
    },
  });
  if (!poll) {
    throw new TRPCError({ code: "NOT_FOUND", message: "Enquete não encontrada" });
  }

  const total = poll.options.reduce((s, o) => s + o.votesCount, 0);
  const myVote = poll.votes[0]?.pollOptionId ?? null;

  return {
    pollId: poll.id,
    expiresAt: poll.expiresAt,
    open: pollIsOpen(poll.expiresAt),
    myVoteOptionId: myVote,
    totalVotes: total,
    options: poll.options.map((o) => ({
      id: o.id,
      text: o.text,
      position: o.position,
      votesCount: o.votesCount,
      percent: total > 0 ? Math.round((o.votesCount / total) * 100) : 0,
    })),
  };
}
