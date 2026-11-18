import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Activity, CalendarCheck2, CalendarDays, CheckCircle2, CircleX, Clock3, Users, RefreshCw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { PageHeader, MetricCard } from '../components/PageHeader.jsx';
import { StatusBadge, ErrorNotice } from '../components/States.jsx';
import { api, apiMessage, dataOf } from '../services/api.js';

const AdminDashboardCharts = lazy(() => import('../components/AdminDashboardCharts.jsx'));

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [chartsVisible, setChartsVisible] = useState(false);
  const chartsRef = useRef(null);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const summary = await api.get('/admin/dashboard');
      setDashboard(dataOf(summary));
    } catch (requestError) {
      setError(apiMessage(requestError, 'Admin dashboard data could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  const stats = dashboard?.stats || {};
  const daily = dashboard?.daily || [];
  const weekly = dashboard?.weekly || [];

  useEffect(() => {
    if (!chartsRef.current) return undefined;
    if (!('IntersectionObserver' in window)) {
      setChartsVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) {
        setChartsVisible(true);
        observer.disconnect();
      }
    }, { rootMargin: '200px' });
    observer.observe(chartsRef.current);
    return () => observer.disconnect();
  }, []);

  return <>
    <PageHeader
      eyebrow={format(new Date(), 'EEEE, MMMM d')}
      title="A clear view of your team."
      description="Your schedule, capacity and recent bookings—all in one place."
      action={<button type="button" className="icon-button" aria-label="Refresh dashboard" onClick={load}><RefreshCw size={16} /></button>}
    />
    {error && <ErrorNotice message={error} onRetry={load} />}
    <div className="metrics-grid admin-metrics">
      <MetricCard label="Registered users" value={loading ? '—' : stats.totalUsers} note="Member accounts" icon={Users} tone="indigo" />
      <MetricCard label="Appointment slots" value={loading ? '—' : stats.totalSlots} note={`${stats.availableSlots ?? '—'} available to book`} icon={CalendarDays} tone="blue" />
      <MetricCard label="Booked slots" value={loading ? '—' : stats.bookedSlots} note="Current schedule capacity" icon={Clock3} tone="green" />
      <MetricCard label="Total bookings" value={loading ? '—' : stats.totalBookings} note={`${stats.cancelledBookings ?? '—'} cancelled`} icon={CalendarCheck2} tone="amber" />
    </div>

    <div ref={chartsRef} className="min-h-[700px]">
      <Suspense fallback={<div className="chart-empty">Loading dashboard charts…</div>}>
        {chartsVisible && <AdminDashboardCharts daily={daily} weekly={weekly} stats={stats} loading={loading} />}
      </Suspense>
    </div>

    <section className="surface-panel recent-panel"><div className="section-heading"><div><div className="eyebrow">LATEST ACTIVITY</div><h2>Recently booked</h2></div><Link className="inline-link" to="/admin/bookings">All bookings <ArrowRight size={15} /></Link></div>
      {loading ? <div className="loading-line" /> : dashboard?.recentBookings?.length ? <div className="admin-recent-list">{dashboard.recentBookings.map((booking) => <Link className="admin-recent-row" key={booking._id} to={`/admin/bookings/${booking._id}`}><div className="avatar avatar-small">{booking.userId?.name?.slice(0, 1)?.toUpperCase() || 'U'}</div><div className="admin-recent-person"><strong>{booking.userId?.name || 'Account'}</strong><small>{booking.userId?.email || 'Email unavailable'}</small></div><div className="admin-recent-time"><strong>{booking.slotId?.date || 'Date pending'}</strong><small>{booking.slotId?.startTime || '—'} · {booking.bookingReference}</small></div><StatusBadge status={booking.status} /><ArrowRight size={15} className="recent-arrow" /></Link>)}</div> : <div className="chart-empty">No bookings to show yet. New activity will appear here.</div>}
    </section>
    <div className="admin-bottom-summary"><div><CheckCircle2 size={17} /><span>{stats.completedAppointments ?? 0} completed appointments</span></div><div><CircleX size={17} /><span>{stats.cancelledBookings ?? 0} cancelled bookings</span></div><Link to="/admin/bookings">Review booking activity <Activity size={14} /></Link></div>
  </>;
}
