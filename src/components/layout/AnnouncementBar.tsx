export function AnnouncementBar() {
  return (
    <div className="bg-brand-soft/50 border-b border-border">
      <div className="mx-auto max-w-7xl px-4 py-2 sm:px-6">
        <div className="flex flex-wrap items-center justify-center gap-2 text-center text-xs font-medium text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <span className="relative flex h-2 w-2">
              <span className="relative flex h-full w-full animate-ping rounded-full bg-success opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-success" />
            </span>
            Free Shipping on Orders ₹499+
          </span>
          <span className="text-border" aria-hidden="true">
            |
          </span>
          <span>Cash on Delivery Available Across India</span>
          <span className="text-border" aria-hidden="true">
            |
          </span>
          <span>7-Day Easy Replacement</span>
        </div>
      </div>
    </div>
  );
}
