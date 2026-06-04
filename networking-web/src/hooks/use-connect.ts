"use client"

import { useMutation, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import { api, ApiError } from "@/lib/api"
import { useAuthStore } from "@/store/auth-store"

export function useConnect() {
  const token = useAuthStore((s) => s.token)
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (targetProfileId: string) => {
      if (!token) throw new ApiError("Não autenticado", 401)
      return api.createConnection(token, targetProfileId)
    },
    onSuccess: () => {
      toast.success("Solicitação de conexão enviada!")
      void queryClient.invalidateQueries({ queryKey: ["pending-connections"] })
    },
    onError: (err) => {
      const message =
        err instanceof ApiError
          ? err.status === 409
            ? "Você já solicitou conexão com este perfil."
            : err.message
          : "Não foi possível enviar a solicitação."
      toast.error(message)
    },
  })
}
