import { Link } from 'react-router-dom';
import { ArrowUpRight, CalendarDays, Clock3, Hash } from 'lucide-react';
import { format } from 'date-fns';
import { StatusBadge } from './States.jsx';

export function BookingCard({ booking, to, onCancel, compact = false }) {
  const slot = booking.slotId || {};
  const date = slot.date ? new Date(`${slot.date}T00:00:00`) : null;
  return <article className={`booking-card ${compact ? 'booking-card-compact' : ''}`}>
    <div className="booking-date-tile"><span>{date ? format(date, 'MMM') : '—'}</span><strong>{date ? format(date, 'dd') : '—'}</strong><small>{date ? format(date, 'EEE') : ''}</small></div>
    <div className="booking-info">
      <div className="booking-title-row"><h3>{slot.title || 'Appointment'}</h3><StatusBadge status={booking.status} /></div>
      <div className="booking-meta">
        <span><CalendarDays size={14} />{date ? format(date, 'EEEE, MMMM d, yyyy') : 'Date unavailable'}</span>
        <span><Clock3 size={14} />{slot.startTime || '—'}–{slot.endTime || '—'} UTC</span>
        <span><Hash size={14} />{booking.bookingReference || 'Pending reference'}</span>
      </div>
    </div>
    <div className="booking-card-actions">
      {onCancel && booking.status === 'confirmed' && <button type="button" className="text-button danger-text" onClick={() => onCancel(booking)}>Cancel</button>}
      {to && <Link className="icon-link" to={to} aria-label="View appointment details"><ArrowUpRight size={17} /></Link>}
    </div>
  </article>;
}
