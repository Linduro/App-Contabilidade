import { cn } from "@/lib/utils"
import type { Profile } from "@/types/api"

export function ProfileAvatar({
  profile,
  size = "md",
  className,
}: {
  profile: Pick<Profile, "nome" | "avatarUrl">
  size?: "sm" | "md" | "lg"
  className?: string
}) {
  const sizeClass =
    size === "sm" ? "w-10 h-10 text-xs" : size === "lg" ? "w-14 h-14 text-lg" : "w-12 h-12 text-sm"

  if (profile.avatarUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={profile.avatarUrl}
        alt={profile.nome}
        className={cn("rounded-full object-cover shrink-0", sizeClass, className)}
      />
    )
  }

  return (
    <div
      className={cn(
        "rounded-full bg-indigo-100 text-indigo-700 font-bold flex items-center justify-center shrink-0",
        sizeClass,
        className
      )}
    >
      {profile.nome.charAt(0).toUpperCase()}
    </div>
  )
}
