import { useEffect, useMemo, useState } from 'react';
import { addDays, eachDayOfInterval, endOfMonth, endOfWeek, format, isBefore, isSameMonth, startOfMonth, startOfWeek, subMonths, addMonths } from 'date-fns';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, LoaderCircle, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader.jsx';
import { EmptyState, ErrorNotice } from '../components/States.jsx';
import { api, apiMessage, dataOf } from '../services/api.js';
import { useNavigate } from 'react-router-dom';

function utcTodayAsCalendarDate() {
  return new Date(`${new Date().toISOString().slice(0, 10)}T00:00:00`);
}

export default function BookingPage() {
  const navigate = useNavigate();
  const [month, setMonth] = useState(() => startOfMonth(utcTodayAsCalendarDate()));
  const [selectedDate, setSelectedDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [selectedSlot, setSelectedSlot] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const first = startOfMonth(month);
  const last = endOfMonth(month);
  const calendarStart = startOfWeek(first, { weekStartsOn: 1 });
  const calendarEnd = endOfWeek(last, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: calendarStart, end: calendarEnd });
  const today = utcTodayAsCalendarDate();

  async function loadSlots() {
    setLoading(true);
    setError('');
    setSelectedSlot(null);
    try {
      const from = format(isBefore(first, today) ? today : first, 'yyyy-MM-dd');
      const response = await api.get(`/slots?from=${from}&to=${format(last, 'yyyy-MM-dd')}`);
      setSlots(dataOf(response)?.slots || []);
    } catch (requestError) {
      setError(apiMessage(requestError, 'Available times could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadSlots(); }, [month]);
  const daySlots = useMemo(() => slots.filter((slot) => slot.date === selectedDate).sort((a, b) => a.startTime.localeCompare(b.startTime)), [slots, selectedDate]);

  function chooseMonth(nextMonth) {
    if (nextMonth < startOfMonth(today)) return;
    setMonth(startOfMonth(nextMonth));
    setSelectedDate(format(nextMonth < today ? today : startOfMonth(nextMonth), 'yyyy-MM-dd'));
  }

  async function confirmBooking() {
    if (!selectedSlot) return;
    setBusy(true);
    try {
      const key = globalThis.crypto?.randomUUID?.() || `booking-${Date.now()}-${Math.random().toString(16).slice(2)}`;
      const response = await api.post('/bookings', { slotId: selectedSlot._id, idempotencyKey: key });
      const booking = dataOf(response)?.booking;
      toast.success(`Booked. Your reference is ${booking?.bookingReference || 'ready'}.`);
      navigate(`/app/appointments/${booking?._id}`);
    } catch (requestError) {
      const message = apiMessage(requestError, 'That time could not be booked. Choose another slot.');
      toast.error(message);
      setError(message);
      loadSlots();
    } finally {
      setBusy(false);
    }
  }

  return <>
    <PageHeader eyebrow="MAKE A LITTLE ROOM" title="Find a time that works." description="Choose a UTC date, then pick from the appointment times that are really available." />
    {error && <ErrorNotice message={error} onRetry={loadSlots} />}
    <div className="booking-flow">
      <section className="surface-panel calendar-panel">
        <div className="booking-step-head"><span className="step-number">01</span><div><div className="eyebrow">YOUR CALENDAR · UTC</div><h2>Choose a day</h2></div></div>
        <div className="calendar-head"><button className="icon-button" type="button" aria-label="Previous month" disabled={startOfMonth(month) <= startOfMonth(today)} onClick={() => chooseMonth(subMonths(month, 1))}><ArrowLeft size={17} /></button><h3>{format(month, 'MMMM yyyy')}</h3><button className="icon-button" type="button" aria-label="Next month" onClick={() => chooseMonth(addMonths(month, 1))}><ArrowRight size={17} /></button></div>
        <div className="calendar-grid calendar-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div>
        <div className="calendar-grid calendar-days">{days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const hasTimes = slots.some((slot) => slot.date === key);
          const active = selectedDate === key;
          const disabled = !isSameMonth(day, month) || isBefore(day, today) || !hasTimes;
          return <button type="button" key={key} className={`calendar-day ${active ? 'calendar-day-active' : ''} ${hasTimes ? 'calendar-day-available' : ''}`} disabled={disabled || loading} aria-pressed={active} aria-label={`${format(day, 'EEEE, MMMM d')}${hasTimes ? ', available' : ', unavailable'} UTC`} onClick={() => { setSelectedDate(key); setSelectedSlot(null); }}><span>{format(day, 'd')}</span>{hasTimes && <i />}</button>;
        })}</div>
        <div className="calendar-legend"><span><i className="legend-available" />Available</span><span><i className="legend-selected" />Selected</span></div>
      </section>

      <section className="surface-panel time-panel">
        <div className="booking-step-head"><span className="step-number">02</span><div><div className="eyebrow">APPOINTMENT TIMES · UTC</div><h2>{selectedDate ? format(new Date(`${selectedDate}T00:00:00`), 'EEEE, MMMM d') : 'Choose a day'}</h2></div></div>
        {loading ? <div className="loading-line" /> : daySlots.length ? <div className="time-grid">{daySlots.map((slot) => <button type="button" key={slot._id} className={`time-slot ${selectedSlot?._id === slot._id ? 'time-slot-selected' : ''}`} onClick={() => setSelectedSlot(slot)} aria-pressed={selectedSlot?._id === slot._id}><Clock3 size={15} />{slot.startTime}<span>– {slot.endTime}</span>{selectedSlot?._id === slot._id && <Check size={15} />}</button>)}</div> : <EmptyState title="No open times on this date" description="Choose a day marked with a dot, or look at another month." icon={CalendarDays} />}
        <div className="secure-note"><ShieldCheck size={16} /><span>Only open UTC times appear here. We confirm availability again before booking.</span></div>
      </section>

      <aside className={`surface-panel review-panel ${selectedSlot ? 'review-ready' : ''}`}>
        <div className="booking-step-head"><span className="step-number">03</span><div><div className="eyebrow">BEFORE YOU BOOK</div><h2>Review your time</h2></div></div>
        {selectedSlot ? <><div className="review-date"><span className="review-calendar-icon"><CalendarDays size={20} /></span><div><small>APPOINTMENT DATE · UTC</small><strong>{format(new Date(`${selectedSlot.date}T00:00:00`), 'EEE, MMM d, yyyy')}</strong></div></div><div className="review-detail"><span>Time · UTC</span><strong>{selectedSlot.startTime}–{selectedSlot.endTime}</strong></div><div className="review-detail"><span>Appointment</span><strong>{selectedSlot.title || 'Appointment'}</strong></div><div className="review-divider" /><p className="review-microcopy">Your unique booking reference will appear once confirmed.</p><button className="button button-primary button-full" onClick={confirmBooking} disabled={busy}>{busy ? <><LoaderCircle className="spin" size={17} />Confirming…</> : <>Confirm appointment <ArrowRight size={16} /></>}</button></> : <div className="review-placeholder"><div className="review-placeholder-icon"><CalendarCheck2Icon /></div><strong>Your time, your choice.</strong><p>Select an open time to review the details before confirming.</p></div>}
      </aside>
    </div>
  </>;
}

function CalendarCheck2Icon() {
  return <CalendarDays size={22} />;
}
