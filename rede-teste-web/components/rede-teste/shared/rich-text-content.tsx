import Link from "next/link";
import { jqProfilePath } from "@/lib/rede-teste/profile-path";

type Props = { text: string; className?: string };

/** Links para #hashtag e @menção no texto da publicação. */
export function RichTextContent({ text, className }: Props) {
  const parts = text.split(/(#\w{2,50}|@\w{2,30})/g);

  return (
    <span className={className}>
      {parts.map((part, i) => {
        if (part.startsWith("#")) {
          const tag = part.slice(1).toLowerCase();
          return (
            <Link
              key={`${i}-${tag}`}
              href={`/rede-teste/explorar?q=${encodeURIComponent(`#${tag}`)}&type=hashtags`}
              className="text-[var(--jq-reply)] hover:underline"
            >
              {part}
            </Link>
          );
        }
        if (part.startsWith("@")) {
          const handle = part.slice(1).toLowerCase();
          return (
            <Link
              key={`${i}-${handle}`}
              href={jqProfilePath(handle)}
              className="text-[var(--jq-reply)] hover:underline"
            >
              {part}
            </Link>
          );
        }
        return <span key={i}>{part}</span>;
      })}
    </span>
  );
}
