import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Eye, EyeOff, LockKeyhole } from 'lucide-react';
import toast from 'react-hot-toast';
import { Brand } from '../components/Brand.jsx';
import { apiMessage } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';

export default function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  async function submit(event) {
    event.preventDefault(); setBusy(true); setError('');
    try {
      const user = await login(form);
      toast.success('Good to see you again.');
      const route = user.role === 'admin' ? '/admin/dashboard' : '/app/dashboard';
      navigate(location.state?.from || route, { replace: true });
    } catch (requestError) { const message = apiMessage(requestError, 'We could not sign you in. Check your details and try again.'); setError(message); toast.error(message); }
    finally { setBusy(false); }
  }
  return <section className="auth-section"><div className="auth-card"><div className="auth-card-head"><Brand /><div className="auth-lock"><LockKeyhole size={19} /></div></div><div className="eyebrow">YOUR TIME, IN GOOD HANDS</div><h1>Good to see you.</h1><p className="auth-subtitle">Sign in to pick up where you left off.</p>
      <form className="form-stack" onSubmit={submit}>
        {error && <div className="form-error" role="alert">{error}</div>}
        <label>Email address<input type="email" autoComplete="email" required maxLength={254} placeholder="you@company.com" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} /></label>
        <label>Password<span className="password-field"><input type={showPassword ? 'text' : 'password'} autoComplete="current-password" required maxLength={128} placeholder="Enter your password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} /><button type="button" aria-label={showPassword ? 'Hide password' : 'Show password'} onClick={() => setShowPassword(!showPassword)}>{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></span></label>
        <button className="button button-primary button-full" disabled={busy}>{busy ? 'Signing in…' : <>Sign in <ArrowRight size={16} /></>}</button>
      </form>
      <div className="auth-switch">New to Tandem? <Link to="/register">Create an account</Link></div>
      <div className="auth-footnote">Your information stays private and secure.</div>
    </div><aside className="auth-aside"><span className="auth-aside-mark">✳</span><div className="eyebrow eyebrow-light">GOOD SCHEDULING FEELS DIFFERENT</div><h2>Your plans,<br />a little more<br /><span>in sync.</span></h2><p>Appointments, details and time to breathe—together in one clear place.</p><div className="auth-aside-rule" /><small>LESS BACK-AND-FORTH. MORE BEING THERE.</small></aside></section>;
}
