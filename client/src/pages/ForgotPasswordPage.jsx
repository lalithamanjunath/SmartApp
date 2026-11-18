import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import { Brand } from '../components/Brand.jsx';
import { api, apiMessage } from '../services/api.js';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await api.get('/auth/csrf');
      const response = await api.post('/auth/forgot-password', { email });
      setNotice(response.data.message);
    } catch (requestError) {
      setError(apiMessage(requestError, 'The reset request could not be completed. Try again later.'));
    } finally {
      setBusy(false);
    }
  }

  return <section className="auth-section"><div className="auth-card">
    <div className="auth-card-head"><Brand /><div className="auth-lock"><LockKeyhole size={19} /></div></div>
    <div className="eyebrow">ACCOUNT RECOVERY</div><h1>Reset your password.</h1>
    <p className="auth-subtitle">Enter your email and we’ll send a one-time reset link if an account matches.</p>
    <form className="form-stack" onSubmit={submit}>
      {error && <div className="form-error" role="alert">{error}</div>}
      {notice && <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status">{notice}</div>}
      <label>Email address<input type="email" autoComplete="email" required maxLength={254} value={email} onChange={(event) => setEmail(event.target.value)} /></label>
      <button className="button button-primary button-full" disabled={busy}>{busy ? 'Sending…' : <>Send reset link <ArrowRight size={16} /></>}</button>
    </form>
    <div className="auth-switch"><Link to="/login">Back to sign in</Link></div>
  </div></section>;
}
