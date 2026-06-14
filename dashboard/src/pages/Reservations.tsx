import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Search, X, Plus, Pencil } from 'lucide-react';
import { getReservations, cancelReservation, createReservation, modifyReservation, Reservation } from '../lib/api';
import { useI18n } from '../lib/i18n';

const STATUS_COLORS: Record<string, string> = {
  Confirmed: 'bg-green-600/20 text-green-400',
  Pending: 'bg-yellow-600/20 text-yellow-400',
  Cancelled: 'bg-red-600/20 text-red-400',
};

export default function ReservationsPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<Reservation | null>(null);

  const { data, isLoading } = useQuery({ queryKey: ['reservations'], queryFn: getReservations });

  const cancelMut = useMutation({
    mutationFn: cancelReservation,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['reservations'] }),
  });

  const filtered = (data?.reservations ?? []).filter(r =>
    [r.guest_name, r.phone, r.accommodation_name, r.reservation_id, r.status]
      .some(v => v.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('nav_reservations')}</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm px-3 py-2 rounded-lg"
        >
          <Plus size={14} /> {t('new_reservation')}
        </button>
      </div>

      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder={t('search_reservations')}
          className="w-full bg-app-surface border border-app-border rounded-lg pl-8 pr-4 py-2 text-sm focus:outline-none focus:border-app-muted"
        />
      </div>

      {isLoading ? (
        <p className="text-app-muted text-sm">{t('loading')}</p>
      ) : (
        <div className="bg-app-surface rounded-xl border border-app-border overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-app-border text-app-muted text-xs">
                <th className="text-left px-4 py-3">{t('guest_col')}</th>
                <th className="text-left px-4 py-3">{t('accommodation')}</th>
                <th className="text-left px-4 py-3">{t('dates')}</th>
                <th className="text-left px-4 py-3">{t('guests')}</th>
                <th className="text-left px-4 py-3">{t('status')}</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.reservation_id} className="border-b border-app-border/50 hover:bg-app-elevated/30">
                  <td className="px-4 py-3">
                    <p className="font-medium">{r.guest_name}</p>
                    <p className="text-xs text-app-muted">{r.phone}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p>{r.accommodation_name}</p>
                    <p className="text-xs text-app-muted">{r.accommodation_type}</p>
                  </td>
                  <td className="px-4 py-3 text-xs text-app-text">
                    {r.checkin_date} → {r.checkout_date}
                  </td>
                  <td className="px-4 py-3 text-center">{r.num_guests}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[r.status] ?? ''}`}>
                      {r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2 justify-end">
                      {r.status !== 'Cancelled' && (
                        <>
                          <button
                            onClick={() => setEditing(r)}
                            className="text-app-muted hover:text-blue-400"
                          ><Pencil size={13} /></button>
                          <button
                            onClick={() => cancelMut.mutate(r.reservation_id)}
                            className="text-app-muted hover:text-red-400"
                          ><X size={13} /></button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr><td colSpan={6} className="text-center text-app-muted py-8 text-sm">{t('no_reservations')}</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showCreate && <CreateModal onClose={() => setShowCreate(false)} />}
      {editing && <EditModal reservation={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function CreateModal({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [form, setForm] = useState({
    guest_name: '', phone: '', email: '', accommodation_id: '',
    checkin_date: '', checkout_date: '', num_guests: 1,
  });

  const mut = useMutation({
    mutationFn: () => createReservation(form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservations'] }); onClose(); },
  });

  const fieldLabels: Record<string, string> = {
    guest_name: t('field_guest_name'), phone: t('field_phone'), email: t('field_email'),
    accommodation_id: t('field_accommodation_id'),
    checkin_date: t('field_checkin'), checkout_date: t('field_checkout'),
  };

  return (
    <Modal title={t('new_reservation')} onClose={onClose}>
      <div className="space-y-3">
        {(['guest_name', 'phone', 'email', 'accommodation_id', 'checkin_date', 'checkout_date'] as const).map(field => (
          <div key={field}>
            <label className="text-xs text-app-muted">{fieldLabels[field]}</label>
            <input
              value={String(form[field])}
              onChange={e => setForm(f => ({ ...f, [field]: e.target.value }))}
              className="w-full mt-1 bg-app-elevated border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-app-muted"
            />
          </div>
        ))}
        <div>
          <label className="text-xs text-app-muted">{t('field_num_guests')}</label>
          <input
            type="number" min={1}
            value={form.num_guests}
            onChange={e => setForm(f => ({ ...f, num_guests: parseInt(e.target.value) }))}
            className="w-full mt-1 bg-app-elevated border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-app-muted"
          />
        </div>
        {mut.isError && <p className="text-red-400 text-xs">{(mut.error as Error).message}</p>}
        <button
          onClick={() => mut.mutate()}
          disabled={mut.isPending}
          className="w-full bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-sm font-medium"
        >
          {mut.isPending ? t('creating') : t('create_reservation_btn')}
        </button>
      </div>
    </Modal>
  );
}

function EditModal({ reservation, onClose }: { reservation: Reservation; onClose: () => void }) {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [form, setForm] = useState({
    new_checkin_date: reservation.checkin_date,
    new_checkout_date: reservation.checkout_date,
    new_num_guests: reservation.num_guests,
  });

  const mut = useMutation({
    mutationFn: () => modifyReservation(reservation.reservation_id, form),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['reservations'] }); onClose(); },
  });

  return (
    <Modal title={`${t('modify')} — ${reservation.guest_name}`} onClose={onClose}>
      <div className="space-y-3">
        <div>
          <label className="text-xs text-app-muted">{t('field_checkin')}</label>
          <input value={form.new_checkin_date} onChange={e => setForm(f => ({ ...f, new_checkin_date: e.target.value }))}
            className="w-full mt-1 bg-app-elevated border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-app-muted" />
        </div>
        <div>
          <label className="text-xs text-app-muted">{t('field_checkout')}</label>
          <input value={form.new_checkout_date} onChange={e => setForm(f => ({ ...f, new_checkout_date: e.target.value }))}
            className="w-full mt-1 bg-app-elevated border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-app-muted" />
        </div>
        <div>
          <label className="text-xs text-app-muted">{t('field_num_guests')}</label>
          <input type="number" min={1} value={form.new_num_guests}
            onChange={e => setForm(f => ({ ...f, new_num_guests: parseInt(e.target.value) }))}
            className="w-full mt-1 bg-app-elevated border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-app-muted" />
        </div>
        {mut.isError && <p className="text-red-400 text-xs">{(mut.error as Error).message}</p>}
        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium">
          {mut.isPending ? t('saving') : t('save_changes')}
        </button>
      </div>
    </Modal>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={onClose}>
      <div className="bg-app-surface border border-app-border rounded-xl p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold">{title}</h3>
          <button onClick={onClose} className="text-app-muted hover:text-app-text"><X size={16} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
