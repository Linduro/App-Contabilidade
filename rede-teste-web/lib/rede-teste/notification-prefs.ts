import type { RedeTesteNotificationType, PrismaClient } from "@prisma/client";

export type JqNotifChannel = "inApp" | "email" | "push";

export type JqNotifPrefGroup = "likes" | "comments" | "mentions" | "followers" | "reposts";

const TYPE_TO_GROUP: Partial<Record<RedeTesteNotificationType, JqNotifPrefGroup>> = {
  LIKE: "likes",
  REPLY: "comments",
  MENTION: "mentions",
  FOLLOW: "followers",
  FOLLOW_REQUEST: "followers",
  REPOST: "reposts",
};

export function notifTypeToGroup(type: RedeTesteNotificationType): JqNotifPrefGroup {
  return TYPE_TO_GROUP[type] ?? "mentions";
}

export type JqNotifPrefs = {
  likesInApp: boolean;
  likesEmail: boolean;
  likesPush: boolean;
  commentsInApp: boolean;
  commentsEmail: boolean;
  commentsPush: boolean;
  mentionsInApp: boolean;
  mentionsEmail: boolean;
  mentionsPush: boolean;
  followersInApp: boolean;
  followersEmail: boolean;
  followersPush: boolean;
  repostsInApp: boolean;
  repostsEmail: boolean;
  repostsPush: boolean;
  weeklyDigestEmail: boolean;
  marketingOptOut: boolean;
};

export const DEFAULT_JQ_NOTIF_PREFS: JqNotifPrefs = {
  likesInApp: true,
  likesEmail: false,
  likesPush: false,
  commentsInApp: true,
  commentsEmail: true,
  commentsPush: true,
  mentionsInApp: true,
  mentionsEmail: true,
  mentionsPush: true,
  followersInApp: true,
  followersEmail: true,
  followersPush: true,
  repostsInApp: true,
  repostsEmail: false,
  repostsPush: false,
  weeklyDigestEmail: false,
  marketingOptOut: false,
};

export async function getJqNotificationPrefs(
  prisma: PrismaClient,
  userId: string,
): Promise<JqNotifPrefs> {
  const row = await prisma.redeTesteNotificationPreference.findUnique({
    where: { userId },
  });
  return row ? { ...DEFAULT_JQ_NOTIF_PREFS, ...row } : { ...DEFAULT_JQ_NOTIF_PREFS };
}

export function isChannelEnabled(
  prefs: JqNotifPrefs,
  type: RedeTesteNotificationType,
  channel: JqNotifChannel,
): boolean {
  const group = notifTypeToGroup(type);
  const key = `${group}${channel === "inApp" ? "InApp" : channel === "email" ? "Email" : "Push"}` as keyof JqNotifPrefs;
  return Boolean(prefs[key]);
}
