import { Link } from "@tanstack/react-router";
import { type ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  description,
  action,
  className,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: {
    label: string;
    to: string;
    params?: Record<string, string>;
    search?: Record<string, string>;
  };
  className?: string;
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-3xl bg-card p-10 text-center ring-1 ring-border ${className ?? ""}`}
    >
      {icon && <div className="mb-4 text-muted-foreground">{icon}</div>}
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">{description}</p>
      {action && (
        <div className="mt-6">
          <Link
            to={action.to}
            params={action.params}
            search={action.search}
            className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
          >
            {action.label}
          </Link>
        </div>
      )}
    </div>
  );
}
