import { useEffect, useState } from 'react';
import { supabase, SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../lib/supabase';

export default function AuthGate({ children }) {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Supabase session error:', error);
      if (mounted) {
        setSession(data?.session ?? null);
        setLoading(false);
      }
    }).catch((error) => {
      console.error('Supabase session network error:', error);
      if (mounted) setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setLoading(false);
    });
    return () => { mounted = false; listener.subscription.unsubscribe(); };
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    setMessage('');
    if (!email || !password) return setMessage('Enter your email and password.');
    try {
      const result = await supabase.auth.signInWithPassword({ email, password });

      if (result.error) {
        setMessage(`${result.error.message} (Supabase Auth)`);
        console.error('Supabase Auth error:', result.error);
      }
    } catch (error) {
      console.error('Supabase Auth network error:', error);
      setMessage(
        `Could not reach Supabase Auth. ${error?.message || 'Network request failed.'} Check the Supabase project URL/status.`
      );
    }
  };

  if (loading) return <div style={styles.center}>Loading secure billing workspace…</div>;
  if (session) return children;

  return (
    <div style={styles.center}>
      <form onSubmit={submit} style={styles.card}>
        <h1 style={{ marginTop: 0 }}>Free GST Billing</h1>
        <p style={{ color: '#64748b' }}>Sign in to access your billing data.</p>
        <input style={styles.input} type="email" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" />
        <input style={styles.input} type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} />
        {message && <div style={styles.message}>{message}</div>}
        <button style={styles.button} type="submit">Sign in</button>
      </form>
    </div>
  );
}

const styles = {
  center: { minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', fontFamily: 'system-ui, sans-serif', padding: 20 },
  card: { width: '100%', maxWidth: 400, background: '#fff', padding: 28, borderRadius: 16, boxShadow: '0 10px 35px rgba(15,23,42,.10)', display: 'grid', gap: 12 },
  input: { padding: '12px 14px', border: '1px solid #cbd5e1', borderRadius: 8, fontSize: 15 },
  button: { padding: '12px 14px', border: 0, borderRadius: 8, background: '#2563eb', color: '#fff', fontWeight: 600, cursor: 'pointer' },
  link: { border: 0, background: 'transparent', color: '#2563eb', cursor: 'pointer' },
  message: { padding: 10, background: '#fef2f2', color: '#991b1b', borderRadius: 8, fontSize: 13 },
};
