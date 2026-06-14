import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { Save, RefreshCw, CheckCircle, Plus, Database } from 'lucide-react';
import { getPrompt, savePrompt, runSync, getSyncReport, getBusinessConfig, saveBusinessConfig, ConfigRow } from '../lib/api';
import { useI18n } from '../lib/i18n';

export default function SettingsPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [prompt, setPrompt] = useState('');
  const [saved, setSaved] = useState(false);

  const { data: promptData } = useQuery({ queryKey: ['prompt'], queryFn: getPrompt });
  const { data: syncData } = useQuery({ queryKey: ['sync-report'], queryFn: getSyncReport });

  useEffect(() => { if (promptData?.prompt) setPrompt(promptData.prompt); }, [promptData]);

  const saveMut = useMutation({
    mutationFn: () => savePrompt(prompt),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['prompt'] }); setSaved(true); setTimeout(() => setSaved(false), 2000); },
  });

  const syncMut = useMutation({
    mutationFn: runSync,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync-report'] }),
  });

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-xl font-semibold">{t('settings')}</h2>

      {/* Prompt Editor */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">{t('system_prompt')}</h3>
            <p className="text-xs text-app-muted mt-0.5">{t('prompt_hint')}</p>
          </div>
          <button
            onClick={() => saveMut.mutate()}
            disabled={saveMut.isPending}
            className="flex items-center gap-2 bg-green-600 hover:bg-green-500 text-white text-sm px-3 py-2 rounded-lg"
          >
            {saved ? <CheckCircle size={14} /> : <Save size={14} />}
            {saved ? t('saved') : saveMut.isPending ? t('saving') : t('save_prompt')}
          </button>
        </div>
        <textarea
          value={prompt}
          onChange={e => setPrompt(e.target.value)}
          rows={16}
          className="w-full bg-app-elevated border border-app-border rounded-lg px-4 py-3 text-sm font-mono text-app-text focus:outline-none focus:border-app-muted resize-y"
          placeholder="Enter system prompt..."
        />
        {saveMut.isError && <p className="text-red-400 text-xs">{(saveMut.error as Error).message}</p>}
      </div>

      {/* Business Config Editor */}
      <BusinessConfigEditor />

      {/* Sync Validation */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-medium">{t('sync_validation')}</h3>
            <p className="text-xs text-app-muted mt-0.5">{t('reconcile_hint')}</p>
          </div>
          <button
            onClick={() => syncMut.mutate()}
            disabled={syncMut.isPending}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500 text-white text-sm px-3 py-2 rounded-lg"
          >
            <RefreshCw size={14} className={syncMut.isPending ? 'animate-spin' : ''} />
            {syncMut.isPending ? t('running') : t('run_sync')}
          </button>
        </div>

        {syncData?.report && (
          <div className="bg-app-elevated rounded-lg p-4 text-sm space-y-2">
            <p className="text-app-muted text-xs">{t('last_run')}: {new Date(syncData.report.ranAt).toLocaleString()}</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-xs text-app-muted">Conflicts</p>
                <p className={syncData.report.conflicts.length > 0 ? 'text-red-400 font-medium' : 'text-green-400'}>
                  {syncData.report.conflicts.length}
                </p>
                {syncData.report.conflicts.map(c => (
                  <p key={c.reservation_id} className="text-xs text-red-400">
                    {c.reservation_id} ↔ {c.conflicts_with}
                  </p>
                ))}
              </div>
              <div>
                <p className="text-xs text-app-muted">Missing Calendar Events</p>
                <p className="text-yellow-400">{syncData.report.missingCalendarEvents.length}</p>
              </div>
              <div>
                <p className="text-xs text-app-muted">Auto-repaired</p>
                <p className="text-green-400">{syncData.report.repairedCount}</p>
              </div>
              <div>
                <p className="text-xs text-app-muted">Errors</p>
                <p className={syncData.report.errors.length > 0 ? 'text-red-400' : 'text-app-muted'}>
                  {syncData.report.errors.length}
                </p>
              </div>
            </div>
            {syncData.report.errors.length > 0 && (
              <div className="mt-2 space-y-1">
                {syncData.report.errors.map((e, i) => (
                  <p key={i} className="text-xs text-red-400 font-mono bg-red-950/30 rounded px-2 py-1">{e}</p>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Model Info */}
      <div className="bg-app-surface border border-app-border rounded-xl p-5">
        <h3 className="font-medium mb-2">{t('ai_model')}</h3>
        <p className="text-xs text-app-muted">
          Configured via <code className="text-app-muted">OPENROUTER_MODEL</code> in <code className="text-app-muted">.env.local</code>
        </p>
        <p className="text-xs text-app-muted mt-1">
          Supported: <span className="text-app-text">openai/gpt-4o-mini</span>, <span className="text-app-text">anthropic/claude-*</span>, <span className="text-app-text">google/gemini-*</span>, or any OpenRouter model.
        </p>
      </div>
    </div>
  );
}

function BusinessConfigEditor() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [rows, setRows] = useState<ConfigRow[]>([]);
  const [savingKey, setSavingKey] = useState<string | null>(null);

  const { data } = useQuery({ queryKey: ['business-config'], queryFn: getBusinessConfig });

  useEffect(() => { if (data?.config) setRows(data.config); }, [data]);

  const saveMut = useMutation({
    mutationFn: (row: ConfigRow) => saveBusinessConfig(row),
    onMutate: (row) => setSavingKey(row.key),
    onSettled: () => setSavingKey(null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['business-config'] }),
  });

  const updateRow = (i: number, field: keyof ConfigRow, value: string) =>
    setRows(rs => rs.map((r, idx) => idx === i ? { ...r, [field]: value } : r));

  const addRow = () => setRows(rs => [...rs, { key: '', value: '', description: '' }]);

  return (
    <div className="bg-app-surface border border-app-border rounded-xl p-5 space-y-3">
      <div>
        <h3 className="font-medium flex items-center gap-2"><Database size={15} /> {t('business_config')}</h3>
        <p className="text-xs text-app-muted mt-0.5">{t('business_config_hint')}</p>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-[1fr_1.2fr_1.2fr_auto] gap-2 text-xs text-app-muted px-1">
          <span>{t('config_key')}</span>
          <span>{t('config_value')}</span>
          <span>{t('config_description')}</span>
          <span></span>
        </div>
        {rows.map((row, i) => (
          <div key={i} className="grid grid-cols-[1fr_1.2fr_1.2fr_auto] gap-2 items-center">
            <input
              value={row.key}
              onChange={e => updateRow(i, 'key', e.target.value)}
              className="bg-app-elevated border border-app-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-app-muted"
            />
            <input
              value={row.value}
              onChange={e => updateRow(i, 'value', e.target.value)}
              className="bg-app-elevated border border-app-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-app-muted"
            />
            <input
              value={row.description}
              onChange={e => updateRow(i, 'description', e.target.value)}
              className="bg-app-elevated border border-app-border rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:border-app-muted"
            />
            <button
              onClick={() => saveMut.mutate(row)}
              disabled={!row.key.trim() || savingKey === row.key}
              className="bg-green-600 hover:bg-green-500 disabled:opacity-40 text-white text-xs px-3 py-1.5 rounded-lg"
            >
              {savingKey === row.key ? '...' : t('save')}
            </button>
          </div>
        ))}
      </div>

      <button
        onClick={addRow}
        className="flex items-center gap-2 text-xs text-app-muted hover:text-app-text border border-app-border hover:border-app-muted rounded-lg px-3 py-1.5"
      >
        <Plus size={12} /> {t('add_config')}
      </button>
      {saveMut.isError && <p className="text-red-400 text-xs">{(saveMut.error as Error).message}</p>}
    </div>
  );
}
