import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Check, Clock3, Hash, UserRound } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader.jsx';
import { ErrorNotice, LoadingPage, StatusBadge } from '../components/States.jsx';
import { api, apiMessage, dataOf } from '../services/api.js';

export default function AdminBookingDetailsPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    try { setBooking(dataOf(await api.get(`/admin/bookings/${id}`))?.booking || null); }
    catch (requestError) { setError(apiMessage(requestError, 'Booking details could not be loaded.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);
  async function mark(status) {
    try {
      const response = await api.patch(`/admin/bookings/${id}/status`, { status });
      setBooking(dataOf(response)?.booking);
      toast.success(status === 'completed' ? 'Appointment marked completed.' : 'Appointment marked no-show.');
    } catch (requestError) {
      toast.error(apiMessage(requestError, 'Booking status could not be updated.'));
    }
  }
  if (loading) return <LoadingPage label="Loading booking details" />;
  if (!booking) return <><PageHeader eyebrow="BOOKING DETAILS" title="Booking not found." /><ErrorNotice message={error || 'This booking is not available.'} onRetry={load} /></>;
  const slot = booking.slotId || {};
  const date = slot.date ? new Date(`${slot.date}T00:00:00`) : null;
  return <>
    <Link className="back-link" to="/admin/bookings"><ArrowLeft size={15} /> All bookings</Link>
    <PageHeader eyebrow="ADMINISTRATION · BOOKING DETAILS" title={booking.bookingReference} description="Review the appointment and its member details." action={<StatusBadge status={booking.status} />} />
    {error && <ErrorNotice message={error} onRetry={load} />}
    <div className="details-grid"><section className="surface-panel details-main"><div className="detail-highlight"><div className="detail-date-tile"><span>{date ? format(date, 'MMM') : '—'}</span><strong>{date ? format(date, 'dd') : '—'}</strong></div><div><div className="eyebrow">APPOINTMENT</div><h2>{slot.title || 'Appointment'}</h2><p>{date ? format(date, 'EEEE, MMMM d, yyyy') : 'Date unavailable'}</p></div></div><div className="detail-list"><div><UserRound size={18} /><span>Member</span><strong>{booking.userId?.name || 'Unknown account'}</strong></div><div><CalendarDays size={18} /><span>Date · UTC</span><strong>{slot.date || '—'}</strong></div><div><Clock3 size={18} /><span>Time · UTC</span><strong>{slot.startTime || '—'}–{slot.endTime || '—'} UTC</strong></div><div><Hash size={18} /><span>Reference</span><strong className="reference-code">{booking.bookingReference}</strong></div><div><Check size={18} /><span>Booked</span><strong>{booking.bookedAt ? format(new Date(booking.bookedAt), 'MMM d, yyyy · h:mm a') : '—'}</strong></div>{booking.cancelledAt && <div><Check size={18} /><span>Cancelled</span><strong>{format(new Date(booking.cancelledAt), 'MMM d, yyyy · h:mm a')}</strong></div>}</div></section>
      <aside className="surface-panel details-actions"><div className="eyebrow">BOOKING ACTIONS</div><h3>Update the appointment record.</h3><p>Completed and no-show actions are available after the scheduled end time.</p>{booking.status === 'confirmed' && <div className="admin-booking-actions"><button className="button button-primary button-full" onClick={() => mark('completed')}><Check size={16} />Mark completed</button><button className="button button-outline button-full" onClick={() => mark('no-show')}>Mark no-show</button></div>}<Link className="inline-link" to="/admin/bookings">Back to all bookings</Link></aside></div>
  </>;
}
