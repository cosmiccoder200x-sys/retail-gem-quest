import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

export function ProductImageGallery({
  images,
  productName,
}: {
  images: Array<{ url: string; alt?: string }>;
  productName: string;
}) {
  const [active, setActive] = useState(0);

  if (!images || images.length === 0) {
    return (
      <div className="aspect-square rounded-3xl bg-secondary shimmer" />
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative aspect-square overflow-hidden rounded-3xl">
        <img
          src={images[active].url}
          alt={images[active].alt ?? productName}
          className="h-full w-full object-contain"
          loading="eager"
        />
        {images.length > 1 && (
          <>
            <button
              onClick={() => setActive((prev) => (prev > 0 ? prev - 1 : images.length - 1))}
              className="absolute left-3 top-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
              aria-label="Previous image"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              onClick={() => setActive((prev) => (prev < images.length - 1 ? prev + 1 : 0))}
              className="absolute right-3 top-1/2 -translate-y-1/2 grid size-8 place-items-center rounded-full bg-background/80 shadow-sm backdrop-blur-sm hover:bg-background"
              aria-label="Next image"
            >
              <ChevronRight className="size-4" />
            </button>
          </>
        )}
      </div>
      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Product images">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActive(i)}
              role="tab"
              aria-selected={i === active}
              aria-label={`View image ${i + 1}`}
              className={`shrink-0 rounded-xl bg-background p-1 ring-1 ring-border transition-colors ${
                i === active ? "ring-brand" : "hover:ring-brand/50"
              }`}
            >
              <img
                src={img.url}
                alt={img.alt ?? `${productName} - image ${i + 1}`}
                className="h-16 w-16 rounded-lg object-contain"
                loading="lazy"
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}