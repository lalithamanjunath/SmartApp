import { useEffect, useState } from 'react';
import { CheckCircle2, CircleAlert, Clock3, Database, ShieldCheck } from 'lucide-react';
import { PageHeader } from '../components/PageHeader.jsx';

function healthUrl() {
  const configuredBase = import.meta.env.VITE_API_BASE_URL || '';
  if (!configuredBase.startsWith('http')) return '/api/health';
  const origin = configuredBase.replace(/\/api\/v1\/?$/, '').replace(/\/$/, '');
  return `${origin}/api/health`;
}

export default function AdminSettingsPage() {
  const [database, setDatabase] = useState('checking');
  useEffect(() => {
    let active = true;
    fetch(healthUrl()).then((response) => {
      if (!response.ok) throw new Error('Health check failed');
      return response.json();
    }).then((payload) => { if (active) setDatabase(payload.database || 'disconnected'); })
      .catch(() => { if (active) setDatabase('unavailable'); });
    return () => { active = false; };
  }, []);
  const connected = database === 'connected';
  return <>
    <PageHeader eyebrow="ADMINISTRATION · SETTINGS" title="A few things behind the scenes." description="The core settings that keep appointment availability and access clear." />
    <div className="settings-grid">
      <section className="surface-panel settings-panel"><div className="profile-section-title"><span className="profile-section-icon"><Clock3 size={18} /></span><div><h2>Cancellation window</h2><p>Appointments may be cancelled at least 24 hours in advance.</p></div></div><div className="settings-value"><strong>24 hours</strong><span>Configured by the server environment as CANCELLATION_CUTOFF_HOURS.</span></div></section>
      <section className="surface-panel settings-panel"><div className="profile-section-title"><span className="profile-section-icon profile-lock-icon"><ShieldCheck size={18} /></span><div><h2>Account security</h2><p>Password hashing, HTTP-only JWT cookies and role checks are enforced by the API.</p></div></div><div className="settings-value"><strong>Protected</strong><span>Only administrators can access these management pages.</span></div></section>
      <section className="surface-panel settings-panel"><div className="profile-section-title"><span className="profile-section-icon profile-blue-icon"><Database size={18} /></span><div><h2>MongoDB Atlas</h2><p>Persistent appointments and accounts are stored in the configured Atlas database.</p></div></div><div className={`connection-state ${connected ? 'connection-good' : 'connection-warn'}`}>{connected ? <CheckCircle2 size={16} /> : <CircleAlert size={16} />}<span>{database === 'checking' ? 'Checking connection…' : connected ? 'Connected' : 'Not connected'}</span></div><p className="settings-helper">Set MONGODB_URI in the backend environment. Secrets are never displayed here.</p></section>
      <section className="surface-panel settings-panel"><div className="profile-section-title"><span className="profile-section-icon"><Clock3 size={18} /></span><div><h2>Appointment timezone</h2><p>Slot date/time values are interpreted by the API in UTC.</p></div></div><div className="settings-value"><strong>UTC</strong><span>Use UTC when creating slots until a business-local timezone is configured.</span></div></section>
    </div>
  </>;
}
