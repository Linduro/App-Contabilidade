type Props = { area: string };

export function PracticeAreaTag({ area }: Props) {
  return (
    <span className="inline-flex rounded-full bg-[var(--jq-primary)]/10 px-2 py-0.5 text-xs font-medium text-[var(--jq-primary)]">
      {area}
    </span>
  );
}
