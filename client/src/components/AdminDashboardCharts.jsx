import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function AdminDashboardCharts({ daily, weekly, stats, loading }) {
  return <>
    <div className="dashboard-columns admin-chart-columns">
      <section className="surface-panel chart-panel">
        <div className="section-heading"><div><div className="eyebrow">BOOKING ACTIVITY</div><h2>Daily appointments</h2></div><span className="chart-period">Last 7 days</span></div>
        <div className="chart-wrap">{daily.length ? <ResponsiveContainer width="100%" height={260}><LineChart data={daily} margin={{ top: 8, right: 10, left: -20, bottom: 0 }}><CartesianGrid stroke="#edf0f5" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#8790a2', fontSize: 12 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8790a2', fontSize: 11 }} /><Tooltip /><Line type="monotone" dataKey="bookings" name="Bookings" stroke="#4f46e5" strokeWidth={2.5} dot={{ r: 3, fill: '#4f46e5' }} activeDot={{ r: 5 }} /><Line type="monotone" dataKey="cancelled" name="Cancelled" stroke="#b9d845" strokeWidth={2.5} dot={{ r: 3, fill: '#b9d845' }} /></LineChart></ResponsiveContainer> : <div className="chart-empty">Daily activity will appear once appointments are booked.</div>}</div>
        <div className="chart-legend"><span><i className="chart-indigo" />Bookings</span><span><i className="chart-lime" />Cancelled</span></div>
      </section>
      <aside className="surface-panel capacity-panel"><div className="eyebrow">SLOT AVAILABILITY</div><h2>Keep the right<br />times open.</h2><p>Make it easy to find a time that fits and give your team a clear view of the week.</p><div className="capacity-counts"><div><span>Available</span><strong>{loading ? '—' : stats.availableSlots ?? 0}</strong></div><div><span>Booked</span><strong>{loading ? '—' : stats.bookedSlots ?? 0}</strong></div></div><Link to="/admin/slots" className="inline-link">Manage appointment slots <ArrowRight size={15} /></Link><span className="capacity-deco">✳</span></aside>
    </div>
    <section className="surface-panel chart-panel weekly-chart-panel"><div className="section-heading"><div><div className="eyebrow">WEEKLY OVERVIEW</div><h2>Appointments by week</h2></div><span className="chart-period">Last 8 weeks</span></div><div className="chart-wrap">{weekly.length ? <ResponsiveContainer width="100%" height={235}><BarChart data={weekly} margin={{ top: 8, right: 12, left: -20, bottom: 0 }}><CartesianGrid stroke="#edf0f5" strokeDasharray="3 3" vertical={false} /><XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fill: '#8790a2', fontSize: 10 }} /><YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: '#8790a2', fontSize: 11 }} /><Tooltip /><Bar dataKey="bookings" name="Bookings" fill="#4f46e5" radius={[5, 5, 0, 0]} /><Bar dataKey="cancelled" name="Cancelled" fill="#d5f36a" radius={[5, 5, 0, 0]} /></BarChart></ResponsiveContainer> : <div className="chart-empty">Weekly activity will appear once appointments are booked.</div>}</div></section>
  </>;
}
