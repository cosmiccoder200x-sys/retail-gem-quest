import { Link, useNavigate } from "@tanstack/react-router";
import { ShoppingBag, Search, User as UserIcon, Heart, Menu } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-store";
import { useCart } from "@/lib/cart";
import { Input } from "@/components/ui/input";
import { ThemeToggle } from "@/components/ThemeToggle";
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
  const navigate = useNavigate();

  const { data: suggestions } = useQuery({
    queryKey: ["search", q],
    enabled: q.length > 1,
    queryFn: async () => {
      const { data } = await supabase
        .from("products")
        .select("name, slug")
        .ilike("name", `%${q}%`)
        .limit(5);
      return data ?? [];
    },
  });

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) navigate({ to: "/products", search: { q: q.trim() } });
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6">
        <Link to="/" className="font-display text-xl font-extrabold uppercase tracking-tighter text-brand sm:text-2xl">
          GullyGadget
        </Link>

        <nav className="ml-6 hidden gap-6 text-sm font-medium uppercase tracking-wide text-brand/80 lg:flex">
          <Link to="/products" search={{ category: "mini-coolers" }} className="hover:text-accent-cyan">
            Mini Coolers
          </Link>
          <Link to="/products" search={{ category: "kitchen-tech" }} className="hover:text-accent-cyan">
            Kitchen Tech
          </Link>
          <Link to="/products" search={{ category: "smart-lighting" }} className="hover:text-accent-cyan">
            Smart Lighting
          </Link>
          <Link to="/products" className="text-offer hover:text-offer/80">
            ₹999 Store
          </Link>
        </nav>

        <form onSubmit={submit} className="relative ml-auto hidden flex-1 max-w-xs md:block">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search gadgets…"
            className="rounded-full pl-9"
          />
          {suggestions && suggestions.length > 0 && q.length > 1 && (
            <div className="absolute left-0 right-0 top-full mt-2 overflow-hidden rounded-2xl border border-border bg-popover shadow-xl">
              {suggestions.map((s) => (
                <Link
                  key={s.slug}
                  to="/products/$slug"
                  params={{ slug: s.slug }}
                  onClick={() => setQ("")}
                  className="block px-4 py-2 text-sm hover:bg-brand-soft"
                >
                  {s.name}
                </Link>
              ))}
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
                      <Heart className="mr-2 size-4" /> Wishlist
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

          <button aria-label="Menu" className="grid size-10 place-items-center rounded-full bg-brand/5 lg:hidden">
            <Menu className="size-4" />
          </button>
        </div>
      </div>
    </header>
  );
}