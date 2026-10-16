import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../api';
import { useStore } from '../store';

export function AuthPage({ mode }: { mode: 'login' | 'register' }) {
  const { refresh } = useStore();
  const nav = useNavigate();
  const [params] = useSearchParams();
  const [username, setUsername] = useState(mode === 'login' ? 'david' : '');
  const [password, setPassword] = useState(mode === 'login' ? 'password' : '');
  const [display, setDisplay] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (mode === 'login') await api.post('/api/auth/login', { username, password });
      else await api.post('/api/auth/register', { username, password, display_name: display || username, timezone: tz });
      await refresh();
      nav(params.get('next') || '/');
    } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <div className="auth">
      <form className="card" onSubmit={submit}>
        <div className="logo" style={{ marginBottom: 18 }}><span className="k">K</span>Kept</div>
        <h1 style={{ fontSize: 22 }}>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h1>
        <p className="muted small">{mode === 'login' ? 'Your communities are waiting. So is your streak.' : 'Join communities that notice when you show up.'}</p>
        <label className="field">Username</label>
        <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus autoComplete="username" />
        {mode === 'register' && <><label className="field">Display name</label><input className="input" value={display} onChange={(e) => setDisplay(e.target.value)} /></>}
        <label className="field">Password</label>
        <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {error && <div className="small" style={{ color: 'var(--red)', marginTop: 10 }}>{error}</div>}
        <button className="btn btn-primary btn-block btn-lg" style={{ marginTop: 18 }} disabled={busy}>{mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <p className="small muted" style={{ marginTop: 14 }}>
          {mode === 'login' ? <>New here? <Link to="/register">Create an account</Link>. </> : <>Have an account? <Link to="/login">Sign in</Link>. </>}
          <Link to="/discover">Browse communities</Link>
        </p>
        {mode === 'login' && <p className="tiny muted">Demo accounts: david, maya, jordan, sam, priya, leo, ava, noah, zoe, ethan — password <code>password</code>.</p>}
      </form>
    </div>
  );
}
