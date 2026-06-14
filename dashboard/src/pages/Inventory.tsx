import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Plus, Pencil, X, Users, Bed, Bath, DollarSign } from 'lucide-react';
import { getInventory, saveAccommodation, Accommodation } from '../lib/api';
import { useI18n } from '../lib/i18n';

const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-green-600/20 text-green-400',
  Inactive: 'bg-app-elevated text-app-muted',
  Maintenance: 'bg-yellow-600/20 text-yellow-400',
};

const EMPTY: Accommodation = {
  accommodation_id: '', name: '', type: 'cabin', status: 'Active',
  max_guests: 2, bedrooms: 1, bathrooms: 1,
  price_per_night: 0, cleaning_fee: 0, taxes_pct: 0,
  amenities: [], description: '', images: [], min_stay: 1, max_stay: 30,
};

export default function InventoryPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [editing, setEditing] = useState<Accommodation | null>(null);
  const { data, isLoading } = useQuery({ queryKey: ['inventory'], queryFn: getInventory });

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold">{t('property_inventory')}</h2>
        <button
          onClick={() => setEditing({ ...EMPTY })}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm px-3 py-2 rounded-lg"
        >
          <Plus size={14} /> {t('add_accommodation')}
        </button>
      </div>

      {isLoading ? (
        <p className="text-app-muted text-sm">{t('loading')}</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {(data?.accommodations ?? []).map(acc => (
            <div key={acc.accommodation_id} className="bg-app-surface border border-app-border rounded-xl p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-medium">{acc.name}</h3>
                  <p className="text-xs text-app-muted">{acc.accommodation_id} · {acc.type}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[acc.status] ?? ''}`}>
                    {acc.status}
                  </span>
                  <button onClick={() => setEditing(acc)} className="text-app-muted hover:text-blue-400">
                    <Pencil size={13} />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2 text-xs text-app-muted">
                <div className="flex items-center gap-1"><Users size={11} />{acc.max_guests}</div>
                <div className="flex items-center gap-1"><Bed size={11} />{acc.bedrooms}</div>
                <div className="flex items-center gap-1"><Bath size={11} />{acc.bathrooms}</div>
                <div className="flex items-center gap-1"><DollarSign size={11} />{acc.price_per_night}/n</div>
              </div>

              {acc.amenities.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {acc.amenities.slice(0, 4).map(a => (
                    <span key={a} className="text-xs bg-app-elevated text-app-muted px-2 py-0.5 rounded">{a}</span>
                  ))}
                  {acc.amenities.length > 4 && (
                    <span className="text-xs text-app-muted">+{acc.amenities.length - 4}</span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {editing && (
        <AccommodationModal
          accommodation={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { qc.invalidateQueries({ queryKey: ['inventory'] }); setEditing(null); }}
        />
      )}
    </div>
  );
}

function AccommodationModal({
  accommodation, onClose, onSaved,
}: { accommodation: Accommodation; onClose: () => void; onSaved: () => void }) {
  const { t } = useI18n();
  const [form, setForm] = useState<Accommodation>({ ...accommodation });
  // Keep amenities as raw editable text; parse to array only on save.
  const [amenitiesText, setAmenitiesText] = useState(accommodation.amenities.join(', '));

  const mut = useMutation({
    mutationFn: () => saveAccommodation({
      ...form,
      amenities: amenitiesText.split(',').map(s => s.trim()).filter(Boolean),
    }),
    onSuccess: onSaved,
  });

  const set = (field: keyof Accommodation, value: unknown) =>
    setForm(f => ({ ...f, [field]: value }));

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-app-surface border border-app-border rounded-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto"
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold">{accommodation.accommodation_id ? t('edit_accommodation') : t('add_accommodation_title')}</h3>
          <button onClick={onClose} className="text-app-muted hover:text-app-text"><X size={16} /></button>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {([
            ['accommodation_id', t('acc_id')],
            ['name', t('acc_name')],
            ['type', t('acc_type')],
            ['description', t('acc_description')],
          ] as [keyof Accommodation, string][]).map(([field, label]) => (
            <div key={field} className={field === 'description' ? 'col-span-2' : ''}>
              <label className="text-xs text-app-muted">{label}</label>
              <input value={String(form[field] ?? '')} onChange={e => set(field, e.target.value)}
                className="w-full mt-1 bg-app-elevated border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-app-muted" />
            </div>
          ))}

          <div>
            <label className="text-xs text-app-muted">{t('acc_status')}</label>
            <select value={form.status} onChange={e => set('status', e.target.value)}
              className="w-full mt-1 bg-app-elevated border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-app-muted">
              <option>Active</option><option>Inactive</option><option>Maintenance</option>
            </select>
          </div>

          {([
            ['max_guests', t('acc_max_guests')], ['bedrooms', t('acc_bedrooms')], ['bathrooms', t('acc_bathrooms')],
            ['price_per_night', t('acc_price')], ['cleaning_fee', t('acc_cleaning')], ['taxes_pct', t('acc_tax')],
            ['min_stay', t('acc_min_stay')], ['max_stay', t('acc_max_stay')],
          ] as [keyof Accommodation, string][]).map(([field, label]) => (
            <div key={field}>
              <label className="text-xs text-app-muted">{label}</label>
              <input type="number" value={Number(form[field] ?? 0)} onChange={e => set(field, parseFloat(e.target.value))}
                className="w-full mt-1 bg-app-elevated border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-app-muted" />
            </div>
          ))}

          <div className="col-span-2">
            <label className="text-xs text-app-muted">{t('acc_amenities')}</label>
            <input
              value={amenitiesText}
              onChange={e => setAmenitiesText(e.target.value)}
              placeholder="WiFi, Jacuzzi, BBQ, Cocina"
              className="w-full mt-1 bg-app-elevated border border-app-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-app-muted"
            />
          </div>
        </div>

        {mut.isError && <p className="text-red-400 text-xs mt-3">{(mut.error as Error).message}</p>}
        <button onClick={() => mut.mutate()} disabled={mut.isPending}
          className="w-full mt-5 bg-green-600 hover:bg-green-500 text-white py-2 rounded-lg text-sm font-medium">
          {mut.isPending ? t('saving') : t('save_accommodation')}
        </button>
      </div>
    </div>
  );
}
