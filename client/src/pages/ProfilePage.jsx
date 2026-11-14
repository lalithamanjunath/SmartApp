import { useState } from 'react';
import { LockKeyhole, Save, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { api, apiMessage, dataOf } from '../services/api.js';

export default function ProfilePage() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState({ name: user?.name || '', email: user?.email || '' });
  const [password, setPassword] = useState({ currentPassword: '', newPassword: '' });
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  async function saveProfile(event) {
    event.preventDefault(); setSavingProfile(true);
    try { const response = await api.patch('/users/me', profile); updateUser(dataOf(response).user); toast.success('Your profile is up to date.'); }
    catch (error) { toast.error(apiMessage(error, 'Your profile could not be updated.')); }
    finally { setSavingProfile(false); }
  }
  async function savePassword(event) {
    event.preventDefault();
    if (password.newPassword.length < 8) { toast.error('Use at least 8 characters for your new password.'); return; }
    setSavingPassword(true);
    try { await api.patch('/users/me/password', password); setPassword({ currentPassword: '', newPassword: '' }); toast.success('Password updated securely.'); }
    catch (error) { toast.error(apiMessage(error, 'Your password could not be updated.')); }
    finally { setSavingPassword(false); }
  }
  return <>
    <PageHeader eyebrow="YOUR ACCOUNT" title="A few details about you." description="Keep your profile current and your account secure." />
    <div className="profile-grid"><section className="surface-panel profile-panel"><div className="profile-section-title"><span className="profile-section-icon"><UserRound size={18}/></span><div><h2>Personal information</h2><p>These details help keep your appointments together.</p></div></div><form className="form-stack" onSubmit={saveProfile}><label>Your name<input required minLength={2} maxLength={100} value={profile.name} onChange={(event) => setProfile({ ...profile, name: event.target.value })}/></label><label>Email address<input type="email" required maxLength={254} value={profile.email} onChange={(event) => setProfile({ ...profile, email: event.target.value })}/></label><div className="profile-role"><span>Account type</span><strong>{user?.role === 'admin' ? 'Administrator' : 'Member'}</strong><small>Account access is managed securely.</small></div><button className="button button-primary" disabled={savingProfile}><Save size={16}/>{savingProfile ? 'Saving…' : 'Save changes'}</button></form></section>
      <section className="surface-panel profile-panel"><div className="profile-section-title"><span className="profile-section-icon profile-lock-icon"><LockKeyhole size={18}/></span><div><h2>Change password</h2><p>Use a strong password you don’t use elsewhere.</p></div></div><form className="form-stack" onSubmit={savePassword}><label>Current password<input type="password" autoComplete="current-password" required value={password.currentPassword} onChange={(event) => setPassword({ ...password, currentPassword: event.target.value })}/></label><label>New password<input type="password" autoComplete="new-password" minLength={8} maxLength={128} required value={password.newPassword} onChange={(event) => setPassword({ ...password, newPassword: event.target.value })}/></label><div className="password-note"><LockKeyhole size={15}/>At least 8 characters. Your password is stored securely.</div><button className="button button-outline" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Update password'}</button></form></section></div>
  </>;
}
