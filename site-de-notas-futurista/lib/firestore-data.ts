import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from "firebase/firestore"
import { db } from "@/lib/firebase"

export interface Note {
  id: string
  userId: string
  title: string
  subject?: string
  grade?: string
  maxGrade?: string
  date?: string
  description?: string
  createdAt?: Date
}

export interface Message {
  id: string
  userId: string
  title: string
  content: string
  isRead: boolean
  priority: string
  createdAt?: Date
}

export async function getNotes(userId: string): Promise<Note[]> {
  const q = query(collection(db, "notes"), where("userId", "==", userId), orderBy("createdAt", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      userId: data.userId,
      title: data.title,
      subject: data.subject,
      grade: data.grade,
      maxGrade: data.maxGrade,
      date: data.date,
      description: data.description,
      createdAt: data.createdAt?.toDate?.(),
    }
  })
}

export async function createNote(
  userId: string,
  data: {
    title: string
    subject?: string
    grade?: string
    maxGrade?: string
    date?: string
    description?: string
  }
) {
  await addDoc(collection(db, "notes"), {
    userId,
    title: data.title,
    subject: data.subject || null,
    grade: data.grade || null,
    maxGrade: data.maxGrade || "10.00",
    date: data.date || null,
    description: data.description || null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function deleteNote(noteId: string) {
  await deleteDoc(doc(db, "notes", noteId))
}

export async function getMessages(userId: string): Promise<Message[]> {
  const q = query(collection(db, "messages"), where("userId", "==", userId), orderBy("createdAt", "desc"))
  const snapshot = await getDocs(q)
  return snapshot.docs.map((d) => {
    const data = d.data()
    return {
      id: d.id,
      userId: data.userId,
      title: data.title,
      content: data.content,
      isRead: data.isRead ?? false,
      priority: data.priority ?? "normal",
      createdAt: data.createdAt?.toDate?.(),
    }
  })
}

export async function createMessage(
  userId: string,
  data: { title: string; content: string; priority?: string }
) {
  await addDoc(collection(db, "messages"), {
    userId,
    title: data.title,
    content: data.content,
    priority: data.priority || "normal",
    isRead: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  })
}

export async function markMessageAsRead(messageId: string) {
  await updateDoc(doc(db, "messages", messageId), {
    isRead: true,
    updatedAt: serverTimestamp(),
  })
}

export async function deleteMessage(messageId: string) {
  await deleteDoc(doc(db, "messages", messageId))
}
