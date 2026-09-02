import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, Search, User as UserIcon, X } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { useCart } from "@/lib/cart";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { AnnouncementBar } from "./AnnouncementBar";
import { MobileMenu } from "./MobileMenu";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function Header() {
  const { user } = useAuth();
  const { data: cart } = useCart(!!user);
  const cartCount = (cart ?? []).reduce((n, c) => n + c.quantity, 0);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: categories } = useQuery({
    queryKey: ["header-categories"],
    queryFn: async () => {
      const { data } = await supabase
        .from("categories")
        .select("name, slug")
        .eq("is_active", true)
        .order("sort_order")
        .limit(6);
      return data ?? [];
    },
  });

  const { data: suggestions } = useQuery({
    queryKey: ["header-search", q],
    enabled: q.trim().length > 1,
    queryFn: async () => {
      const term = q.trim();
      const { data } = await supabase
        .from("products")
        .select("name, slug, price, image_url")
        .eq("is_active", true)
        .or(`name.ilike.%${term}%,description.ilike.%${term}%,sku.ilike.%${term}%`)
        .limit(5);
      return data ?? [];
    },
  });

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (inputRef.current && !inputRef.current.contains(e.target as Node)) {
        // Check if click is inside suggestion dropdown
        const dropdown = document.getElementById("header-search-dropdown");
        if (dropdown && dropdown.contains(e.target as Node)) return;
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const term = q.trim();
    if (term) {
      setOpen(false);
      navigate({ to: "/products", search: { q: term } });
    }
  };

  const clearSearch = () => {
    setQ("");
    setOpen(false);
    inputRef.current?.focus();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <AnnouncementBar />
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:h-16">
        <Link to="/" className="font-display text-xl font-bold tracking-tight text-foreground sm:text-2xl shrink-0">
          Gully<span className="text-brand">Gadget</span>
        </Link>

        <nav className="ml-4 hidden gap-5 text-sm font-medium text-muted-foreground lg:flex" aria-label="Main navigation">
          {(categories ?? []).slice(0, 4).map((cat) => (
            <Link
              key={cat.slug}
              to="/products"
              search={{ category: cat.slug }}
              className="hover:text-brand transition-colors"
            >
              {cat.name}
            </Link>
          ))}
          <Link to="/products" className="font-semibold text-brand">₹999 Store</Link>
        </nav>

        <form onSubmit={submit} className="relative ml-auto hidden flex-1 max-w-xs md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            ref={inputRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setOpen(true);
            }}
            onFocus={() => q.trim().length > 1 && setOpen(true)}
            placeholder="Search gadgets…"
            className="rounded-full pl-9 pr-8"
          />
          {q && (
            <button
              type="button"
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="size-4" />
            </button>
          )}
          {open && suggestions && suggestions.length > 0 && q.trim().length > 1 && (
            <div
              id="header-search-dropdown"
              className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl"
            >
              {suggestions.map((s) => (
                <Link
                  key={s.slug}
                  to="/products/$slug"
                  params={{ slug: s.slug }}
                  onClick={() => {
                    setQ("");
                    setOpen(false);
                  }}
                  className="flex items-center gap-3 px-4 py-2.5 text-sm hover:bg-brand-soft"
                >
                  {s.image_url ? (
                    <img src={s.image_url} alt="" className="size-8 rounded-lg object-cover shrink-0" loading="lazy" />
                  ) : (
                    <div className="size-8 rounded-lg bg-secondary shrink-0" />
                  )}
                  <span className="flex-1 truncate">{s.name}</span>
                </Link>
              ))}
              <button
                type="button"
                onClick={submit}
                className="flex w-full items-center justify-center gap-2 border-t border-border px-4 py-2.5 text-sm font-medium text-brand hover:bg-brand-soft"
              >
                <Search className="size-3" /> See all results for "{q.trim()}"
              </button>
            </div>
          )}
          {open && suggestions?.length === 0 && q.trim().length > 1 && (
            <div
              id="header-search-dropdown"
              className="absolute left-0 right-0 top-full mt-2 rounded-2xl border border-border bg-popover p-4 text-center shadow-xl"
            >
              <p className="text-sm text-muted-foreground">No products found for "{q.trim()}"</p>
            </div>
          )}
        </form>

        <div className="ml-auto flex items-center gap-2 md:ml-0">
          <ThemeToggle />
          <Link
            to="/cart"
            aria-label="Cart"
            className="relative grid size-10 place-items-center rounded-full bg-brand text-brand-foreground"
          >
            <ShoppingBag className="size-4" />
            {cartCount > 0 && (
              <span className="absolute -right-1 -top-1 grid size-5 place-items-center rounded-full bg-offer text-[10px] font-bold text-white">
                {cartCount}
              </span>
            )}
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                aria-label="Account"
                className="grid size-10 place-items-center rounded-full bg-brand/5 text-brand hover:bg-brand/10"
              >
                <UserIcon className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              {user ? (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/account">My Account</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account" hash="orders">My Orders</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/account" hash="wishlist">
                      <span className="mr-2">❤️</span> Wishlist
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild>
                    <Link to="/admin">Admin</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={async () => {
                      await supabase.auth.signOut();
                      navigate({ to: "/" });
                    }}
                  >
                    Sign out
                  </DropdownMenuItem>
                </>
              ) : (
                <>
                  <DropdownMenuItem asChild>
                    <Link to="/auth">Sign in</Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link to="/auth" search={{ mode: "signup" }}>
                      Create account
                    </Link>
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>

          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
