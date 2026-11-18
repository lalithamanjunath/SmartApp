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
  const [rescheduleOpen, setRescheduleOpen] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState(() => new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 10));
  const [availableSlots, setAvailableSlots] = useState([]);
  const [availabilityRefresh, setAvailabilityRefresh] = useState(0);
  const [selectedSlotId, setSelectedSlotId] = useState('');
  const [slotsLoading, setSlotsLoading] = useState(false);
  const [rescheduling, setRescheduling] = useState(false);
  const [rescheduleError, setRescheduleError] = useState('');
  async function load() {
    setLoading(true);
    setError('');
    try { setBooking(dataOf(await api.get(`/bookings/${id}`))?.booking || null); }
    catch (requestError) { setError(apiMessage(requestError, 'Appointment details could not be loaded.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, [id]);
  useEffect(() => {
    if (!rescheduleOpen || !rescheduleDate) return undefined;
    const controller = new AbortController();
    setSlotsLoading(true);
    setAvailableSlots([]);
    setSelectedSlotId('');
    api.get('/slots', { params: { from: rescheduleDate, to: rescheduleDate }, signal: controller.signal })
      .then((response) => setAvailableSlots(dataOf(response)?.slots || []))
      .catch((requestError) => {
        if (!controller.signal.aborted) setRescheduleError(apiMessage(requestError, 'Available times could not be loaded.'));
      })
      .finally(() => { if (!controller.signal.aborted) setSlotsLoading(false); });
    return () => controller.abort();
  }, [rescheduleOpen, rescheduleDate, availabilityRefresh]);
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
  async function submitReschedule() {
    if (!selectedSlotId) return;
    setRescheduling(true);
    setRescheduleError('');
    try {
      const idempotencyKey = globalThis.crypto?.randomUUID?.() || `reschedule-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const response = await api.patch(`/bookings/${id}/reschedule`, { slotId: selectedSlotId, idempotencyKey });
      setBooking(dataOf(response)?.booking || booking);
      setRescheduleOpen(false);
      toast.success('Appointment rescheduled.');
    } catch (requestError) {
      const message = apiMessage(requestError, 'This appointment could not be rescheduled.');
      setRescheduleError(message);
      setSelectedSlotId('');
      setAvailabilityRefresh((refresh) => refresh + 1);
      toast.error(message);
    } finally {
      setRescheduling(false);
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
    <div className="details-grid"><section className="surface-panel details-main"><div className="detail-highlight"><div className="detail-date-tile"><span>{date ? format(date, 'MMM') : '—'}</span><strong>{date ? format(date, 'dd') : '—'}</strong></div><div><div className="eyebrow">YOUR APPOINTMENT</div><h2>{slot.title || 'Appointment'}</h2><p>{date ? format(date, 'EEEE, MMMM d, yyyy') : 'Date unavailable'}</p></div></div><div className="detail-list"><div><CalendarDays size={18} /><span>Date</span><strong>{date ? format(date, 'EEEE, MMMM d, yyyy') : '—'}</strong></div><div><Clock3 size={18} /><span>Time · UTC</span><strong>{slot.startTime || '—'}–{slot.endTime || '—'} UTC</strong></div><div><Hash size={18} /><span>Booking reference</span><strong className="reference-code">{booking.bookingReference}</strong></div><div><MapPin size={18} /><span>Location</span><strong>Details provided by your host</strong></div>{booking.cancelledAt && <div><Clock3 size={18} /><span>Cancelled</span><strong>{format(new Date(booking.cancelledAt), 'MMM d, yyyy · h:mm a')}</strong></div>}</div>
      {booking.rescheduleHistory?.length > 0 && <div className="mt-6 rounded-xl bg-slate-50 p-4"><h3 className="text-sm font-semibold text-slate-800">Previous appointment times</h3><ul className="mt-2 space-y-2">{[...booking.rescheduleHistory].reverse().map((entry) => <li key={`${entry.slotId}-${entry.rescheduledAt}`} className="text-sm text-slate-600">{entry.date} · {entry.startTime}–{entry.endTime} UTC <span className="text-xs text-slate-400">(rescheduled {format(new Date(entry.rescheduledAt), 'MMM d, yyyy')})</span></li>)}</ul></div>}
      <div className="secure-note"><ShieldCheck size={16} /><span>Your booking is private to your account.</span></div></section><aside className="surface-panel details-actions"><div className="eyebrow">NEED TO MAKE A CHANGE?</div><h3>Plans shift. That’s okay.</h3><p>Choose another available time up to 24 hours before the appointment. The change is confirmed only when the new slot is secured.</p>{booking.status === 'confirmed' && <>
        <button className="button button-outline button-full" type="button" onClick={() => { setRescheduleError(''); setRescheduleOpen((open) => !open); }}>{rescheduleOpen ? 'Close rescheduling' : 'Reschedule appointment'}</button>
        <button className="button button-outline-danger button-full" onClick={cancel}>Cancel appointment</button>
      </>}
      {rescheduleOpen && booking.status === 'confirmed' && <div className="mt-5 space-y-3">
        <label className="block text-sm font-medium text-slate-700">New date · UTC<input className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" type="date" min={new Date().toISOString().slice(0, 10)} value={rescheduleDate} onChange={(event) => { setRescheduleError(''); setRescheduleDate(event.target.value); }} /></label>
        {rescheduleError && <p className="text-sm text-red-600" role="alert">{rescheduleError}</p>}
        {slotsLoading ? <div className="loading-line" /> : availableSlots.length ? <label className="block text-sm font-medium text-slate-700">Available time<select className="mt-1 block w-full rounded-lg border border-slate-200 px-3 py-2" value={selectedSlotId} onChange={(event) => setSelectedSlotId(event.target.value)}><option value="">Choose a time</option>{availableSlots.map((available) => <option key={available._id} value={available._id}>{available.startTime}–{available.endTime} UTC</option>)}</select></label> : <p className="text-sm text-slate-500">No available times on this date.</p>}
        <button className="button button-primary button-full" type="button" onClick={submitReschedule} disabled={!selectedSlotId || rescheduling || slotsLoading}>{rescheduling ? 'Rescheduling…' : 'Confirm new time'}</button>
      </div>}
      <Link className="inline-link" to="/app/appointments">Back to your appointments</Link></aside></div>
  </>;
}
