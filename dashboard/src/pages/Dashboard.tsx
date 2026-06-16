import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, Bot, User, RefreshCw, Zap, LogOut } from 'lucide-react';
import { getWhatsAppStatus, getQR, getAgentMode, setAgentMode, runSync, getSyncReport, resetWhatsApp } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface LogEntry { type: 'incoming' | 'outgoing'; phone: string; text: string; timestamp: string }

export default function DashboardPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery({ queryKey: ['wa-status'], queryFn: getWhatsAppStatus, refetchInterval: 5000 });
  const { data: qrData } = useQuery({ queryKey: ['wa-qr'], queryFn: getQR, refetchInterval: status?.connected ? false : 3000 });
  const { data: modeData } = useQuery({ queryKey: ['agent-mode'], queryFn: getAgentMode });
  const { data: syncReport } = useQuery({ queryKey: ['sync-report'], queryFn: getSyncReport });

  const modeMutation = useMutation({
    mutationFn: (mode: 'ai' | 'human') => setAgentMode(mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['agent-mode'] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation'] });
    },
  });

  const syncMutation = useMutation({
    mutationFn: runSync,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['sync-report'] }),
  });

  const resetMutation = useMutation({
    mutationFn: resetWhatsApp,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['wa-status'] });
      qc.invalidateQueries({ queryKey: ['wa-qr'] });
    },
  });

  const handleReset = () => {
    if (confirm('Unlink the current WhatsApp account and generate a new QR to link a different number? The bot will go offline until you scan the new QR.')) {
      resetMutation.mutate();
    }
  };

  // SSE
  useEffect(() => {
    const apiKey = import.meta.env.VITE_API_KEY ?? 'change-me-dashboard-secret';
    const source = new EventSource(`/api/events?key=${apiKey}`);
    // Note: SSE doesn't support custom headers; use query param workaround or a token approach
    source.addEventListener('message:incoming', (e) => {
      const d = JSON.parse(e.data);
      setLogs(prev => [...prev.slice(-99), { type: 'incoming', ...d }]);
    });
    source.addEventListener('message:outgoing', (e) => {
      const d = JSON.parse(e.data);
      setLogs(prev => [...prev.slice(-99), { type: 'outgoing', ...d }]);
    });
    return () => source.close();
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const currentMode = modeData?.mode ?? 'ai';

  return (
    <div className="p-8 space-y-8">
      {/* Editorial hero */}
      <header className="animate-fade-up">
        <p className="text-[11px] uppercase tracking-[0.3em] text-brand-gold mb-1">Delux Hotels</p>
        <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-wide leading-none">
          {t('nav_overview')}
        </h2>
        <div className="gold-rule w-24 mt-3" />
      </header>

      {/* Status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* WhatsApp */}
        <div className="bg-app-surface rounded-2xl p-5 border border-app-border card-lift animate-fade-up" style={{ animationDelay: '60ms' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-widest text-app-muted">{t('whatsapp')}</span>
            {status?.connected
              ? <span className="flex items-center gap-1 text-brand-emeraldLight text-xs"><Wifi size={12}/> {t('connected')}</span>
              : <span className="flex items-center gap-1 text-red-400 text-xs"><WifiOff size={12}/> {t('disconnected')}</span>
            }
          </div>
          {!status?.connected && qrData?.qr && (
            <img src={qrData.qr} alt="WhatsApp QR" className="w-40 h-40 mx-auto rounded-lg bg-white p-1" />
          )}
          {status?.connected && (
            <p className="text-sm text-app-text">📱 {status.phoneNumber}</p>
          )}
          {!status?.connected && !qrData?.qr && (
            <p className="text-xs text-app-muted mt-2">
              {resetMutation.isPending ? t('resetting') : t('starting_up')}
            </p>
          )}

          <button
            onClick={handleReset}
            disabled={resetMutation.isPending}
            className="mt-3 w-full flex items-center justify-center gap-2 text-xs text-red-400 hover:text-red-300 border border-red-900/50 hover:border-red-700 rounded-lg py-1.5 transition-colors disabled:opacity-40"
          >
            <LogOut size={12} />
            {status?.connected ? t('unlink_connected') : t('unlink_disconnected')}
          </button>
        </div>

        {/* Default Agent Mode */}
        <div className="bg-app-surface rounded-2xl p-5 border border-app-border card-lift animate-fade-up" style={{ animationDelay: '140ms' }}>
          <p className="text-[11px] uppercase tracking-widest text-app-muted mb-3">{t('default_agent_mode')}</p>
          <div className="flex gap-2">
            <button
              onClick={() => modeMutation.mutate('ai')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentMode === 'ai' ? 'bg-brand-emerald text-white' : 'bg-app-elevated text-app-muted hover:bg-app-border'
              }`}
            >
              <Bot size={14}/> {t('mode_ai')}
            </button>
            <button
              onClick={() => modeMutation.mutate('human')}
              className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                currentMode === 'human' ? 'bg-amber-600 text-white' : 'bg-app-elevated text-app-muted hover:bg-app-border'
              }`}
            >
              <User size={14}/> {t('mode_human')}
            </button>
          </div>
          <p className="text-xs text-app-muted mt-2">
            {currentMode === 'ai' ? t('default_mode_hint_ai') : t('default_mode_hint_human')}
          </p>
          <p className="text-xs text-app-muted mt-1">{t('per_chat_hint')}</p>
        </div>

        {/* Sync */}
        <div className="bg-app-surface rounded-2xl p-5 border border-app-border card-lift animate-fade-up" style={{ animationDelay: '220ms' }}>
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] uppercase tracking-widest text-app-muted">{t('sync_status')}</span>
            <button
              onClick={() => syncMutation.mutate()}
              disabled={syncMutation.isPending}
              className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1"
            >
              <RefreshCw size={10} className={syncMutation.isPending ? 'animate-spin' : ''}/> {t('run_now')}
            </button>
          </div>
          {syncReport?.report ? (
            <div className="space-y-1 text-xs">
              <p className="text-app-muted">{t('last_run')}: {new Date(syncReport.report.ranAt).toLocaleString()}</p>
              <p className={syncReport.report.conflicts.length > 0 ? 'text-red-400' : 'text-brand-emeraldLight'}>
                {syncReport.report.conflicts.length > 0
                  ? `⚠️ ${syncReport.report.conflicts.length} ${t('conflicts')}`
                  : `✓ ${t('no_conflicts')}`}
              </p>
              <p className="text-app-muted">{t('repaired')}: {syncReport.report.repairedCount}</p>
            </div>
          ) : (
            <p className="text-xs text-app-muted">{t('no_report')}</p>
          )}
        </div>
      </div>

      {/* Live message feed */}
      <div className="bg-app-surface rounded-2xl border border-app-border animate-fade-up" style={{ animationDelay: '300ms' }}>
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-app-border">
          <Zap size={14} className="text-brand-gold" />
          <span className="text-[11px] uppercase tracking-widest font-medium">{t('live_feed')}</span>
          <span className="ml-auto text-xs text-app-muted">{logs.length} {t('messages')}</span>
        </div>
        <div className="h-64 overflow-y-auto p-4 space-y-2 font-mono">
          {logs.length === 0 && (
            <p className="text-xs text-app-muted text-center mt-8">{t('waiting_messages')}</p>
          )}
          {logs.map((log, i) => (
            <div key={i} className={`text-xs flex gap-3 ${log.type === 'incoming' ? 'text-blue-300' : 'text-brand-emeraldLight'}`}>
              <span className="text-app-muted shrink-0">{new Date(log.timestamp).toLocaleTimeString()}</span>
              <span className="text-app-muted shrink-0">{log.type === 'incoming' ? '←' : '→'}</span>
              <span className="text-app-muted shrink-0">{log.phone}</span>
              <span className="truncate">{log.text}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>
    </div>
  );
}
