import { addDoc, collection, serverTimestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { Reminder } from "@/lib/progression-data"
import { getUserProfile } from "@/lib/user-profile"

function todayIso() {
  return new Date().toISOString().slice(0, 10)
}

function tomorrowIso() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  return date.toISOString().slice(0, 10)
}

async function queueNotification(payload: {
  userId: string
  reminderId: string
  channel: "email" | "sms"
  to: string
  title: string
  date: string
}) {
  await addDoc(collection(db, "notificationQueue"), {
    ...payload,
    status: "pending",
    createdAt: serverTimestamp(),
  })
}

export async function processDueReminders(userId: string, reminders: Reminder[]) {
  const profile = await getUserProfile(userId)
  const email = profile?.email ?? ""
  const phone = profile?.phone ?? ""
  const allowEmail = profile?.notifyEmail !== false
  const allowSms = profile?.notifySms === true && !!phone

  const today = todayIso()
  const tomorrow = tomorrowIso()

  for (const reminder of reminders) {
    if (reminder.done || reminder.notifiedOn === today) continue
    if (reminder.date !== today && reminder.date !== tomorrow) continue

    const title = reminder.title.trim() || "Lembrete de prazo"
    const when = reminder.date === today ? "hoje" : "amanhã"
    const body = `${title} — ${when} (${reminder.date})`

    if (reminder.notifyEmail !== false && allowEmail && email) {
      await queueNotification({
        userId,
        reminderId: reminder.id,
        channel: "email",
        to: email,
        title: body,
        date: reminder.date,
      })
    }

    if (reminder.notifySms && allowSms) {
      await queueNotification({
        userId,
        reminderId: reminder.id,
        channel: "sms",
        to: phone,
        title: body,
        date: reminder.date,
      })
    }

    if (typeof window !== "undefined" && "Notification" in window && reminder.date === today) {
      if (Notification.permission === "granted") {
        new Notification("Lembrete de prazo", { body })
      } else if (Notification.permission !== "denied") {
        const permission = await Notification.requestPermission()
        if (permission === "granted") {
          new Notification("Lembrete de prazo", { body })
        }
      }
    }
  }

  return reminders.map((reminder) => {
    if (reminder.done || reminder.notifiedOn === today) return reminder
    if (reminder.date !== today && reminder.date !== tomorrow) return reminder
    return { ...reminder, notifiedOn: today }
  })
}
