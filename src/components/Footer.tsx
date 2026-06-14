import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="bg-brand px-6 py-20 text-white/60">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-12 md:flex-row md:items-start">
        <div className="max-w-xs text-center md:text-left">
          <h2 className="mb-2 font-display text-3xl font-extrabold uppercase tracking-tighter text-white">
            GullyGadget
          </h2>
          <p className="text-sm">
            India's most-trending lifestyle gadgets, all under ₹1000. Quality tested. Free shipping pan-India.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-x-12 gap-y-3 text-xs font-bold uppercase tracking-widest text-white sm:grid-cols-3">
          <Link to="/products">All Products</Link>
          <a href="#">Warranty</a>
          <a href="#">Returns</a>
          <a href="#">Track Order</a>
          <a href="#">Contact</a>
          <a href="#">Privacy</a>
        </div>
        <form className="w-full max-w-xs space-y-3 text-center md:text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-white">Get exclusive drops</p>
          <div className="flex overflow-hidden rounded-full bg-white/10 ring-1 ring-white/10">
            <input
              type="email"
              placeholder="you@email.com"
              className="flex-1 bg-transparent px-4 py-2 text-sm text-white outline-none placeholder:text-white/40"
            />
            <button
              type="button"
              className="bg-offer px-4 text-xs font-bold uppercase tracking-widest text-white hover:opacity-90"
            >
              Join
            </button>
          </div>
        </form>
      </div>
      <div className="mx-auto mt-16 max-w-7xl border-t border-white/5 pt-8 text-center text-[10px] uppercase tracking-[0.3em]">
        &copy; {new Date().getFullYear()} GullyGadget Tech Pvt Ltd. All rights reserved.
      </div>
    </footer>
  );
}