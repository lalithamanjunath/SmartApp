import { lazy, Suspense, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Activity, CalendarDays, CalendarPlus, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Menu, Settings2, ShieldCheck, Users, X } from 'lucide-react';
import toast from 'react-hot-toast';
import { Brand } from '../components/Brand.jsx';
import { useAuth } from '../context/AuthContext.jsx';

const NotificationBell = lazy(() => import('../components/NotificationBell.jsx').then((module) => ({ default: module.NotificationBell })));

const userLinks = [
  { to: '/app/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/app/book', label: 'Book appointment', icon: CalendarPlus },
  { to: '/app/appointments', label: 'My appointments', icon: CalendarDays },
];
const adminLinks = [
  { to: '/admin/dashboard', label: 'Overview', icon: LayoutDashboard, end: true },
  { to: '/admin/slots', label: 'Appointment slots', icon: CalendarPlus },
  { to: '/admin/bookings', label: 'Bookings', icon: CalendarDays },
  { to: '/admin/users', label: 'People', icon: Users },
];

export function DashboardLayout({ role }) {
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const admin = role === 'admin';
  const links = admin ? adminLinks : userLinks;
  const profilePath = admin ? '/admin/settings' : '/app/profile';
  async function signOut() {
    try { await logout(); toast.success('Signed out. See you next time.'); navigate('/'); }
    catch { toast.error('Could not sign out. Please try again.'); }
  }
  return <div className="app-shell">
    <aside className={`app-sidebar ${open ? 'sidebar-open' : ''}`}>
      <div className="sidebar-brand"><Brand to={admin ? '/admin/dashboard' : '/app/dashboard'} /></div>
      <div className="workspace-label">WORKSPACE</div>
      <nav className="side-nav" aria-label="Workspace navigation">
        {links.map(({ to, label, icon: Icon, end }) => <NavLink key={to} to={to} end={end} className={({ isActive }) => `side-link ${isActive ? 'side-link-active' : ''}`} onClick={() => setOpen(false)}><Icon size={18} strokeWidth={1.8} /><span>{label}</span>{label === 'Book appointment' && <span className="nav-accent" />}</NavLink>)}
      </nav>
      <div className="sidebar-bottom"><div className="sidebar-plan"><span className="plan-icon"><ShieldCheck size={17} /></span><div><strong>{admin ? 'Admin workspace' : 'Appointments, in sync'}</strong><small>{admin ? 'Manage your team' : 'Your schedule stays clear'}</small></div></div>
        {admin ? <NavLink to={profilePath} className="side-link"><Settings2 size={18} /><span>Admin settings</span></NavLink> : <NavLink to={profilePath} className="side-link"><Users size={18} /><span>Profile</span></NavLink>}
        <button type="button" className="side-link logout-link" onClick={signOut}><LogOut size={18} /><span>Sign out</span></button>
      </div>
    </aside>
    {open && <button className="sidebar-backdrop" aria-label="Close menu" onClick={() => setOpen(false)} />}
    <main className="workspace-main">
      <header className="workspace-topbar"><button className="sidebar-toggle" onClick={() => setOpen(!open)} aria-label={open ? 'Close navigation' : 'Open navigation'}>{open ? <X size={20} /> : <Menu size={20} />}</button><div className="breadcrumbs"><span>{admin ? 'Administration' : 'My workspace'}</span><span className="crumb-dot">/</span><span className="crumb-current">{admin ? 'Tandem for teams' : 'Personal schedule'}</span></div>
        <div className="topbar-right">{!admin && <Suspense fallback={<span className="h-10 w-10" />}><NotificationBell /></Suspense>}<a href="mailto:support@example.com" className="help-link"><CircleHelp size={17} /><span>Help</span></a><span className="topbar-divider" /><div className="account-menu"><div className="avatar">{user?.name?.slice(0, 1)?.toUpperCase() || 'T'}</div><div className="account-copy"><strong>{user?.name || 'Account'}</strong><small>{admin ? 'Administrator' : 'Member'}</small></div><ChevronDown size={15} className="account-chevron" /><span className="sr-only">Activity icon</span><Activity className="topbar-spark" size={15} /></div></div>
      </header>
      <div className="workspace-content"><Outlet /></div>
    </main>
  </div>;
}
