import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import toast from 'react-hot-toast';
import { Brand } from '../components/Brand.jsx';
import { apiMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setError('');
    if (form.password.length < 8) { setError('Use at least 8 characters for your password.'); return; }
    if (form.password !== form.confirmPassword) { setError('Those passwords do not match yet.'); return; }
    setBusy(true);
    try {
      await register({ name: form.name, email: form.email, password: form.password });
      toast.success('Your account is ready.'); navigate('/app/dashboard', { replace: true });
    } catch (requestError) { const message = apiMessage(requestError, 'Your account could not be created. Please try again.'); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }
  return <section className="auth-section"><div className="auth-card"><div className="auth-card-head"><Brand /><div className="auth-lock"><LockKeyhole size={19} /></div></div><div className="eyebrow">A LITTLE MORE IN SYNC</div><h1>Start with a time.</h1><p className="auth-subtitle">Create your account and make your next appointment simple.</p>
      <form className="form-stack" onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <label>Your name<input autoComplete="name" required minLength={2} maxLength={100} placeholder="Alex Morgan" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} /></label>
        <label>Email address<input type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete="new-password" required minLength={8} maxLength={128} placeholder="At least 8 characters" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <label>Confirm password<input type="password" autoComplete="new-password" required maxLength={128} placeholder="Type it once more" value={form.confirmPassword} onChange={(event) => setForm({ ...form, confirmPassword: event.target.value })} /></label>
        <button className="button button-primary button-full" disabled={busy}>{busy ? 'Creating your account…' : <>Create account <ArrowRight size={16} /></>}</button>
      </form>
      <div className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></div><div className="auth-footnote">New accounts are always created as members.</div>
    </div><aside className="auth-aside register-aside"><span className="auth-aside-mark">✳</span><div className="eyebrow eyebrow-light">YOUR NEXT STEP, MADE SIMPLE</div><h2>A good plan<br />starts with<br /><span>a good time.</span></h2><p>Pick a date, choose a slot and let Tandem take care of the small details.</p><div className="auth-aside-rule" /><small>JUST THE DETAILS YOU NEED. NOTHING YOU DON'T.</small></aside></section>;
}
