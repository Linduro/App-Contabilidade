import Image from "next/image";
import { cn } from "@/lib/utils";

type Props = {
  src: string | null | undefined;
  name: string;
  size?: "sm" | "md" | "lg" | "xl";
  square?: boolean;
};

const sizes = { sm: 32, md: 40, lg: 48, xl: 80 };

export function JqAvatar({ src, name, size = "md", square }: Props) {
  const px = sizes[size];
  const initials = name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div
      className={cn(
        "relative shrink-0 overflow-hidden bg-[var(--jq-surface)]",
        square ? "rounded-lg" : "rounded-full",
      )}
      style={{ width: px, height: px }}
    >
      {src ? (
        <Image src={src} alt="" width={px} height={px} className="object-cover" unoptimized />
      ) : (
        <span
          className="flex h-full w-full items-center justify-center text-xs font-semibold text-[var(--jq-primary)]"
          aria-hidden
        >
          {initials}
        </span>
      )}
    </div>
  );
}
