import { useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { X, Search, ShoppingBag, Menu } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerTrigger, DrawerClose } from "@/components/ui/drawer";
import { useCart } from "@/lib/cart";
import { useAuth } from "@/lib/auth-store";

export function MobileMenu() {
  const [q, setQ] = useState("");
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: cart } = useCart(user?.id);
  const cartCount = (cart ?? []).reduce((n, c) => n + c.quantity, 0);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (q.trim()) {
      navigate({ to: "/products", search: { q: q.trim() } });
    }
  };

  return (
    <Drawer>
      <DrawerTrigger asChild>
        <Button variant="ghost" size="icon" className="rounded-full" aria-label="Open menu">
          <Menu className="size-5" />
        </Button>
      </DrawerTrigger>
      <DrawerContent className="rounded-t-3xl">
        <div className="mx-auto max-w-md">
          <div className="flex items-center justify-between px-4 py-3">
            <span className="font-display text-lg font-bold">Menu</span>
            <DrawerClose asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <X className="size-5" />
              </Button>
            </DrawerClose>
          </div>

          <form onSubmit={submit} className="px-4 pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search gadgets…"
                className="rounded-full pl-9"
              />
            </div>
          </form>

          <nav className="flex flex-col gap-1 px-4 pb-4">
            <MobileLink to="/products" search={{ category: "kitchen" }}>
              Kitchen
            </MobileLink>
            <MobileLink to="/products" search={{ category: "home-comfort" }}>
              Home Comfort
            </MobileLink>
            <MobileLink to="/products" search={{ category: "personal-care" }}>
              Personal Care
            </MobileLink>
            <MobileLink to="/products" search={{ category: "cleaning" }}>
              Cleaning
            </MobileLink>
            <MobileLink to="/products">₹999 Store</MobileLink>
          </nav>

          <div className="flex items-center gap-3 px-4 pb-4 pt-2 border-t border-border">
            <button
              className="grid size-10 place-items-center rounded-full bg-brand/5"
              aria-label="Cart"
            >
              <ShoppingBag className="size-5" />
            </button>
            {user ? (
              <MobileLink to="/account">Account</MobileLink>
            ) : (
              <MobileLink to="/auth">Sign in</MobileLink>
            )}
          </div>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

function MobileLink({
  to,
  search,
  children,
}: {
  to: string;
  search?: Record<string, string>;
  children: React.ReactNode;
}) {
  return (
    <DrawerClose asChild>
      <Link
        to={to}
        search={search}
        className="block rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground hover:bg-brand-soft hover:text-brand"
      >
        {children}
      </Link>
    </DrawerClose>
  );
}
