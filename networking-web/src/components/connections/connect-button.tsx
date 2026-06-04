"use client"

import { Button } from "@/components/ui/button"
import { useConnect } from "@/hooks/use-connect"

export function ConnectButton({
  targetProfileId,
  size = "sm",
  className,
}: {
  targetProfileId: string
  size?: "sm" | "default" | "lg"
  className?: string
}) {
  const connect = useConnect()

  return (
    <Button
      size={size}
      className={className}
      disabled={connect.isPending}
      onClick={() => connect.mutate(targetProfileId)}
    >
      {connect.isPending ? "Enviando..." : "Conectar"}
    </Button>
  )
}
