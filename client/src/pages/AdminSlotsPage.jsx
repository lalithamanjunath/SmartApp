import { useEffect, useState } from 'react';
import { CalendarDays, Clock3, Edit3, Plus, RefreshCw, Trash2, X } from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { PageHeader } from '../components/PageHeader.jsx';
import { ErrorNotice, EmptyState, StatusBadge } from '../components/States.jsx';
import { api, apiMessage, dataOf } from '../services/api.js';

const emptyForm = { date: new Date().toISOString().slice(0, 10), startTime: '09:00', endTime: '09:30', status: 'available' };

export default function AdminSlotsPage() {
  const [slots, setSlots] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [modal, setModal] = useState(false);
  const [editId, setEditId] = useState(null);
  const [filter, setFilter] = useState('all');
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(false);
  const editingSlot = slots.find((slot) => slot._id === editId);
  const scheduleLocked = Boolean(editingSlot?.hasBookingHistory);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const query = filter === 'all' ? '' : `?status=${filter}`;
      setSlots(dataOf(await api.get(`/admin/slots${query}`))?.slots || []);
    } catch (requestError) {
      setError(apiMessage(requestError, 'Appointment slots could not be loaded.'));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, [filter]);

  function openCreate() {
    setEditId(null);
    setForm({ ...emptyForm, date: new Date().toISOString().slice(0, 10) });
    setModal(true);
  }

  function openEdit(slot) {
    setEditId(slot._id);
    setForm({ date: slot.date, startTime: slot.startTime, endTime: slot.endTime, status: slot.status === 'unavailable' ? 'unavailable' : 'available' });
    setModal(true);
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    try {
      if (editId) await api.put(`/admin/slots/${editId}`, form);
      else await api.post('/admin/slots', form);
      toast.success(editId ? 'Slot updated.' : 'Appointment slot created.');
      setModal(false);
      load();
    } catch (requestError) {
      toast.error(apiMessage(requestError, 'This slot could not be saved.'));
    } finally {
      setBusy(false);
    }
  }

  async function remove(slot) {
    if (!window.confirm(`Delete the ${slot.startTime} UTC slot on ${slot.date}? Slots with booking history must remain in appointment records.`)) return;
    try {
      await api.delete(`/admin/slots/${slot._id}`);
      toast.success('Slot deleted.');
      load();
    } catch (requestError) {
      toast.error(apiMessage(requestError, 'This slot cannot be deleted.'));
    }
  }

  const statusOptions = ['all', 'available', 'booked', 'unavailable'];
  const lockedHint = 'Original UTC appointment times are locked because booking history references this slot.';

  return <>
    <PageHeader
      eyebrow="ADMINISTRATION · CAPACITY"
      title="Make room for the right times."
      description="Create and manage appointment availability. Times are interpreted in UTC; active bookings and historical appointment times stay protected."
      action={<><button type="button" className="icon-button" aria-label="Refresh slots" onClick={load}><RefreshCw size={16} /></button><button className="button button-primary" onClick={openCreate}><Plus size={16} />Add a slot</button></>}
    />
    {error && <ErrorNotice message={error} onRetry={load} />}
    <section className="surface-panel management-panel">
      <div className="table-toolbar">
        <div><div className="eyebrow">APPOINTMENT SLOTS</div><h2>Your availability</h2></div>
        <label className="filter-select-label">Status<select aria-label="Filter slots by status" value={filter} onChange={(event) => setFilter(event.target.value)}>{statusOptions.map((item) => <option key={item} value={item}>{item === 'all' ? 'All statuses' : item[0].toUpperCase() + item.slice(1)}</option>)}</select></label>
      </div>
      {loading ? <div className="loading-line" /> : slots.length ? <div className="table-scroll">
        <table className="data-table">
          <thead><tr><th>Date · UTC</th><th>Time · UTC</th><th>Status</th><th>Created by</th><th><span className="sr-only">Actions</span></th></tr></thead>
          <tbody>{slots.map((slot) => {
            const timeLocked = slot.status === 'booked' || slot.hasBookingHistory;
            const deleteLocked = slot.status === 'booked' || slot.hasBookingHistory;
            return <tr key={slot._id}>
              <td><span className="table-date"><CalendarDays size={15} />{format(new Date(`${slot.date}T00:00:00`), 'EEE, MMM d, yyyy')}</span></td>
              <td><span className="table-time"><Clock3 size={15} />{slot.startTime}–{slot.endTime} UTC</span></td>
              <td><StatusBadge status={slot.status} />{slot.hasBookingHistory && <small className="table-note">History kept</small>}</td>
              <td>{slot.createdBy?.name || 'Administrator'}</td>
              <td className="table-actions">
                <button className="icon-button icon-button-small" aria-label={`Edit slot ${slot.date} ${slot.startTime} UTC`} title={timeLocked ? lockedHint : 'Edit appointment slot'} onClick={() => openEdit(slot)} disabled={slot.status === 'booked'}><Edit3 size={15} /></button>
                <button className="icon-button icon-button-small icon-danger" aria-label={`Delete slot ${slot.date} ${slot.startTime} UTC`} title={deleteLocked ? 'Slots with booking history cannot be deleted.' : 'Delete appointment slot'} onClick={() => remove(slot)} disabled={deleteLocked}><Trash2 size={15} /></button>
              </td>
            </tr>;
          })}</tbody>
        </table>
      </div> : <EmptyState title="No slots here just yet" description="Add availability for your team, and people can book times that work for them." icon={CalendarDays} action={<button className="button button-primary button-small" onClick={openCreate}><Plus size={14} />Add a slot</button>} />}
    </section>
    {modal && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setModal(false); }}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-labelledby="slot-modal-title">
        <div className="modal-head"><div><div className="eyebrow">CAPACITY MANAGEMENT</div><h2 id="slot-modal-title">{editId ? 'Edit appointment slot' : 'Create an appointment slot'}</h2></div><button className="icon-button" onClick={() => setModal(false)} aria-label="Close dialog"><X size={18} /></button></div>
        <form className="form-stack" onSubmit={save}>
          <label>Appointment date · UTC<input type="date" min={new Date().toISOString().slice(0, 10)} required disabled={scheduleLocked} value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} /></label>
          <div className="form-row"><label>Start time · UTC<input type="time" required disabled={scheduleLocked} value={form.startTime} onChange={(event) => setForm({ ...form, startTime: event.target.value })} /></label><label>End time · UTC<input type="time" required disabled={scheduleLocked} value={form.endTime} onChange={(event) => setForm({ ...form, endTime: event.target.value })} /></label></div>
          <label>Availability<select value={form.status} disabled={slotStatusIsBooked(editingSlot)} onChange={(event) => setForm({ ...form, status: event.target.value })}><option value="available">Available</option><option value="unavailable">Unavailable</option></select></label>
          <p className="modal-help">{scheduleLocked ? `${lockedHint} You may still change this slot’s availability.` : 'Overlapping UTC times are prevented, including simultaneous administrator changes. Active bookings cannot be invalidated.'}</p>
          <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setModal(false)}>Cancel</button><button className="button button-primary" disabled={busy}>{busy ? 'Saving…' : editId ? 'Save slot' : 'Create slot'}</button></div>
        </form>
      </div>
    </div>}
  </>;
}

function slotStatusIsBooked(slot) {
  return slot?.status === 'booked';
}
