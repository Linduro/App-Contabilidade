import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

export type AdOrigin = "own" | "third_party"
export type AdFormat = "banner" | "embed"
export type AdPlacement = "dashboard" | "home" | "footer"

export interface PlatformAd {
  id: string
  title: string
  origin: AdOrigin
  format: AdFormat
  placement: AdPlacement
  active: boolean
  sortOrder: number
  sponsorLabel: string
  headline: string
  description: string
  imageUrl: string
  linkUrl: string
  ctaText: string
  embedHtml: string
  updatedAt?: Date
}

export type PlatformAdInput = Omit<PlatformAd, "id" | "updatedAt">

export const AD_PLACEMENT_LABELS: Record<AdPlacement, string> = {
  dashboard: "Painel (dashboard)",
  home: "Página inicial",
  footer: "Rodapé (todas as páginas)",
}

export const AD_ORIGIN_LABELS: Record<AdOrigin, string> = {
  own: "Próprio",
  third_party: "Terceiro",
}

export function defaultPlatformAdInput(): PlatformAdInput {
  return {
    title: "Novo anúncio",
    origin: "own",
    format: "banner",
    placement: "dashboard",
    active: false,
    sortOrder: 0,
    sponsorLabel: "Patrocinado",
    headline: "",
    description: "",
    imageUrl: "",
    linkUrl: "",
    ctaText: "Saiba mais",
    embedHtml: "",
  }
}

function mapDoc(id: string, data: Record<string, unknown>): PlatformAd {
  const updatedAt = data.updatedAt as { toDate?: () => Date } | undefined
  return {
    id,
    title: String(data.title ?? ""),
    origin: (data.origin === "third_party" ? "third_party" : "own") as AdOrigin,
    format: (data.format === "embed" ? "embed" : "banner") as AdFormat,
    placement: (["dashboard", "home", "footer"].includes(String(data.placement))
      ? data.placement
      : "dashboard") as AdPlacement,
    active: Boolean(data.active),
    sortOrder: Number(data.sortOrder ?? 0),
    sponsorLabel: String(data.sponsorLabel ?? "Patrocinado"),
    headline: String(data.headline ?? ""),
    description: String(data.description ?? ""),
    imageUrl: String(data.imageUrl ?? ""),
    linkUrl: String(data.linkUrl ?? ""),
    ctaText: String(data.ctaText ?? "Saiba mais"),
    embedHtml: String(data.embedHtml ?? ""),
    updatedAt: updatedAt?.toDate?.(),
  }
}

export async function fetchAllPlatformAdsForAdmin(): Promise<PlatformAd[]> {
  const snapshot = await getDocs(
    query(collection(db, "platformAds"), orderBy("sortOrder", "asc"))
  )
  return snapshot.docs.map((item) => mapDoc(item.id, item.data()))
}

export async function createPlatformAd(input: PlatformAdInput) {
  await addDoc(collection(db, "platformAds"), {
    ...input,
    updatedAt: serverTimestamp(),
  })
}

export async function updatePlatformAd(id: string, input: Partial<PlatformAdInput>) {
  await updateDoc(doc(db, "platformAds", id), {
    ...input,
    updatedAt: serverTimestamp(),
  })
}

export async function deletePlatformAd(id: string) {
  await deleteDoc(doc(db, "platformAds", id))
}

export function subscribeActivePlatformAds(
  placement: AdPlacement,
  onData: (ads: PlatformAd[]) => void,
  onError?: (error: Error) => void
) {
  const q = query(
    collection(db, "platformAds"),
    where("active", "==", true),
    where("placement", "==", placement),
    orderBy("sortOrder", "asc")
  )

  return onSnapshot(
    q,
    (snapshot) => {
      onData(snapshot.docs.map((item) => mapDoc(item.id, item.data())))
    },
    (err) => onError?.(err)
  )
}
