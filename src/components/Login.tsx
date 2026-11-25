import { useState } from 'react';
import { ArrowRight, LockKeyhole } from 'lucide-react';

export default function Login({ onLogin }: { onLogin: (password: string) => Promise<void> }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  return <main className="login-page"><section className="login-card"><img src="/brand/avatar.jpg" alt="" width="64" height="64" /><span className="eyebrow">ФМиИТ · КОНТЕНТ-СТУДИЯ</span><h1>Ваши истории<br />начинаются здесь.</h1><p>Введите пароль редактора, чтобы продолжить.</p><form onSubmit={async event => { event.preventDefault(); setBusy(true); setError(''); try { await onLogin(password); } catch (failure) { setError(failure instanceof Error ? failure.message : 'Не удалось войти.'); } finally { setBusy(false); } }}><label className="field-label" htmlFor="admin-password"><LockKeyhole size={14} />Пароль редактора</label><input id="admin-password" type="password" autoComplete="current-password" value={password} onChange={event => setPassword(event.target.value)} maxLength={256} required disabled={busy} />{error && <p className="field-error" role="alert">{error}</p>}<button type="submit" className="button button-primary" disabled={busy}>{busy ? <span className="spinner" /> : <>Войти в студию<ArrowRight size={17} /></>}</button></form></section></main>;
}
