"use client";

type Props = { title: string; description: string };

export function ProfilePlaceholderTab({ title, description }: Props) {
  return (
    <div className="px-6 py-16 text-center">
      <p className="text-lg font-bold text-[var(--jq-primary)]">{title}</p>
      <p className="mt-2 text-sm text-[var(--jq-muted)]">{description}</p>
    </div>
  );
}
