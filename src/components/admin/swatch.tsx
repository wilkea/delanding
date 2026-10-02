import { cn } from "@/lib/utils";

export function Swatch({ colors, className }: { colors: readonly string[] | null | undefined; className?: string }) {
  if (!colors || colors.length === 0) {
    return null;
  }

  const background =
    colors.length === 1 ? colors[0] : `linear-gradient(135deg, ${colors[0]} 0 50%, ${colors[1]} 50% 100%)`;

  return (
    <span
      aria-hidden
      data-slot="swatch"
      className={cn("inline-block size-4 shrink-0 rounded-full ring-1 ring-foreground/15", className)}
      style={{ background }}
    />
  );
}
