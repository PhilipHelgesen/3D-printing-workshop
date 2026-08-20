import { useState, type FormEvent } from 'react';
import { supabase } from '../supabase.ts';
import s from './ui.module.css';

/**
 * The whole app sits behind this. RLS requires the `authenticated` role now, so
 * without a session every write silently no-ops — better to stop at the door
 * than to run a workshop that looks fine and saves nothing.
 */
export function SignIn() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    // On success the auth listener in App swaps this screen out — nothing to do
    // here, and clearing `busy` would just flash the button back to life first.
    if (error) {
      setMessage(error.message);
      setBusy(false);
    }
  };

  return (
    <div className={s.signInPage}>
      <form className={s.signInCard} onSubmit={submit}>
        <h1 className={s.signInTitle}>Philip´s workshop</h1>
        <p className={s.signInSub}>Sign in to load the bench.</p>
        <input
          className={s.signInField}
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          aria-label="Email"
          autoComplete="username"
          required
          autoFocus
        />
        <input
          className={s.signInField}
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          aria-label="Password"
          autoComplete="current-password"
          required
        />
        <button className={s.btnFill} type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        {message && (
          <p className={s.signInError} role="alert">
            {message}
          </p>
        )}
      </form>
    </div>
  );
}
