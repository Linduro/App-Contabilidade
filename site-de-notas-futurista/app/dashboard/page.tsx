"use client"

import { useCallback, useEffect, useState } from "react"
import Link from "next/link"
import { signOut } from "firebase/auth"
import { useRouter } from "next/navigation"
import {
  BookOpen,
  LogOut,
  MessageSquare,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react"
import { auth } from "@/lib/firebase"
import { useAuth } from "@/components/auth-provider"
import { RequireAuth } from "@/components/require-auth"
import { Button } from "@/components/ui/button"
import {
  createMessage,
  createNote,
  deleteMessage,
  deleteNote,
  getMessages,
  getNotes,
  markMessageAsRead,
  type Message,
  type Note,
} from "@/lib/firestore-data"

function DashboardContent() {
  const { user } = useAuth()
  const router = useRouter()
  const [tab, setTab] = useState<"notes" | "messages">("notes")
  const [notes, setNotes] = useState<Note[]>([])
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)

  const loadData = useCallback(async () => {
    if (!user) return
    setLoading(true)
    try {
      const [notesData, messagesData] = await Promise.all([
        getNotes(user.uid),
        getMessages(user.uid),
      ])
      setNotes(notesData)
      setMessages(messagesData)
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleSignOut = async () => {
    await signOut(auth)
    router.push("/")
  }

  const handleCreateNote = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) return
    const form = new FormData(e.currentTarget)
    await createNote(user.uid, {
      title: String(form.get("title")),
      subject: String(form.get("subject") || ""),
      grade: String(form.get("grade") || ""),
      description: String(form.get("description") || ""),
    })
    e.currentTarget.reset()
    await loadData()
  }

  const handleCreateMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    if (!user) return
    const form = new FormData(e.currentTarget)
    await createMessage(user.uid, {
      title: String(form.get("title")),
      content: String(form.get("content")),
      priority: String(form.get("priority") || "normal"),
    })
    e.currentTarget.reset()
    await loadData()
  }

  return (
    <main className="min-h-screen grid-pattern relative overflow-hidden">
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-[600px] h-[600px] bg-accent/5 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold gradient-text">NexusPortal</span>
          </Link>

          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground hidden sm:block">
              {user?.displayName || user?.email}
            </span>
            <Button variant="ghost" onClick={handleSignOut} className="text-foreground/80">
              <LogOut className="w-4 h-4 mr-2" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      <div className="relative z-10 max-w-7xl mx-auto px-6 py-10">
        <div className="flex gap-3 mb-8">
          <Button
            variant={tab === "notes" ? "default" : "outline"}
            onClick={() => setTab("notes")}
            className={tab === "notes" ? "bg-primary" : ""}
          >
            <BookOpen className="w-4 h-4 mr-2" />
            Notas
          </Button>
          <Button
            variant={tab === "messages" ? "default" : "outline"}
            onClick={() => setTab("messages")}
            className={tab === "messages" ? "bg-primary" : ""}
          >
            <MessageSquare className="w-4 h-4 mr-2" />
            Recados
          </Button>
        </div>

        {loading ? (
          <p className="text-muted-foreground">Carregando...</p>
        ) : tab === "notes" ? (
          <div className="grid lg:grid-cols-2 gap-8">
            <form onSubmit={handleCreateNote} className="glass-card rounded-2xl p-6 neon-border space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-primary" />
                Nova nota
              </h2>
              <input name="title" placeholder="Título" required className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg" />
              <input name="subject" placeholder="Disciplina" className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg" />
              <input name="grade" placeholder="Nota" className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg" />
              <textarea name="description" placeholder="Descrição" rows={3} className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg" />
              <Button type="submit" className="w-full bg-primary">Salvar nota</Button>
            </form>

            <div className="space-y-4">
              {notes.length === 0 ? (
                <p className="text-muted-foreground">Nenhuma nota cadastrada.</p>
              ) : (
                notes.map((note) => (
                  <div key={note.id} className="glass-card rounded-xl p-5 neon-border flex justify-between gap-4">
                    <div>
                      <h3 className="font-semibold">{note.title}</h3>
                      {note.subject && <p className="text-sm text-muted-foreground">{note.subject}</p>}
                      {note.grade && <p className="text-accent font-mono mt-1">Nota: {note.grade}</p>}
                      {note.description && <p className="text-sm text-muted-foreground mt-2">{note.description}</p>}
                    </div>
                    <button
                      onClick={async () => {
                        await deleteNote(note.id)
                        await loadData()
                      }}
                      className="text-destructive hover:text-destructive/80 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        ) : (
          <div className="grid lg:grid-cols-2 gap-8">
            <form onSubmit={handleCreateMessage} className="glass-card-gold rounded-2xl p-6 neon-border-gold space-y-4">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <Plus className="w-5 h-5 text-accent" />
                Novo recado
              </h2>
              <input name="title" placeholder="Título" required className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg" />
              <textarea name="content" placeholder="Conteúdo" required rows={4} className="w-full px-4 py-3 bg-secondary/50 border border-border rounded-lg" />
              <select name="priority" className="w-full h-11 px-4 bg-secondary/50 border border-border rounded-lg">
                <option value="normal">Normal</option>
                <option value="alta">Alta</option>
                <option value="urgente">Urgente</option>
              </select>
              <Button type="submit" className="w-full bg-accent text-accent-foreground">Salvar recado</Button>
            </form>

            <div className="space-y-4">
              {messages.length === 0 ? (
                <p className="text-muted-foreground">Nenhum recado.</p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    className={`glass-card rounded-xl p-5 neon-border flex justify-between gap-4 ${!msg.isRead ? "border-accent/50" : ""}`}
                    onClick={async () => {
                      if (!msg.isRead) {
                        await markMessageAsRead(msg.id)
                        await loadData()
                      }
                    }}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{msg.title}</h3>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent/20 text-accent">{msg.priority}</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">{msg.content}</p>
                    </div>
                    <button
                      onClick={async (e) => {
                        e.stopPropagation()
                        await deleteMessage(msg.id)
                        await loadData()
                      }}
                      className="text-destructive hover:text-destructive/80 shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </main>
  )
}

export default function DashboardPage() {
  return (
    <RequireAuth>
      <DashboardContent />
    </RequireAuth>
  )
}
