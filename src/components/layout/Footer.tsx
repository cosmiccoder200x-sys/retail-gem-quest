import { Link } from "@tanstack/react-router";
import { ShoppingCart, Twitter, Facebook, Instagram, Mail, Phone, MapPin } from "lucide-react";

export function Footer() {
  const year = new Date().getFullYear();

  return (
    <footer className="bg-foreground text-foreground">
      <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div className="sm:col-span-2 lg:col-span-1">
            <Link to="/" className="font-display text-2xl font-extrabold tracking-tight">
              Gully<span className="text-brand">Gadget</span>
            </Link>
            <p className="mt-3 max-w-xs text-sm text-white/60">
              India's most-trending lifestyle gadgets at affordable prices. Quality tested. Free shipping pan-India.
            </p>
            <div className="mt-4 flex items-center gap-3">
              <a href="#" className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-brand hover:text-white" aria-label="Twitter">
                <Twitter className="size-4" />
              </a>
              <a href="#" className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-brand hover:text-white" aria-label="Facebook">
                <Facebook className="size-4" />
              </a>
              <a href="#" className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-brand hover:text-white" aria-label="Instagram">
                <Instagram className="size-4" />
              </a>
              <a href="#" className="grid size-9 place-items-center rounded-full bg-white/10 text-white/80 hover:bg-brand hover:text-white" aria-label="YouTube">
                <ShoppingCart className="size-4" />
              </a>
            </div>
          </div>

          {/* Shop */}
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest">Shop</h3>
            <nav className="mt-4 space-y-2.5" aria-label="Shop links">
              <Link to="/products" className="block text-sm text-white/60 hover:text-white">All Products</Link>
              <Link to="/products" search={{ sort: "rating" }} className="block text-sm text-white/60 hover:text-white">Bestsellers</Link>
              <Link to="/products" search={{ category: "kitchen" }} className="block text-sm text-white/60 hover:text-white">Kitchen</Link>
              <Link to="/products" search={{ category: "home-comfort" }} className="block text-sm text-white/60 hover:text-white">Home Comfort</Link>
              <Link to="/products" search={{ category: "personal-care" }} className="block text-sm text-white/60 hover:text-white">Personal Care</Link>
            </nav>
          </div>

          {/* Support */}
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest">Support</h3>
            <nav className="mt-4 space-y-2.5" aria-label="Support links">
              <a href="#" className="flex items-center gap-2 text-sm text-white/60 hover:text-white">
                <Mail className="size-4" /> Contact Us
              </a>
              <Link to="/track" className="block text-sm text-white/60 hover:text-white">Track Order</Link>
              <a href="#" className="block text-sm text-white/60 hover:text-white">FAQ</a>
              <a href="#" className="block text-sm text-white/60 hover:text-white">Shipping Policy</a>
              <a href="#" className="block text-sm text-white/60 hover:text-white">Return Policy</a>
            </nav>
          </div>

          {/* Company */}
          <div>
            <h3 className="font-display text-sm font-bold uppercase tracking-widest">Company</h3>
            <nav className="mt-4 space-y-2.5" aria-label="Company links">
              <a href="#" className="block text-sm text-white/60 hover:text-white">About Us</a>
              <a href="#" className="block text-sm text-white/60 hover:text-white">Privacy Policy</a>
              <a href="#" className="block text-sm text-white/60 hover:text-white">Terms of Service</a>
              <a href="#" className="block text-sm text-white/60 hover:text-white">Refund Policy</a>
            </nav>
          </div>
        </div>

        {/* Newsletter */}
        <div className="mt-12 border-t border-white/10 pt-8">
          <div className="grid gap-6 sm:flex sm:items-center sm:justify-between">
            <div>
              <h3 className="font-display text-sm font-bold uppercase tracking-widest">Get exclusive drops</h3>
              <p className="mt-1 text-sm text-white/60">Subscribe for deals, new arrivals and more.</p>
            </div>
            <form className="flex w-full max-w-sm gap-2">
              <label htmlFor="footer-email" className="sr-only">Email</label>
              <input
                id="footer-email"
                type="email"
                placeholder="you@email.com"
                className="flex-1 rounded-full bg-white/10 px-4 py-2.5 text-sm text-white placeholder:text-white/40 outline-none ring-1 ring-white/10 focus:ring-brand"
              />
              <button
                type="submit"
                className="shrink-0 rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-brand-foreground hover:bg-brand/90"
              >
                Join
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div className="border-t border-white/10">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-6 sm:flex-row sm:px-6 lg:px-8">
          <p className="text-xs text-white/40">
            © {year} GullyGadget Tech Pvt Ltd. All rights reserved.
          </p>
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 text-xs text-white/40">
              <MapPin className="size-3" /> Cash on Delivery Available
            </span>
            <span className="flex items-center gap-1.5 text-xs text-white/40">
              <ShoppingCart className="size-3" /> Free Shipping on Orders ₹499+
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}