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
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, limit: 20, total: 0, pages: 0 });
  async function load(nextPage = 1, category = active) {
    setLoading(true); setError('');
    const status = category === 'upcoming' ? 'confirmed' : category === 'completed' ? 'completed' : 'cancelled';
    try {
      const result = dataOf(await api.get('/bookings/my', { params: { status, page: nextPage, limit: pagination.limit } }));
      setBookings(result?.bookings || []);
      setPagination(result?.pagination || { page: nextPage, limit: pagination.limit, total: 0, pages: 0 });
      setPage(nextPage);
    }
    catch (requestError) { setError(apiMessage(requestError, 'Your appointments could not be loaded.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(1, 'upcoming'); }, []);
  const filtered = useMemo(() => bookings.filter((booking) => active === 'upcoming' ? booking.status === 'confirmed' : active === 'completed' ? ['completed', 'no-show'].includes(booking.status) : booking.status === 'cancelled'), [bookings, active]);
  async function cancelBooking(booking) {
    if (!window.confirm(`Cancel appointment ${booking.bookingReference}? The slot may become available to someone else.`)) return;
    try {
      await api.patch(`/bookings/${booking._id}/cancel`);
      toast.success('Appointment cancelled.'); load(page, active);
    } catch (requestError) { toast.error(apiMessage(requestError, 'This appointment could not be cancelled.')); }
  }
  const EmptyIcon = tabs.find((tab) => tab.id === active)?.icon || CalendarDays;
  return <>
    <PageHeader eyebrow="YOUR APPOINTMENTS" title="Your time, all together." description="A clear view of what’s coming up and what’s already happened." action={<button className="icon-button" onClick={() => load(page, active)} aria-label="Refresh appointments"><RefreshCw size={17} /></button>} />
    {error && <ErrorNotice message={error} onRetry={load} />}
    <section className="surface-panel appointments-panel">
      <div className="tab-list" role="tablist" aria-label="Appointment categories">{tabs.map(({ id, label, icon: Icon }) => <button role="tab" aria-selected={active === id} className={active === id ? 'tab-button tab-active' : 'tab-button'} key={id} onClick={() => { setActive(id); load(1, id); }}><Icon size={16}/>{label}{active === id && <span>{pagination.total}</span>}</button>)}</div>
      {loading ? <div className="loading-line" /> : filtered.length ? <div className="booking-list">{filtered.map((booking) => <BookingCard key={booking._id} booking={booking} to={`/app/appointments/${booking._id}`} onCancel={active === 'upcoming' ? cancelBooking : undefined} />)}</div> : <EmptyState title={active === 'upcoming' ? 'A little breathing room' : `No ${active} appointments`} description={active === 'upcoming' ? 'When you book a time, you’ll find it here.' : 'This list will fill in as your schedule moves along.'} icon={EmptyIcon} action={active === 'upcoming' ? <Link className="button button-primary button-small" to="/app/book">Find a time</Link> : null} />}
      {!loading && pagination.pages > 1 && <div className="mt-5 flex items-center justify-between"><button className="button button-outline" disabled={page <= 1} onClick={() => load(page - 1, active)}>Previous</button><span className="text-sm text-slate-500">Page {page} of {pagination.pages}</span><button className="button button-outline" disabled={page >= pagination.pages} onClick={() => load(page + 1, active)}>Next</button></div>}
    </section>
  </>;
}
