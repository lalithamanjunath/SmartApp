import { useEffect, useState } from 'react';
import { ArrowRight, Search, UserRound, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader.jsx';
import { BookingCard } from '../components/BookingCard.jsx';
import { EmptyState, ErrorNotice, LoadingPage, StatusBadge } from '../components/States.jsx';
import { api, apiMessage, dataOf } from '../services/api.js';

export default function AdminUsersPage() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [history, setHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  async function load() {
    setLoading(true); setError('');
    try { const params = new URLSearchParams(); if (query.trim()) params.set('q', query.trim()); setUsers(dataOf(await api.get(`/admin/users?${params.toString()}`))?.users || []); }
    catch (requestError) { setError(apiMessage(requestError, 'Members could not be loaded.')); }
    finally { setLoading(false); }
  }
  useEffect(() => { load(); }, []);
  async function viewHistory(user) {
    setSelected(user); setHistoryLoading(true);
    try { setHistory(dataOf(await api.get(`/admin/users/${user.id}`))?.bookings || []); }
    catch (requestError) { toast.error(apiMessage(requestError, 'Booking history could not be loaded.')); setHistory([]); }
    finally { setHistoryLoading(false); }
  }
  async function toggleStatus(user) {
    const next = !user.isActive;
    try {
      await api.patch(`/admin/users/${user.id}/status`, { isActive: next });
      toast.success(next ? 'Member account activated.' : 'Member account deactivated.'); load();
      if (selected?.id === user.id) setSelected({ ...selected, isActive: next });
    } catch (requestError) { toast.error(apiMessage(requestError, 'Member account status could not be changed.')); }
  }
  return <>
    <PageHeader eyebrow="ADMINISTRATION · PEOPLE" title="The people behind the bookings." description="Find members, see their appointment history and manage account access safely."/>
    {error && <ErrorNotice message={error} onRetry={load}/>}
    <section className="surface-panel management-panel"><div className="table-toolbar"><div><div className="eyebrow">MEMBERS</div><h2>{loading ? 'Loading people…' : `${users.length} member${users.length === 1 ? '' : 's'}`}</h2></div><div className="filter-row"><label className="search-field"><Search size={16}/><input aria-label="Search users" placeholder="Search name or email" value={query} onChange={(event) => setQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && load()}/></label><button className="button button-outline button-small" onClick={load}>Search</button></div></div>
      {loading ? <div className="loading-line"/> : users.length ? <div className="table-scroll"><table className="data-table"><thead><tr><th>Member</th><th>Joined</th><th>Bookings</th><th>Account</th><th><span className="sr-only">Actions</span></th></tr></thead><tbody>{users.map((user) => <tr key={user.id}><td><div className="member-cell"><strong>{user.name}</strong><small>{user.email}</small></div></td><td>{user.createdAt ? format(new Date(user.createdAt), 'MMM d, yyyy') : '—'}</td><td>{user.bookingCount || 0}</td><td><StatusBadge status={user.isActive ? 'active' : 'inactive'}/></td><td className="table-actions"><button className="text-button" onClick={() => viewHistory(user)}>History</button><button className={`text-button ${user.isActive ? 'danger-text' : ''}`} onClick={() => toggleStatus(user)}>{user.isActive ? 'Deactivate' : 'Activate'}</button></td></tr>)}</tbody></table></div> : <EmptyState title="No members found" description="Try searching by another name or email address." icon={UserRound}/>}</section>
    {selected && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelected(null); }}><div className="modal-card history-modal" role="dialog" aria-modal="true" aria-labelledby="history-title"><div className="modal-head"><div><div className="eyebrow">MEMBER HISTORY</div><h2 id="history-title">{selected.name}</h2><p>{selected.email}</p></div><button className="icon-button" onClick={() => setSelected(null)} aria-label="Close booking history"><X size={18}/></button></div>{historyLoading ? <LoadingPage label="Loading booking history"/> : history.length ? <div className="booking-list">{history.map((booking) => <BookingCard key={booking._id} booking={booking} compact/>)}</div> : <EmptyState title="No booking history yet" description="This member has not booked an appointment." icon={UserRound}/>}<div className="modal-actions"><button className="button button-outline" onClick={() => toggleStatus(selected)}>{selected.isActive ? 'Deactivate account' : 'Activate account'}</button><button className="button button-quiet" onClick={() => setSelected(null)}>Close</button></div></div></div>}
  </>;
}
