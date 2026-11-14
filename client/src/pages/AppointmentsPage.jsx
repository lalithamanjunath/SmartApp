import { useEffect, useMemo, useState } from 'react';
import { CalendarDays, CheckCircle2, Clock3, RefreshCw, XCircle } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader.jsx';
import { BookingCard } from '../components/BookingCard.jsx';
import { EmptyState, ErrorNotice } from '../components/States.jsx';
import { api, apiMessage, dataOf } from '../services/api.js';

const tabs = [
  { id: 'upcoming', label: 'Upcoming', icon: Clock3 },
  { id: 'completed', label: 'Completed', icon: CheckCircle2 },
  { id: 'cancelled', label: 'Cancelled', icon: XCircle },
];

export default function AppointmentsPage() {
  const [bookings, setBookings] = useState([]);
  const [active, setActive] = useState('upcoming');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { setBookings(dataOf(await api.get('/bookings/my'))?.bookings || []); }
    catch (requestError) { setError(apiMessage(requestError, 'Your appointments could not be loaded.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  const filtered = useMemo(() => bookings.filter((booking) => active === 'upcoming' ? booking.status === 'confirmed' : active === 'completed' ? ['completed', 'no-show'].includes(booking.status) : booking.status === 'cancelled'), [bookings, active]);
  async function cancelBooking(booking) {
    if (!window.confirm(`Cancel appointment ${booking.bookingReference}? The slot may become available to someone else.`)) return;
    try {
      await api.patch(`/bookings/${booking._id}/cancel`);
      toast.success('Appointment cancelled.'); load();
    } catch (requestError) { toast.error(apiMessage(requestError, 'This appointment could not be cancelled.')); }
  }
  const EmptyIcon = tabs.find((tab) => tab.id === active)?.icon || CalendarDays;
  return <>
    <PageHeader eyebrow="YOUR APPOINTMENTS" title="Your time, all together." description="A clear view of what’s coming up and what’s already happened." action={<button className="icon-button" onClick={load} aria-label="Refresh appointments"><RefreshCw size={17} /></button>} />
    {error && <ErrorNotice message={error} onRetry={load} />}
    <section className="surface-panel appointments-panel">
      <div className="tab-list" role="tablist" aria-label="Appointment categories">{tabs.map(({ id, label, icon: Icon }) => <button role="tab" aria-selected={active === id} className={active === id ? 'tab-button tab-active' : 'tab-button'} key={id} onClick={() => setActive(id)}><Icon size={16}/>{label}<span>{bookings.filter((booking) => id === 'upcoming' ? booking.status === 'confirmed' : id === 'completed' ? ['completed', 'no-show'].includes(booking.status) : booking.status === 'cancelled').length}</span></button>)}</div>
      {loading ? <div className="loading-line" /> : filtered.length ? <div className="booking-list">{filtered.map((booking) => <BookingCard key={booking._id} booking={booking} to={`/app/appointments/${booking._id}`} onCancel={active === 'upcoming' ? cancelBooking : undefined} />)}</div> : <EmptyState title={active === 'upcoming' ? 'A little breathing room' : `No ${active} appointments`} description={active === 'upcoming' ? 'When you book a time, you’ll find it here.' : 'This list will fill in as your schedule moves along.'} icon={EmptyIcon} action={active === 'upcoming' ? <Link className="button button-primary button-small" to="/app/book">Find a time</Link> : null} />}
    </section>
  </>;
}
