import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";

const authSearch = z.object({ mode: z.enum(["signin", "signup"]).optional(), redirect: z.string().optional() });

export const Route = createFileRoute("/auth")({
  validateSearch: authSearch,
  head: () => ({ meta: [{ title: "Sign in — GullyGadget" }] }),
  component: AuthPage,
});

function AuthPage() {
  const search = Route.useSearch();
  const navigate = useNavigate();
  const [tab, setTab] = useState<"signin" | "signup">(search.mode ?? "signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (tab === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: window.location.origin, data: { full_name: name } },
        });
        if (error) throw error;
        toast.success("Account created!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      navigate({ to: search.redirect ?? "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Auth failed");
    } finally {
      setBusy(false);
    }
  };

  const google = async () => {
    try {
      const r = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
      if (r.error) throw new Error(r.error.message ?? "Google sign-in failed");
      if (!r.redirected) navigate({ to: search.redirect ?? "/" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
    }
  };

  return (
    <div className="mx-auto max-w-md px-6 py-16">
      <div className="rounded-3xl bg-white p-8 ring-1 ring-brand/5">
        <h1 className="mb-2 font-display text-3xl uppercase">Welcome</h1>
        <p className="mb-6 text-sm text-muted-foreground">Sign in to shop, track orders & save favourites</p>

        <Button onClick={google} variant="outline" className="mb-4 w-full rounded-full">Continue with Google</Button>
        <div className="mb-4 text-center text-xs uppercase tracking-widest text-muted-foreground">or</div>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "signin" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <TabsContent value="signup" className="m-0">
              <Label>Full Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} required={tab === "signup"} placeholder="Riya Sharma" />
            </TabsContent>
            <div>
              <Label>Email</Label>
              <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required placeholder="you@email.com" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
            </div>
            <Button type="submit" disabled={busy} className="w-full rounded-full bg-brand font-bold uppercase tracking-tighter hover:bg-accent-cyan">
              {busy ? "Please wait…" : tab === "signup" ? "Create Account" : "Sign In"}
            </Button>
          </form>
        </Tabs>

        <p className="mt-6 text-center text-xs text-muted-foreground">
          <Link to="/" className="hover:underline">← Back to store</Link>
        </p>
      </div>
    </div>
  );
}