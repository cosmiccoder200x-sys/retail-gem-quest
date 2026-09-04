export function SectionHeader({
  title,
  subtitle,
  className,
}: {
  title: string;
  subtitle?: string;
  className?: string;
}) {
  return (
    <div className={`mb-8 ${className ?? ""}`}>
      <h2 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">{title}</h2>
      {subtitle && <p className="mt-2 text-base text-muted-foreground sm:text-lg">{subtitle}</p>}
    </div>
  );
}
