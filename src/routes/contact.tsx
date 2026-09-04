import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { siteConfig } from "@/lib/site";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: `Contact Us | ${siteConfig.name}` },
      {
        name: "description",
        content: `Contact ${siteConfig.name} — email ${siteConfig.email}, support form and FAQ.`,
      },
      { property: "og:title", content: `Contact Us | ${siteConfig.name}` },
      { property: "og:description", content: `Get help with orders, shipping, and returns.` },
      { property: "og:type", content: "website" },
      { property: "og:url", content: `${siteConfig.url}/contact` },
      { name: "twitter:card", content: "summary" },
    ],
    links: [{ rel: "canonical", href: "/contact" }],
  }),
  component: ContactPage,
});

function ContactPage() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim().length < 2) return toast.error("Please enter your name (2+ characters).");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      return toast.error("Please enter a valid email.");
    if (message.trim().length < 10) return toast.error("Message should be at least 10 characters.");
    setBusy(true);
    const { error } = await supabase
      .from("contact_messages")
      .insert({ name: name.trim(), email: email.trim(), message: message.trim() });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Message received. We'll reply to your email.");
    setName("");
    setEmail("");
    setMessage("");
  };

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="font-display text-4xl uppercase">Contact Us</h1>
      <p className="mt-2 text-muted-foreground">
        Questions about an order, shipping, or a product? We're here.
      </p>

      <div className="mt-8 grid gap-6 md:grid-cols-[1fr_300px]">
        <form onSubmit={submit} className="rounded-3xl bg-white p-6 ring-1 ring-border space-y-4">
          <div>
            <Label htmlFor="c-name">Name</Label>
            <Input
              id="c-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              autoComplete="name"
            />
          </div>
          <div>
            <Label htmlFor="c-email">Email</Label>
            <Input
              id="c-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
            />
          </div>
          <div>
            <Label htmlFor="c-msg">Message</Label>
            <Textarea
              id="c-msg"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={5}
              required
            />
            <p className="mt-1 text-xs text-muted-foreground">
              Messages are stored securely. Email delivery is configured via Supabase; add SMTP in
              project settings to enable notifications.
            </p>
          </div>
          <Button type="submit" disabled={busy} className="rounded-full">
            {busy ? "Sending…" : "Send message"}
          </Button>
        </form>

        <div className="space-y-4">
          <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
            <h2 className="font-bold">Reach us</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Email: {siteConfig.email}
              <br />
              Phone: {siteConfig.phone}
              <br />
              {siteConfig.address}
            </p>
            <p className="mt-2 text-xs text-muted-foreground">
              Edit contacts in <code>src/lib/site.ts</code>.
            </p>
          </div>
          <div className="rounded-2xl bg-brand-soft p-4 ring-1 ring-border">
            <p className="text-sm font-medium">Need quick answers?</p>
            <Link to="/faq" className="text-sm text-brand hover:underline">
              Visit FAQ →
            </Link>
            <span className="mx-2 text-muted-foreground">·</span>
            <Link to="/track" className="text-sm text-brand hover:underline">
              Track order →
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
