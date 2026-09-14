import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Spinner } from '../components/ui';

const DEMO_ACCOUNTS = ['demo1@ivy.homes', 'demo2@ivy.homes', 'demo3@ivy.homes'];

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('demo1@ivy.homes');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(email.trim(), password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="hidden flex-col justify-between bg-moss-700 p-10 text-white lg:flex">
        <div className="flex items-baseline gap-1.5">
          <span className="font-display text-2xl font-semibold">Ivy</span>
          <span className="font-display text-2xl text-white/80">Homes</span>
        </div>
        <div className="max-w-md">
          <h1 className="font-display text-4xl leading-tight">Property search for Pune, with the numbers checked.</h1>
          <p className="mt-4 text-white/70">
            3,800 sale listings, 1,450 rentals and 440 builder projects — rebuilt from the source API, with the
            mislabelled areas converted, the rescaled project prices fixed and the bait listings marked.
          </p>
        </div>
        <p className="font-mono text-xs text-white/50">Baner · Hinjewadi · Kharadi · Kothrud · Wakad · Aundh</p>
      </div>

      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <h2 className="font-display text-2xl text-ink">Sign in</h2>
          <p className="mt-1 text-sm text-ink-muted">Use one of the three demo accounts.</p>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-soft">Email</span>
              <input
                className="field" type="email" autoComplete="username" required
                value={email} onChange={(e) => setEmail(e.target.value)}
              />
            </label>

            <label className="block">
              <span className="mb-1 block text-[11px] font-medium uppercase tracking-wide text-ink-soft">Password</span>
              <input
                className="field" type="password" autoComplete="current-password" required
                value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="Issued with your API key"
              />
            </label>

            {error && (
              <p role="alert" className="rounded-card border border-clay-500/30 bg-clay-50 px-3 py-2 text-sm text-clay-600">
                {error}
              </p>
            )}

            <button type="submit" className="btn-primary w-full" disabled={busy || !password}>
              {busy && <Spinner />}
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>

          <div className="mt-6 border-t border-line pt-4">
            <p className="text-[11px] uppercase tracking-wide text-ink-soft">Demo accounts</p>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {DEMO_ACCOUNTS.map((a) => (
                <button key={a} type="button" className="chip hover:border-line-strong" onClick={() => setEmail(a)}>
                  {a}
                </button>
              ))}
            </div>
            <p className="mt-3 text-xs text-ink-soft">
              Your session is kept in an httpOnly cookie and lasts seven days, so it survives a refresh — the upstream
              token it is built on expires after fifteen minutes.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
