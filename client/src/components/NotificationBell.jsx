import { useCallback, useEffect, useState } from 'react';
import { Bell, Check, CheckCheck, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { api, apiMessage, dataOf } from '../services/api.js';

function timestamp(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : formatDistanceToNow(date, { addSuffix: true });
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busyId, setBusyId] = useState('');

  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await api.get('/notifications/unread-count');
      setUnreadCount(dataOf(response).count);
    } catch (requestError) {
      setError(apiMessage(requestError, 'Could not load notification count.'));
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const response = await api.get('/notifications', { params: { page: 1, limit: 10 } });
      const data = dataOf(response);
      setNotifications(data.notifications);
      setUnreadCount(data.unreadCount);
    } catch (requestError) {
      setError(apiMessage(requestError, 'Could not load notifications.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshUnreadCount();
    const timer = window.setInterval(() => void refreshUnreadCount(), 60_000);
    return () => window.clearInterval(timer);
  }, [refreshUnreadCount]);

  async function toggleNotifications() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (nextOpen) await loadNotifications();
  }

  async function markRead(id) {
    setBusyId(id);
    setError('');
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications((current) => current.map((item) => item._id === id ? { ...item, isRead: true } : item));
      await refreshUnreadCount();
    } catch (requestError) {
      setError(apiMessage(requestError, 'Could not update this notification.'));
    } finally {
      setBusyId('');
    }
  }

  async function markAllRead() {
    setBusyId('all');
    setError('');
    try {
      await api.patch('/notifications/read-all');
      setNotifications((current) => current.map((item) => ({ ...item, isRead: true })));
      setUnreadCount(0);
    } catch (requestError) {
      setError(apiMessage(requestError, 'Could not update notifications.'));
    } finally {
      setBusyId('');
    }
  }

  async function removeNotification(id) {
    setBusyId(id);
    setError('');
    try {
      await api.delete(`/notifications/${id}`);
      setNotifications((current) => current.filter((item) => item._id !== id));
      await refreshUnreadCount();
    } catch (requestError) {
      setError(apiMessage(requestError, 'Could not delete this notification.'));
    } finally {
      setBusyId('');
    }
  }

  return <div className="relative">
    <button
      type="button"
      className="relative inline-flex h-10 w-10 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900"
      aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
      aria-expanded={open}
      onClick={toggleNotifications}
    >
      <Bell size={19} />
      {unreadCount > 0 && <span className="absolute -right-1 -top-1 inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold text-white">{unreadCount > 99 ? '99+' : unreadCount}</span>}
    </button>
    {open && <section className="absolute right-0 top-12 z-50 w-[min(22rem,calc(100vw-2rem))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl" aria-label="Notifications">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
        <div><h2 className="text-sm font-semibold text-slate-900">Notifications</h2><p className="text-xs text-slate-500">{unreadCount} unread</p></div>
        <button type="button" className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50 disabled:opacity-50" onClick={markAllRead} disabled={!unreadCount || busyId === 'all'}><CheckCheck size={14} />Mark all read</button>
      </div>
      {error && <div className="px-4 pt-3 text-xs text-red-600" role="alert">{error}<button type="button" className="ml-2 underline" onClick={loadNotifications}>Retry</button></div>}
      <div className="max-h-[min(70vh,28rem)] overflow-y-auto">
        {loading ? <div className="px-4 py-8 text-center text-sm text-slate-500">Loading notifications…</div>
          : notifications.length === 0 ? <div className="px-4 py-8 text-center"><Bell className="mx-auto mb-2 text-slate-300" size={22} /><p className="text-sm font-medium text-slate-700">You’re all caught up</p><p className="mt-1 text-xs text-slate-500">New appointment updates will appear here.</p></div>
            : notifications.map((item) => <article key={item._id} className={`border-b border-slate-100 px-4 py-3 last:border-0 ${item.isRead ? '' : 'bg-indigo-50/50'}`}>
              <div className="flex items-start gap-3">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${item.isRead ? 'bg-slate-200' : 'bg-indigo-600'}`} />
                <div className="min-w-0 flex-1">
                  <h3 className="text-sm font-semibold text-slate-900">{item.title}</h3>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{item.message}</p>
                  <time className="mt-1 block text-[11px] text-slate-400" dateTime={item.createdAt}>{timestamp(item.createdAt)}</time>
                </div>
                <div className="flex shrink-0">
                  {!item.isRead && <button type="button" className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-indigo-700" aria-label="Mark as read" disabled={busyId === item._id} onClick={() => markRead(item._id)}><Check size={15} /></button>}
                  <button type="button" className="rounded-md p-1.5 text-slate-400 hover:bg-white hover:text-red-600" aria-label="Delete notification" disabled={busyId === item._id} onClick={() => removeNotification(item._id)}><Trash2 size={15} /></button>
                </div>
              </div>
            </article>)}
      </div>
    </section>}
  </div>;
}
