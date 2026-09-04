import { type ReactNode } from "react";

export function Container({
  children,
  size = "lg",
  className,
}: {
  children: ReactNode;
  size?: "sm" | "md" | "lg" | "xl" | "full";
  className?: string;
}) {
  const max = {
    sm: "max-w-4xl",
    md: "max-w-5xl",
    lg: "max-w-7xl",
    xl: "max-w-[120rem]",
    full: "max-w-[100vw]",
  }[size];
  return <div className={`mx-auto w-full px-4 sm:px-6 ${max} ${className ?? ""}`}>{children}</div>;
}
