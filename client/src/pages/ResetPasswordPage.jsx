import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, LockKeyhole } from 'lucide-react';
import toast from 'react-hot-toast';
import { Brand } from '../components/Brand.jsx';
import { api, apiMessage } from '../services/api.js';

function resetTokenFromHash(hash) {
  return new URLSearchParams(hash.replace(/^#/, '')).get('token') || '';
}

export default function ResetPasswordPage() {
  const location = useLocation();
  const navigate = useNavigate();
  const token = resetTokenFromHash(location.hash);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(token ? '' : 'This password reset link is invalid or has expired.');

  async function submit(event) {
    event.preventDefault();
    setError('');
    if (password.length < 12 || !/[A-Za-z]/.test(password) || !/[0-9]/.test(password) || new TextEncoder().encode(password).length > 72) {
      setError('Use at least 12 characters with a letter and a number (maximum 72 UTF-8 bytes).');
      return;
    }
    if (password !== confirmPassword) {
      setError('Those passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      await api.get('/auth/csrf');
      await api.post('/auth/reset-password', { token, password });
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
    } catch (requestError) {
      setError(apiMessage(requestError, 'Your password could not be reset.'));
    } finally {
      setBusy(false);
    }
  }

  return <section className="auth-section"><div className="auth-card">
    <div className="auth-card-head"><Brand /><div className="auth-lock"><LockKeyhole size={19} /></div></div>
    <div className="eyebrow">ACCOUNT RECOVERY</div><h1>Choose a new password.</h1>
    <p className="auth-subtitle">Reset links expire after 30 minutes and can only be used once.</p>
    <form className="form-stack" onSubmit={submit}>
      {error && <div className="form-error" role="alert">{error}</div>}
      <label>New password<input type="password" autoComplete="new-password" required minLength={12} maxLength={128} value={password} onChange={(event) => setPassword(event.target.value)} /></label>
      <label>Confirm new password<input type="password" autoComplete="new-password" required maxLength={128} value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></label>
      <button className="button button-primary button-full" disabled={busy || !token}>{busy ? 'Updating…' : <>Update password <ArrowRight size={16} /></>}</button>
    </form>
    <div className="auth-switch"><Link to="/login">Back to sign in</Link></div>
  </div></section>;
}
