import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { Wifi, WifiOff, Bot, User, RefreshCw, Zap, LogOut, Mic, Clock } from 'lucide-react';
import { getWhatsAppStatus, getQR, getAgentMode, setAgentMode, runSync, getSyncReport, resetWhatsApp, getTranscriptions, VoiceTranscription, getRecentMessages } from '../lib/api';
import { useI18n } from '../lib/i18n';

interface LogEntry { type: 'incoming' | 'outgoing'; phone: string; text: string; timestamp: string; isVoice?: boolean }

export default function DashboardPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const [liveTranscriptions, setLiveTranscriptions] = useState<VoiceTranscription[]>([]);
  const transcriptionsEndRef = useRef<HTMLDivElement>(null);

  const { data: status } = useQuery({ queryKey: ['wa-status'], queryFn: getWhatsAppStatus, refetchInterval: 5000 });
  const { data: qrData } = useQuery({ queryKey: ['wa-qr'], queryFn: getQR, refetchInterval: status?.connected ? false : 3000 });
  const { data: modeData } = useQuery({ queryKey: ['agent-mode'], queryFn: getAgentMode });
  const { data: syncReport } = useQuery({ queryKey: ['sync-report'], queryFn: getSyncReport });
  const { data: transcriptionsData } = useQuery({ queryKey: ['transcriptions'], queryFn: () => getTranscriptions(50) });
  const { data: recentData } = useQuery({ queryKey: ['recent-messages'], queryFn: () => getRecentMessages(50) });

  // Backfill the live feed once on load so it isn't blank before SSE delivers anything.
  const backfilled = useRef(false);
  useEffect(() => {
    if (backfilled.current || !recentData) return;
    backfilled.current = true;
    setLogs(prev => {
      const seed: LogEntry[] = recentData.messages.map(m => ({
        type: m.direction === 'in' ? 'incoming' : 'outgoing',
        phone: m.number,
        text: m.text,
        timestamp: m.timestamp,
      }));
      // Keep any SSE entries that may have already arrived, appended after the seed.
      return [...seed, ...prev].slice(-100);
    });
  }, [recentData]);

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

    source.addEventListener('message:incoming', (e) => {
      const d = JSON.parse(e.data);
      setLogs(prev => [...prev.slice(-99), { type: 'incoming', ...d }]);
    });
    source.addEventListener('message:outgoing', (e) => {
      const d = JSON.parse(e.data);
      setLogs(prev => [...prev.slice(-99), { type: 'outgoing', ...d }]);
    });
    source.addEventListener('voice:transcription', (e) => {
      const d: VoiceTranscription = JSON.parse(e.data);
      // Add mic marker to the live feed entry for this phone
      setLogs(prev => [...prev.slice(-99), {
        type: 'incoming', phone: d.phone, text: d.transcript,
        timestamp: d.timestamp, isVoice: true,
      }]);
      // Add to dedicated transcriptions list
      setLiveTranscriptions(prev => [d, ...prev.slice(0, 49)]);
    });

    return () => source.close();
  }, []);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  useEffect(() => {
    transcriptionsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [liveTranscriptions]);

  // Merge historical transcriptions (REST) with live (SSE), deduplicate by id
  const allTranscriptions = (() => {
    const seen = new Set<string>();
    const merged: VoiceTranscription[] = [];
    for (const t of [...liveTranscriptions, ...(transcriptionsData?.transcriptions ?? [])]) {
      if (!seen.has(t.id)) { seen.add(t.id); merged.push(t); }
    }
    return merged.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  })();

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
              {log.isVoice && <Mic size={10} className="text-purple-400 shrink-0 mt-0.5" />}
              <span className={`truncate ${log.isVoice ? 'italic text-purple-300' : ''}`}>{log.text}</span>
            </div>
          ))}
          <div ref={logsEndRef} />
        </div>
      </div>

      {/* Voice Transcriptions panel */}
      <div className="bg-app-surface rounded-2xl border border-app-border animate-fade-up" style={{ animationDelay: '380ms' }}>
        <div className="flex items-center gap-2 px-5 py-3.5 border-b border-app-border">
          <Mic size={14} className="text-purple-400" />
          <span className="text-[11px] uppercase tracking-widest font-medium">{t('voice_transcriptions')}</span>
          <span className="ml-auto text-xs text-app-muted">{allTranscriptions.length} {t('total')}</span>
        </div>

        {allTranscriptions.length === 0 ? (
          <div className="px-5 py-10 text-center">
            <Mic size={28} className="text-app-muted mx-auto mb-3 opacity-30" />
            <p className="text-xs text-app-muted">{t('no_voice_messages')}</p>
            <p className="text-xs text-app-muted mt-1">
              {!import.meta.env.VITE_API_KEY
                ? t('voice_hint_disabled')
                : t('voice_hint_enabled')}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-app-border max-h-96 overflow-y-auto">
            {allTranscriptions.map((tr) => (
              <div key={tr.id} className="px-5 py-4 hover:bg-app-elevated/50 transition-colors">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-7 h-7 rounded-full bg-purple-600/20 flex items-center justify-center shrink-0">
                    <Mic size={12} className="text-purple-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-app-text">{tr.phone}</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <Clock size={9} className="text-app-muted" />
                      <span className="text-[10px] text-app-muted">{new Date(tr.timestamp).toLocaleString()}</span>
                      {tr.durationSecs != null && (
                        <span className="text-[10px] text-purple-400/70">
                          {tr.durationSecs >= 60
                            ? `${Math.floor(tr.durationSecs / 60)}m ${tr.durationSecs % 60}s`
                            : `${tr.durationSecs}s`}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-app-text leading-relaxed pl-10 italic">
                  "{tr.transcript}"
                </p>
              </div>
            ))}
            <div ref={transcriptionsEndRef} />
          </div>
        )}
      </div>
    </div>
  );
}
