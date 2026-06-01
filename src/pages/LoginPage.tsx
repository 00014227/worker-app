import { useState, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Truck, Loader2 } from 'lucide-react';
import { saveAuth } from '../lib/auth';

export default function LoginPage() {
  const navigate = useNavigate();
  const [login, setLogin]       = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

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
      if (!res.ok) throw new Error(data?.message?.message ?? data?.message ?? 'Ошибка входа');
      saveAuth(data.accessToken, data.employee);
      navigate('/dashboard', { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Ошибка входа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: '#f5f6fa',
    }}>
      <div style={{
        background: '#fff', borderRadius: 12, padding: '40px 48px', width: 380,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 32 }}>
          <div style={{ background: '#1e2a3a', borderRadius: 8, padding: '6px 8px', display: 'flex' }}>
            <Truck size={20} color="#4f9cf9" />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: 15, color: '#1e2a3a' }}>TransAsia</div>
            <div style={{ fontSize: 11, color: '#8fa3b8' }}>Кабинет сотрудника</div>
          </div>
        </div>

        <h2 style={{ margin: '0 0 24px', fontSize: 20, fontWeight: 700, color: '#1e2a3a' }}>
          Вход
        </h2>

        <form onSubmit={handleSubmit}>
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Email
            </label>
            <input
              type="email"
              value={login}
              onChange={e => setLogin(e.target.value)}
              placeholder="name@transasia.co"
              required
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14,
                outline: 'none', color: '#1e2a3a',
              }}
            />
          </div>

          <div style={{ marginBottom: 24 }}>
            <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
              Пароль
            </label>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              style={{
                width: '100%', boxSizing: 'border-box', padding: '10px 12px',
                border: '1.5px solid #e2e8f0', borderRadius: 8, fontSize: 14,
                outline: 'none', color: '#1e2a3a',
              }}
            />
          </div>

          {error && (
            <div style={{
              background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8,
              padding: '10px 14px', marginBottom: 16, fontSize: 13, color: '#dc2626',
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%', padding: '11px', background: loading ? '#94a3b8' : '#4f9cf9',
              color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', gap: 8,
            }}
          >
            {loading ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> Вход...</> : 'Войти'}
          </button>
        </form>
      </div>

      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
    </div>
  );
}
