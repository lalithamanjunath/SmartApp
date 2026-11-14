import { useEffect, useMemo, useState } from 'react';
import { ArrowRight, CalendarCheck2, CalendarDays, CircleCheck, Clock3, Plus, RefreshCw } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { api, apiMessage, dataOf } from '../services/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { PageHeader, MetricCard } from '../components/PageHeader.jsx';
import { BookingCard } from '../components/BookingCard.jsx';
import { EmptyState, ErrorNotice } from '../components/States.jsx';

export default function UserDashboardPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  async function load() {
    setLoading(true);
    setError('');
    try { setBookings(dataOf(await api.get('/bookings/my'))?.bookings || []); }
    catch (requestError) { setError(apiMessage(requestError, 'Could not load your appointments.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const now = new Date();
  const upcoming = useMemo(() => bookings.filter((booking) => booking.status === 'confirmed' && booking.slotId && new Date(`${booking.slotId.date}T${booking.slotId.startTime}:00Z`) > now).sort((a, b) => `${a.slotId.date}${a.slotId.startTime}`.localeCompare(`${b.slotId.date}${b.slotId.startTime}`)), [bookings]);
  const next = upcoming[0];
  const completed = bookings.filter((booking) => booking.status === 'completed').length;
  const cancelled = bookings.filter((booking) => booking.status === 'cancelled').length;
  return <>
    <PageHeader eyebrow={format(now, 'EEEE, MMMM d')} title={`Good ${now.getHours() < 12 ? 'morning' : now.getHours() < 17 ? 'afternoon' : 'evening'}, ${user?.name?.split(' ')[0] || 'there'}.`} description="Here’s a little more room to focus on your day." action={<Link className="button button-primary" to="/app/book"><Plus size={16} />Book an appointment</Link>} />
    {error && <ErrorNotice message={error} onRetry={load} />}
    <div className="metrics-grid user-metrics"><MetricCard label="All appointments" value={loading ? '—' : bookings.length} note="Since you joined" icon={CalendarDays} tone="indigo" /><MetricCard label="Coming up" value={loading ? '—' : upcoming.length} note={next ? 'Your schedule is looking good' : 'No appointments ahead'} icon={Clock3} tone="green" /><MetricCard label="Completed" value={loading ? '—' : completed} note="A good use of time" icon={CircleCheck} tone="blue" /><MetricCard label="Cancelled" value={loading ? '—' : cancelled} note="Your history, at a glance" icon={CalendarCheck2} tone="amber" /></div>
    <div className="dashboard-columns user-dashboard-columns">
      <section className="surface-panel next-appointment-panel"><div className="section-heading"><div><div className="eyebrow">UP NEXT</div><h2>Your next appointment</h2></div><button className="icon-button" onClick={load} aria-label="Refresh appointments"><RefreshCw size={16} /></button></div>
        {loading ? <div className="loading-line" /> : next ? <div className="next-appointment-card"><div className="next-card-top"><div className="next-card-date"><span>{format(new Date(`${next.slotId.date}T00:00:00`), 'MMM')}</span><strong>{format(new Date(`${next.slotId.date}T00:00:00`), 'dd')}</strong></div><div><span className="eyebrow">{format(new Date(`${next.slotId.date}T00:00:00`), 'EEEE')}</span><h3>{next.slotId.title || 'Appointment'}</h3><p>{format(new Date(`${next.slotId.date}T00:00:00`), 'MMMM d, yyyy')} · {next.slotId.startTime}–{next.slotId.endTime} UTC</p></div></div><div className="next-card-footer"><span><span className="status-dot" />Confirmed · {next.bookingReference}</span><Link to={`/app/appointments/${next._id}`}>View details <ArrowRight size={14} /></Link></div></div> : <EmptyState title="Nothing on the calendar yet" description="A good appointment starts with a time that works for you." action={<Link className="button button-primary button-small" to="/app/book">Find a time <ArrowRight size={15} /></Link>} />}
      </section>
      <section className="surface-panel dashboard-tip"><div className="tip-mark">✳</div><div className="eyebrow">A SMALL REMINDER</div><h2>Leave a little space for the good stuff.</h2><p>Your appointments are kept together here, so the rest of your day can stay yours.</p><Link to="/app/appointments" className="inline-link">See your history <ArrowRight size={15} /></Link></section>
    </div>
    <section className="surface-panel recent-panel"><div className="section-heading"><div><div className="eyebrow">RECENT ACTIVITY</div><h2>A few things in motion</h2></div><Link className="inline-link" to="/app/appointments">All appointments <ArrowRight size={15} /></Link></div>
      {loading ? <div className="loading-line" /> : bookings.length ? <div className="booking-list">{bookings.slice(0, 3).map((booking) => <BookingCard key={booking._id} booking={booking} to={`/app/appointments/${booking._id}`} compact />)}</div> : <EmptyState title="Your activity will show up here" description="Once you book an appointment, you’ll find the details right here." />}
    </section>
  </>;
}
