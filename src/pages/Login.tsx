import { useState } from "react";
import { Dumbbell, Eye, EyeOff, LogIn } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleLogin = async () => {
    if (!form.email || !form.password) { setError("Please enter email and password"); return; }
    setLoading(true);
    setError("");
    setTimeout(() => {
      const ok = login(form.email, form.password);
      if (!ok) {
        setError("Invalid email or password");
        toast.error("Login failed", { description: "Check your credentials and try again" });
      } else {
        toast.success("Welcome back!");
      }
      setLoading(false);
    }, 400);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleLogin();
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-[#0a0a0a] mb-4 shadow-lg">
            <Dumbbell className="w-8 h-8 text-[#ffc700]" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">GymPro</h1>
          <p className="text-sm text-muted-foreground mt-1">Management System</p>
        </div>

        <Card className="shadow-lg border-border/60">
          <CardHeader className="pb-3 pt-6">
            <h2 className="text-lg font-semibold text-foreground">Sign in to your account</h2>
            <p className="text-sm text-muted-foreground">Enter your credentials to continue</p>
          </CardHeader>
          <CardContent className="space-y-4 pb-6">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@gym.com"
                value={form.email}
                onChange={e => setForm(p => ({ ...p, email: e.target.value }))}
                onKeyDown={handleKeyDown}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <Button
              className="w-full gap-2 mt-2"
              onClick={handleLogin}
              disabled={loading}
            >
              {loading ? (
                <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              ) : (
                <LogIn className="w-4 h-4" />
              )}
              {loading ? "Signing in…" : "Sign In"}
            </Button>

            <div className="pt-2 border-t border-border">
              <p className="text-xs text-muted-foreground text-center mb-2">Demo accounts</p>
              <div className="space-y-1">
                {[
                  { email: "admin@gym.com", pass: "admin123", role: "Admin" },
                  { email: "reception@gym.com", pass: "rec123", role: "Reception" },
                  { email: "sales@gym.com", pass: "sales123", role: "Sales" },
                ].map(({ email, pass, role }) => (
                  <button
                    key={role}
                    onClick={() => setForm({ email, password: pass })}
                    className="w-full text-left px-2.5 py-1.5 rounded-md hover:bg-muted/60 transition-colors"
                  >
                    <span className="inline-flex items-center gap-2">
                      <span className="text-xs font-semibold text-foreground w-20">{role}</span>
                      <span className="text-xs text-muted-foreground">{email}</span>
                      <span className="text-xs text-muted-foreground ml-auto opacity-60">/ {pass}</span>
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
