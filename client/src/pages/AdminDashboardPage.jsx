import { useEffect, useState } from 'react';
import { Activity, CalendarCheck2, CalendarDays, CheckCircle2, CircleX, Clock3, Users, RefreshCw, ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { PageHeader, MetricCard } from '../components/PageHeader.jsx';
import { StatusBadge, ErrorNotice } from '../components/States.jsx';
import { api, apiMessage, dataOf } from '../services/api.js';

export default function AdminDashboardPage() {
  const [dashboard, setDashboard] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    setError('');
    try {
      const [summary, trends] = await Promise.all([api.get('/admin/dashboard'), api.get('/admin/analytics')]);
      setDashboard(dataOf(summary));
      setAnalytics(dataOf(trends));
    } catch (requestError) {
      setError(apiMessage(requestError, 'Admin dashboard data could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  const stats = dashboard?.stats || {};
  const daily = analytics?.daily?.slice(-7) || [];
  const weekly = analytics?.weekly || [];

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

    <div className="dashboard-columns admin-chart-columns">
      <section className="surface-panel chart-panel">
        <div className="section-heading"><div><div className="eyebrow">BOOKING ACTIVITY</div><h2>Daily appointments</h2></div><span className="chart-period">Last 7 days</span></div>
        <div className="chart-wrap">{daily.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={daily} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}><CartesianGrid stroke="#edf0f5" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#8790a2', fontSize: 12 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8790a2', fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="bookings" name="Bookings" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3, fill: '#4f46e5' }} activeDot={{ r: 5 }} /><Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="#b9d845" strokeWidth={2.5} dot={{ r: 3, fill: '#b9d845' }} /></LineChart></ResponsiveContainer> : <div className="chart-empty">Daily activity will appear once appointments are booked.</div>}</div>
        <div className="chart-legend"><span><i className="chart-indigo" />Bookings</span><span><i className="chart-lime" />Cancelled</span></div>
      </section>
      <aside className="surface-panel capacity-panel"><div className="eyebrow">SLOT AVAILABILITY</div><h2>Keep the right<br />times open.</h2><p>Make it easy to find a time that fits and give your team a clear view of the week.</p><div className="capacity-counts"><div><span>Available</span><strong>{loading ? '—' : stats.availableSlots ?? 0}</strong></div><div><span>Booked</span><strong>{loading ? '—' : stats.bookedSlots ?? 0}</strong></div></div><Link to="/admin/slots" className="inline-link">Manage appointment slots <ArrowRight size={15} /></Link><span className="capacity-deco">✳</span></aside>
    </div>

    <section className="surface-panel chart-panel weekly-chart-panel"><div className="section-heading"><div><div className="eyebrow">WEEKLY OVERVIEW</div><h2>Appointments by week</h2></div><span className="chart-period">Last 8 weeks</span></div><div className="chart-wrap">{weekly.length ? <ResponsiveContainer width="100%" height={235}><BarChart data={weekly} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}><CartesianGrid stroke="#edf0f5" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#8790a2', fontSize: 10 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8790a2', fontSize: 11 }} /><Tooltip /><Bar dataKey="bookings" name="Bookings" fill="#4f46e5" radius={[5, 5, 0, 0]} /><Bar dataKey="cancelled" name="Cancelled" fill="#d5f36a" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="chart-empty">Weekly activity will appear once appointments are booked.</div>}</div></section>

    <section className="surface-panel recent-panel"><div className="section-heading"><div><div className="eyebrow">LATEST ACTIVITY</div><h2>Recently booked</h2></div><Link className="inline-link" to="/admin/bookings">All bookings <ArrowRight size={15} /></Link></div>
      {loading ? <div className="loading-line" /> : dashboard?.recentBookings?.length ? <div className="admin-recent-list">{dashboard.recentBookings.map((booking) => <Link className="admin-recent-row" key={booking._id} to={`/admin/bookings/${booking._id}`}><div className="avatar avatar-small">{booking.userId?.name?.slice(0, 1)?.toUpperCase() || 'U'}</div><div className="admin-recent-person"><strong>{booking.userId?.name || 'Account'}</strong><small>{booking.userId?.email || 'Email unavailable'}</small></div><div className="admin-recent-time"><strong>{booking.slotId?.date || 'Date pending'}</strong><small>{booking.slotId?.startTime || '—'} · {booking.bookingReference}</small></div><StatusBadge status={booking.status} /><ArrowRight size={15} className="recent-arrow" /></Link>)}</div> : <div className="chart-empty">No bookings to show yet. New activity will appear here.</div>}
    </section>
    <div className="admin-bottom-summary"><div><CheckCircle2 size={17} /><span>{stats.completedAppointments ?? 0} completed appointments</span></div><div><CircleX size={17} /><span>{stats.cancelledBookings ?? 0} cancelled bookings</span></div><Link to="/admin/bookings">Review booking activity <Activity size={14} /></Link></div>
  </>;
}
