import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { saveAuth } from '../lib/auth';
import { Logo } from '../components/Logo';

export default function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch('/api/worker/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(
          data?.message?.message ?? data?.message ?? 'Ошибка входа',
        );
      saveAuth(data.accessToken, data.employee);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-[380px] max-w-full rounded-2xl bg-card p-10 shadow-[0_18px_50px_rgba(12,48,120,0.12)] ring-1 ring-border">
        {/* Logo — на светлом фоне в оригинальных фирменных цветах */}
        <div className="mb-8">
          <Logo className="w-full h-auto" />
          <div className="text-[11px] text-muted-foreground mt-2">
            Кабинет сотрудника
          </div>
        </div>

        <h2 className="m-0 mb-6 text-xl font-bold text-foreground">Вход</h2>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Email
            </label>
            <input
              type="email"
              value={login}
              onChange={(e) => setLogin(e.target.value)}
              placeholder="name@transasia.co"
              required
              className="w-full box-border px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40 transition"
            />
          </div>

          <div className="mb-6">
            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              className="w-full box-border px-3 py-2.5 rounded-lg border border-border bg-background text-sm text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-ring/40 transition"
            />
          </div>

          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-[13px] text-destructive">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full flex items-center justify-center gap-2 rounded-lg bg-primary py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" /> Вход...
              </>
            ) : (
              'Войти'
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
