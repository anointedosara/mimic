import { cn } from "@/lib/utils";

export function Logo({
  className,
  size = "md",
  showTagline = false,
}: {
  className?: string;
  size?: "sm" | "md" | "lg";
  showTagline?: boolean;
}) {
  const sizes = {
    sm: "text-2xl",
    md: "text-3xl sm:text-4xl",
    lg: "text-5xl sm:text-7xl",
  };
  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="flex items-center gap-2">
        <span aria-hidden className="animate-float text-[1.1em] leading-none">
          🎭
        </span>
        <span
          className={cn(
            "font-display font-black tracking-tight text-gradient drop-shadow-[0_2px_20px_rgba(124,58,237,0.5)]",
            sizes[size],
          )}
        >
          MIMIC
        </span>
      </div>
      {showTagline && (
        <p className="mt-2 text-center text-sm text-muted-foreground sm:text-base">
          Can you blend in, or will you be exposed? 😈
        </p>
      )}
    </div>
  );
}
