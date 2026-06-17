import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect, useRef } from 'react';
import { Send, Bot, User, MessageCircle, Languages } from 'lucide-react';
import {
  getConversations, getConversationMessages, sendManualMessage,
  setConversationMode, translateText, LoggedMessage,
} from '../lib/api';
import { useI18n } from '../lib/i18n';

export default function ConversationsPage() {
  const qc = useQueryClient();
  const { t } = useI18n();
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  const { data: convData } = useQuery({
    queryKey: ['conversations'],
    queryFn: getConversations,
    refetchInterval: 3000,
  });

  const { data: msgData } = useQuery({
    queryKey: ['conversation', selected],
    queryFn: () => getConversationMessages(selected!),
    enabled: !!selected,
    refetchInterval: 2000,
  });

  const sendMut = useMutation({
    mutationFn: () => sendManualMessage(selected!, draft.trim()),
    onSuccess: () => {
      setDraft('');
      qc.invalidateQueries({ queryKey: ['conversation', selected] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });

  // Translate the current draft in place (ES↔EN, auto-detected)
  const translateMut = useMutation({
    mutationFn: () => translateText(draft.trim()),
    onSuccess: ({ translated }) => { if (translated) setDraft(translated); },
  });

  // Optimistic per-chat mode so the toggle reacts instantly
  const [optimisticMode, setOptimisticMode] = useState<Record<string, 'ai' | 'human'>>({});

  const modeMut = useMutation({
    mutationFn: ({ jid, mode }: { jid: string; mode: 'ai' | 'human' }) => setConversationMode(jid, mode),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['conversations'] });
      qc.invalidateQueries({ queryKey: ['conversation', selected] });
    },
  });

  const setMode = (jid: string, mode: 'ai' | 'human') => {
    setOptimisticMode(m => ({ ...m, [jid]: mode }));
    modeMut.mutate({ jid, mode });
  };

  const conversations = convData?.conversations ?? [];
  const messages = msgData?.messages ?? [];
  const currentConv = conversations.find(c => c.jid === selected);
  const serverMode = msgData?.mode ?? currentConv?.mode;
  const effectiveMode = (selected && optimisticMode[selected]) ?? serverMode;
  const isHuman = effectiveMode === 'human';

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // Auto-select first conversation
  useEffect(() => {
    if (!selected && conversations.length) setSelected(conversations[0].jid);
  }, [conversations, selected]);

  return (
    <div className="flex h-screen min-h-0">
      {/* Conversation list */}
      <div className="w-72 border-r border-app-border bg-app-surface flex flex-col shrink-0 min-h-0">
        <div className="px-4 py-3 border-b border-app-border">
          <h2 className="font-semibold flex items-center gap-2">
            <MessageCircle size={16} /> {t('conversations')}
          </h2>
        </div>
        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && (
            <p className="text-xs text-app-muted text-center mt-8 px-4">{t('no_conversations')}</p>
          )}
          {conversations.map(c => (
            <button
              key={c.jid}
              onClick={() => setSelected(c.jid)}
              className={`w-full text-left px-4 py-3 border-b border-app-border/50 hover:bg-app-elevated/40 transition-colors ${
                selected === c.jid ? 'bg-app-elevated/60' : ''
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium truncate">{c.number}</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${
                    c.mode === 'human' ? 'bg-amber-600/20 text-amber-400' : 'bg-brand-emerald/15 text-brand-emeraldLight'
                  }`}>
                    {c.mode === 'human' ? t('mode_human') : t('mode_ai')}
                  </span>
                  {c.unread > 0 && selected !== c.jid && (
                    <span className="bg-brand-gold text-white text-xs px-1.5 rounded-full">{c.unread}</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-app-muted truncate mt-0.5">
                {c.lastDirection === 'out' ? '↩ ' : ''}{c.lastMessage}
              </p>
            </button>
          ))}
        </div>
      </div>

      {/* Chat panel */}
      <div className="flex-1 flex flex-col min-h-0">
        {selected ? (
          <>
            <div className="px-5 py-3 border-b border-app-border bg-app-surface flex items-center justify-between">
              <span className="font-medium">{currentConv?.number ?? selected}</span>
              {/* Per-conversation AI / Human toggle */}
              <div className="flex gap-1 bg-app-elevated rounded-lg p-0.5">
                <button
                  onClick={() => setMode(selected, 'ai')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    !isHuman ? 'bg-brand-emerald text-white' : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  <Bot size={12} /> {t('mode_ai')}
                </button>
                <button
                  onClick={() => setMode(selected, 'human')}
                  className={`flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                    isHuman ? 'bg-amber-600 text-white' : 'text-app-muted hover:text-app-text'
                  }`}
                >
                  <User size={12} /> {t('mode_human')}
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-3 min-h-0 wa-chat-bg">
              {messages.map((m: LoggedMessage, i: number) => (
                <Bubble key={i} message={m} />
              ))}
              <div ref={endRef} />
            </div>

            {/* Reply box */}
            <div className="border-t border-app-border bg-app-surface p-3">
              <p className={`text-xs mb-2 ${isHuman ? 'text-amber-400/80' : 'text-app-muted'}`}>
                {isHuman ? t('human_mode_active') : t('ai_mode_active')}
              </p>
              <div className="flex gap-2">
                <input
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && isHuman && draft.trim()) sendMut.mutate(); }}
                  placeholder={isHuman ? t('type_reply') : t('ai_mode_disabled_input')}
                  disabled={!isHuman}
                  className="flex-1 bg-app-elevated border border-app-border rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-app-muted disabled:opacity-50 disabled:cursor-not-allowed"
                />
                {isHuman && (
                  <button
                    onClick={() => translateMut.mutate()}
                    disabled={!draft.trim() || translateMut.isPending}
                    title={t('translate')}
                    className="bg-app-elevated border border-app-border hover:border-app-muted disabled:opacity-40 text-app-text px-3 rounded-lg flex items-center gap-2 text-sm"
                  >
                    <Languages size={14} className={translateMut.isPending ? 'animate-pulse' : ''} />
                    {translateMut.isPending ? t('translating') : t('translate')}
                  </button>
                )}
                <button
                  onClick={() => sendMut.mutate()}
                  disabled={!isHuman || !draft.trim() || sendMut.isPending}
                  className="bg-brand-emerald hover:bg-brand-emeraldDark disabled:opacity-40 disabled:cursor-not-allowed text-white px-4 rounded-lg flex items-center gap-2 text-sm"
                >
                  <Send size={14} /> {t('send')}
                </button>
              </div>
              {sendMut.isError && <p className="text-red-400 text-xs mt-2">{(sendMut.error as Error).message}</p>}
              {translateMut.isError && <p className="text-red-400 text-xs mt-2">{(translateMut.error as Error).message}</p>}
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-app-muted text-sm">
            {t('select_conversation')}
          </div>
        )}
      </div>
    </div>
  );
}

function Bubble({ message }: { message: LoggedMessage }) {
  const { t } = useI18n();
  const isIn = message.direction === 'in';
  const viaLabel = message.via === 'ai' ? 'AI' : message.via === 'human' ? t('you') : message.via === 'guest' ? t('guest') : 'System';
  // WhatsApp-style bubbles: incoming = white/surface, outgoing = green (DCF8C6 in light)
  const bubbleClass = isIn
    ? 'bg-app-surface text-app-text shadow-sm'
    : 'bg-wa-light text-[#111b21] dark:bg-wa-dark dark:text-white shadow-sm';
  return (
    <div className={`flex ${isIn ? 'justify-start' : 'justify-end'}`}>
      <div className={`max-w-[75%] rounded-lg px-3 py-1.5 ${bubbleClass}`}>
        <div className="flex items-center gap-1.5 mb-0.5 opacity-60 text-[10px]">
          {message.via === 'ai' && <Bot size={10} />}
          {message.via === 'human' && <User size={10} />}
          <span>{viaLabel}</span>
          <span>· {new Date(message.timestamp).toLocaleTimeString()}</span>
        </div>
        <p className="text-sm whitespace-pre-wrap break-words">{message.text}</p>
      </div>
    </div>
  );
}
