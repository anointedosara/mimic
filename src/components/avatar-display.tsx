import { cn } from "@/lib/utils";
import { getAvatar } from "@/lib/avatars";

const SIZES = {
  xs: "h-8 w-8 text-base",
  sm: "h-10 w-10 text-xl",
  md: "h-14 w-14 text-2xl",
  lg: "h-20 w-20 text-4xl",
  xl: "h-28 w-28 text-6xl",
};

export function AvatarDisplay({
  avatar,
  size = "md",
  className,
  ring = true,
  dimmed = false,
}: {
  avatar: string;
  size?: keyof typeof SIZES;
  className?: string;
  ring?: boolean;
  dimmed?: boolean;
}) {
  const a = getAvatar(avatar);
  return (
    <div
      className={cn(
        "relative grid place-items-center rounded-2xl bg-gradient-to-br shadow-lg transition-all",
        a.gradient,
        SIZES[size],
        ring && "ring-2 ring-white/20",
        dimmed && "opacity-40 grayscale",
        className,
      )}
      role="img"
      aria-label={a.label}
    >
      <span className="drop-shadow">{a.emoji}</span>
    </div>
  );
}
