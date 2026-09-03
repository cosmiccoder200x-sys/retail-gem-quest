import { Link } from "@tanstack/react-router";
import { ShoppingCart, Twitter, Facebook, Instagram, Mail, Phone, MapPin } from "lucide-react";
import { siteConfig } from "@/lib/site";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="font-display text-2xl font-extrabold tracking-tight">
              Gully<span className="text-brand">Gadget</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-white/60">
              Trending home and lifestyle gadgets under ₹999. Quality tested. Cash on Delivery available.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a href="#" className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-brand hover:text-white focus-visible:ring-2 focus-visible:ring-white" aria-label="Twitter">
                <Twitter className="size-4" />
              </a>
              <a href="#" className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-brand hover:text-white focus-visible:ring-2 focus-visible:ring-white" aria-label="Facebook">
                <Facebook className="size-4" />
              </a>
              <a href="#" className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-brand hover:text-white focus-visible:ring-2 focus-visible:ring-white" aria-label="Instagram">
                <Instagram className="size-4" />
              </a>
            </div>
            <p className="mt-3 text-xs text-white/40">Contact: {siteConfig.email} · {siteConfig.phone}</p>
          </div>

          {/* Shop */}
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest">Shop</h3>
            <nav className="mt-4 space-y-2.5" aria-label="Shop links">
              <Link to="/products" className="block text-sm text-white/60 hover:text-white focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-white">All Products</Link>
              <Link to="/products" search={{ category: "kitchen-tech" } as any} className="block text-sm text-white/60 hover:text-white">Kitchen Tech</Link>
              <Link to="/products" search={{ category: "mini-coolers" } as any} className="block text-sm text-white/60 hover:text-white">Mini Coolers</Link>
              <Link to="/products" search={{ category: "smart-lighting" } as any} className="block text-sm text-white/60 hover:text-white">Smart Lighting</Link>
              <Link to="/products" search={{ category: "personal-care" } as any} className="block text-sm text-white/60 hover:text-white">Personal Care</Link>
            </nav>
          </div>

          {/* Customer Support */}
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest">Customer Support</h3>
            <nav className="mt-4 space-y-2.5" aria-label="Support links">
              <Link to="/contact" className="flex items-center gap-2 text-sm text-white/60 hover:text-white"><Mail className="size-4" /> Contact</Link>
              <Link to="/faq" className="block text-sm text-white/60 hover:text-white">FAQ</Link>
              <Link to="/shipping" className="block text-sm text-white/60 hover:text-white">Shipping</Link>
              <Link to="/returns" className="block text-sm text-white/60 hover:text-white">Returns</Link>
              <Link to="/track" className="block text-sm text-white/60 hover:text-white">Track Order</Link>
            </nav>
          </div>

          {/* Legal + Account */}
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest">Legal</h3>
            <nav className="mt-4 space-y-2.5" aria-label="Legal links">
              <Link to="/privacy" className="block text-sm text-white/60 hover:text-white">Privacy Policy</Link>
              <Link to="/terms" className="block text-sm text-white/60 hover:text-white">Terms & Conditions</Link>
            </nav>
            <h3 className="mt-6 font-display text-sm font-bold uppercase tracking-widest">Account</h3>
            <nav className="mt-4 space-y-2.5" aria-label="Account links">
              <Link to="/auth" className="block text-sm text-white/60 hover:text-white">Login</Link>
              <Link to="/account" className="block text-sm text-white/60 hover:text-white">My Account</Link>
              <Link to="/account" hash="orders" className="block text-sm text-white/60 hover:text-white">My Orders</Link>
            </nav>
          </div>
        </div>

        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="grid gap-6 sm:flex sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-widest">Get exclusive drops</h3>
              <p className="mt-1 text-sm text-white/60">Subscribe for deals, new arrivals and more.</p>
            </div>
            <form className="flex w-full max-w-sm gap-2" onSubmit={(e) => e.preventDefault()}>
              <label htmlFor="footer-email" className="sr-only">Email</label>
              <input
                id="footer-email"
                type="email"
                placeholder="you@email.com"
                className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none ring-1 ring-white/10 focus:ring-2 focus:ring-brand"
              />
              <button type="submit" className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90 focus-visible:ring-2 focus-visible:ring-white">
                Join
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-xs text-white/40">© {year} {siteConfig.name}. All rights reserved.</p>
          <div className="flex flex-wrap items-center gap-4">
            <Link to="/about" className="text-xs text-white/40 hover:text-white">About</Link>
            <span className="flex items-center gap-1.5 text-xs text-white/40"><MapPin className="size-3" /> Cash on Delivery Available</span>
            <span className="flex items-center gap-1.5 text-xs text-white/40"><ShoppingCart className="size-3" /> Free Shipping on Orders ₹499+</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
