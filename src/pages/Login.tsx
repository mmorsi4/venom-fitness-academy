import { useState } from "react";
import { Dumbbell, Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { useAuth } from "@/lib/auth";
import { toast } from "sonner";

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ email: "", password: "" });
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!form.email || !form.password) {
      toast.error("Enter email and password");
      return;
    }
    setLoading(true);
    const result = await login(form.email, form.password);
    setLoading(false);
    if (!result.ok) {
      toast.error(result.error ?? "Invalid credentials");
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") handleLogin();
  };

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      {/* Background accent */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full bg-primary/8 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="w-full max-w-sm relative">
        {/* Logo area */}
        <div className="text-center mb-8">
          <div className="flex flex-col items-center gap-2 py-2">
            <img src="/venom_logo.png" alt="Venom Logo" className="w-full h-32 object-contain" />
          </div>
        </div>

        <Card className="shadow-lg border-border/60">
          <CardHeader className="pb-3 pt-6">
            <h2 className="text-lg font-semibold text-muted-foreground">Sign in to your account</h2>
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
                  type={showPass ? "text" : "password"}
                  placeholder="••••••••"
                  value={form.password}
                  onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  onKeyDown={handleKeyDown}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(p => !p)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <Button
              data-testid="btn-login"
              onClick={handleLogin}
              disabled={loading}
              className="w-full h-10 font-semibold"
            >
              {loading ? "Signing in..." : "Sign In"}
            </Button>
          </CardContent>
        </Card>

        <p className="text-xs text-center text-muted-foreground mt-4">
          Venom Fitness Academy · Management System
        </p>
      </div>
    </div>
  );
}
