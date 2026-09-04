import { cn } from "@/lib/utils";

// Decorative product placeholder — colored gradient + initials.
// Used when products don't have a real image_url yet.
const palettes = [
  "from-sky-100 via-cyan-50 to-white",
  "from-amber-100 via-orange-50 to-white",
  "from-emerald-100 via-teal-50 to-white",
  "from-rose-100 via-pink-50 to-white",
  "from-violet-100 via-indigo-50 to-white",
  "from-slate-100 via-zinc-50 to-white",
];

export function ProductTile({
  name,
  imageUrl,
  className,
}: {
  name: string;
  imageUrl?: string | null;
  className?: string;
}) {
  if (imageUrl) {
    return (
      <img
        src={imageUrl}
        alt={name}
        loading="lazy"
        className={cn("h-full w-full object-cover", className)}
      />
    );
  }
  const idx = name.charCodeAt(0) % palettes.length;
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");
  return (
    <div
      className={cn(
        "flex h-full w-full items-center justify-center bg-gradient-to-br",
        palettes[idx],
        className,
      )}
    >
      <span className="font-display text-5xl font-bold text-brand/30">{initials}</span>
    </div>
  );
}
