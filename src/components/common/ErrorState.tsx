import { RefreshCw } from "lucide-react";
import { Link } from "@tanstack/react-router";

export function ErrorState({
  title,
  message,
  onRetry,
  action,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  action?: { label: string; to: string };
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-3xl bg-card p-10 text-center ring-1 ring-border">
      <div className="grid size-16 place-items-center rounded-full bg-destructive/10 text-destructive">
        <RefreshCw className="size-8" aria-hidden="true" />
      </div>
      <h3 className="mt-4 font-display text-xl font-semibold">{title ?? "Something went wrong"}</h3>
      <p className="mt-2 max-w-sm text-sm text-muted-foreground">
        {message ?? "We encountered an issue loading this content. Please try again."}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        {onRetry && (
          <button
            onClick={onRetry}
            className="inline-flex items-center justify-center rounded-full bg-brand px-6 py-2.5 text-sm font-semibold text-brand-foreground transition-colors hover:bg-brand/90"
          >
            <RefreshCw className="mr-2 size-4" />
            Try again
          </button>
        )}
        {action && (
          <Link
            to={action.to}
            className="inline-flex items-center justify-center rounded-full border border-input bg-background px-6 py-2.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
          >
            {action.label}
          </Link>
        )}
      </div>
    </div>
  );
}
