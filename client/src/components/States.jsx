import { CalendarDays, CircleAlert } from 'lucide-react';

export function LoadingPage({ label = 'Loading your workspace' }) {
  return <main className="loading-page"><span className="loader-mark"><CalendarDays size={24} /></span><span>{label}</span></main>;
}

export function EmptyState({ title, description, action, icon: Icon = CalendarDays }) {
  return <div className="empty-state"><span className="empty-icon"><Icon size={21} /></span><h3>{title}</h3><p>{description}</p>{action}</div>;
}

export function ErrorNotice({ message, onRetry }) {
  return <div className="error-notice" role="alert"><CircleAlert size={18} /><span>{message}</span>{onRetry && <button type="button" className="text-button" onClick={onRetry}>Try again</button>}</div>;
}

const statusLabels = { confirmed: 'Confirmed', available: 'Available', booked: 'Booked', unavailable: 'Unavailable', cancelled: 'Cancelled', completed: 'Completed', 'no-show': 'No-show', active: 'Active', inactive: 'Inactive' };
export function StatusBadge({ status }) {
  const value = statusLabels[status] || status;
  return <span className={`status-badge status-${String(status).toLowerCase().replaceAll('_', '-')}`}>{value}</span>;
}
