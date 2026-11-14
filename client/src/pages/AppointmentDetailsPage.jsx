import { useEffect, useState } from 'react';
import { ArrowLeft, CalendarDays, Clock3, Hash, MapPin, ShieldCheck } from 'lucide-react';
import { Link, useParams } from 'react-router-dom';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader.jsx';
import { StatusBadge, ErrorNotice, LoadingPage } from '../components/States.jsx';
import { api, apiMessage, dataOf } from '../services/api.js';

export default function AppointmentDetailsPage() {
  const { id } = useParams();
  const [booking, setBooking] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    try { setBooking(dataOf(await api.get(`/bookings/${id}`))?.booking || null); }
    catch (requestError) { setError(apiMessage(requestError, 'Appointment details could not be loaded.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);
  async function cancel() {
    if (!window.confirm('Cancel this appointment? The time may be released back to availability.')) return;
    try {
      const response = await api.patch(`/bookings/${id}/cancel`);
      setBooking(dataOf(response)?.booking || booking);
      toast.success('Appointment cancelled.');
    } catch (requestError) {
      toast.error(apiMessage(requestError, 'This appointment could not be cancelled.'));
    }
  }
  if (loading) return <LoadingPage label="Loading appointment details" />;
  if (!booking) return <><PageHeader eyebrow="APPOINTMENT DETAILS" title="We couldn’t find that appointment." /><ErrorNotice message={error || 'This appointment may have been removed or is not available to your account.'} onRetry={load} /><Link className="inline-link" to="/app/appointments"><ArrowLeft size={15} /> Back to appointments</Link></>;
  const slot = booking.slotId || {};
  const date = slot.date ? new Date(`${slot.date}T00:00:00`) : null;
  return <>
    <Link className="back-link" to="/app/appointments"><ArrowLeft size={15} /> All appointments</Link>
    <PageHeader eyebrow="APPOINTMENT DETAILS" title="A time set aside for you." description="Here are the details of your booking." action={<StatusBadge status={booking.status} />} />
    {error && <ErrorNotice message={error} onRetry={load} />}
    <div className="details-grid"><section className="surface-panel details-main"><div className="detail-highlight"><div className="detail-date-tile"><span>{date ? format(date, 'MMM') : '—'}</span><strong>{date ? format(date, 'dd') : '—'}</strong></div><div><div className="eyebrow">YOUR APPOINTMENT</div><h2>{slot.title || 'Appointment'}</h2><p>{date ? format(date, 'EEEE, MMMM d, yyyy') : 'Date unavailable'}</p></div></div><div className="detail-list"><div><CalendarDays size={18} /><span>Date</span><strong>{date ? format(date, 'EEEE, MMMM d, yyyy') : '—'}</strong></div><div><Clock3 size={18} /><span>Time · UTC</span><strong>{slot.startTime || '—'}–{slot.endTime || '—'} UTC</strong></div><div><Hash size={18} /><span>Booking reference</span><strong className="reference-code">{booking.bookingReference}</strong></div><div><MapPin size={18} /><span>Location</span><strong>Details provided by your host</strong></div>{booking.cancelledAt && <div><Clock3 size={18} /><span>Cancelled</span><strong>{format(new Date(booking.cancelledAt), 'MMM d, yyyy · h:mm a')}</strong></div>}</div><div className="secure-note"><ShieldCheck size={16} /><span>Your booking is private to your account.</span></div></section><aside className="surface-panel details-actions"><div className="eyebrow">NEED TO MAKE A CHANGE?</div><h3>Plans shift. That’s okay.</h3><p>If this appointment is eligible for cancellation, we’ll release the time so it can be booked again.</p>{booking.status === 'confirmed' && <button className="button button-outline-danger button-full" onClick={cancel}>Cancel appointment</button>}<Link className="inline-link" to="/app/appointments">Back to your appointments</Link></aside></div>
  </>;
}
