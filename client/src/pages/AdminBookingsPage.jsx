import { useEffect, useState } from 'react';
import { ArrowRight, CalendarDays, Search, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { PageHeader } from '../components/PageHeader.jsx';
import { ErrorNotice, EmptyState, StatusBadge } from '../components/States.jsx';
import { api, apiMessage, dataOf } from '../services/api.js';

const statuses = ['', 'confirmed', 'cancelled', 'completed', 'no-show'];

export default function AdminBookingsPage() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [date, setDate] = useState('');
  const [status, setStatus] = useState('');

  async function load(filters = { q, date, status }) {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams();
      if (filters.q.trim()) params.set('q', filters.q.trim());
      if (filters.date) params.set('date', filters.date);
      if (filters.status) params.set('status', filters.status);
      setBookings(dataOf(await api.get(`/admin/bookings?${params.toString()}`))?.bookings || []);
    } catch (requestError) {
      setError(apiMessage(requestError, 'Bookings could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [status, date]);
  function clear() {
    setQ('');
    setDate('');
    setStatus('');
    load({ q: '', date: '', status: '' });
  }

  return <>
    <PageHeader eyebrow="ADMINISTRATION · BOOKINGS" title="Every booking, in view." description="Search references, filter by day and status, and open the details when you need them." />
    {error && <ErrorNotice message={error} onRetry={load} />}
    <section className="surface-panel management-panel"><div className="table-toolbar"><div><div className="eyebrow">BOOKING RECORDS</div><h2>{loading ? 'Loading bookings…' : `${bookings.length} booking${bookings.length === 1 ? '' : 's'}`}</h2></div><div className="filter-row"><label className="search-field"><Search size={16} /><input aria-label="Search booking reference" placeholder="Search reference" value={q} onChange={(event) => setQ(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()} /></label><label className="filter-select-label filter-date"><CalendarDays size={15} /><input type="date" aria-label="Filter bookings by date" value={date} onChange={(event) => setDate(event.target.value)} /></label><label className="filter-select-label"><span className="sr-only">Status</span><select aria-label="Filter bookings by status" value={status} onChange={(event) => setStatus(event.target.value)}>{statuses.map((item) => <option key={item || 'all'} value={item}>{item ? item === 'no-show' ? 'No-show' : item[0].toUpperCase() + item.slice(1) : 'All statuses'}</option>)}</select></label><button className="button button-outline button-small" onClick={() => load()}>Search</button><button className="icon-button icon-button-small" aria-label="Clear filters" onClick={clear}><X size={15} /></button></div></div>
      {loading ? <div className="loading-line" /> : bookings.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Reference</th><th>Member</th><th>Appointment</th><th>Status</th><th><span className="sr-only">View</span></th></tr></thead><tbody>{bookings.map((booking) => <tr key={booking._id}><td><span className="reference-code">{booking.bookingReference}</span></td><td><div className="member-cell"><strong>{booking.userId?.name || 'Account'}</strong><small>{booking.userId?.email || 'Email unavailable'}</small></div></td><td><div className="member-cell"><strong>{booking.slotId?.date ? format(new Date(`${booking.slotId.date}T00:00:00`), 'EEE, MMM d, yyyy') : 'Date unavailable'}</strong><small>{booking.slotId?.startTime || '—'}–{booking.slotId?.endTime || '—'}</small></div></td><td><StatusBadge status={booking.status} /></td><td><Link className="icon-link" to={`/admin/bookings/${booking._id}`} aria-label={`Open booking ${booking.bookingReference}`}><ArrowRight size={16} /></Link></td></tr>)}</tbody></table></div> : <EmptyState title="No bookings match those filters" description="Try another reference, day or status." icon={CalendarDays} />}</section>
  </>;
}
