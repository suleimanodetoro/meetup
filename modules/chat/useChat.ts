import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RealtimeChannel } from '@supabase/supabase-js';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/contexts/AuthProvider';
import type { Event, MessageWithDetails, Profile } from '~/types/messaging';

export type ChatTarget =
  | { kind: 'dm'; conversationId: number }
  | { kind: 'event'; eventId: number };

export type ChatStatus =
  | { phase: 'loading' }
  | { phase: 'ready' }
  | {
      phase: 'error';
      code: 'load_failed' | 'not_found';
      cause: unknown;
      retry: () => void;
    };

export type ChatHeader =
  | { kind: 'dm'; other: Profile | null }
  | { kind: 'event'; event: Event | null; participants: Profile[] };

export type SendError = { cause: unknown; restoredDraft: string };

export interface ChatController {
  status: ChatStatus;
  messages: MessageWithDetails[];
  header: ChatHeader;
  typingUsers: Profile[];
  draft: string;
  sending: boolean;
  lastSendError: SendError | null;
  setDraft: (next: string) => void;
  send: () => Promise<void>;
  refresh: () => Promise<void>;
}

const MESSAGE_SELECT = `
  *,
  user:profiles(*),
  reply_to:messages!reply_to_id(*, user:profiles(*))
`;

function initialHeader(target: ChatTarget): ChatHeader {
  return target.kind === 'dm'
    ? { kind: 'dm', other: null }
    : { kind: 'event', event: null, participants: [] };
}

function typingTtlMs(kind: ChatTarget['kind']): number {
  return kind === 'dm' ? 3000 : 10000;
}

async function resolveConversationId(target: ChatTarget): Promise<number> {
  if (target.kind === 'dm') return target.conversationId;

  const { data, error } = await supabase
    .from('conversations')
    .select('id')
    .eq('event_id', target.eventId)
    .single();

  if (error) throw error;
  if (!data) throw new Error('not_found');
  return Number(data.id);
}

async function loadHeader(
  target: ChatTarget,
  conversationId: number,
  userId: string,
): Promise<ChatHeader> {
  if (target.kind === 'dm') {
    const { data, error } = await supabase
      .from('conversations')
      .select(
        `*, conversation_participants!inner(user_id, profiles:user_id(*))`,
      )
      .eq('id', conversationId)
      .eq('type', 'dm')
      .single();

    if (error) throw error;
    const participants = data?.conversation_participants ?? [];
    const otherEntry = participants.find((p) => p.user_id !== userId);
    return {
      kind: 'dm',
      other: (otherEntry?.profiles as unknown as Profile) ?? null,
    };
  }

  const { data, error } = await supabase
    .from('events')
    .select(`*, attendees:attendance(user:profiles(*))`)
    .eq('id', target.eventId)
    .single();

  if (error) throw error;
  const attendees = data?.attendees ?? [];
  const participants = attendees
    .map((a) => a.user as unknown as Profile | null)
    .filter((u): u is Profile => Boolean(u));
  return { kind: 'event', event: data as unknown as Event, participants };
}

async function loadMessages(
  conversationId: number,
): Promise<MessageWithDetails[]> {
  const { data, error } = await supabase
    .from('messages')
    .select(MESSAGE_SELECT)
    .eq('conversation_id', conversationId)
    .eq('is_deleted', false)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return (data ?? []) as unknown as MessageWithDetails[];
}

function markAsRead(conversationId: number, userId: string): void {
  void supabase
    .rpc('mark_conversation_as_read', {
      p_conversation_id: conversationId,
      p_user_id: userId,
    })
    .then(() => undefined);
}

function isNotFound(err: unknown): boolean {
  const code = (err as { code?: string } | null)?.code;
  return code === 'PGRST116';
}

export function useChat(target: ChatTarget): ChatController {
  const { session } = useAuth();
  const userId = session?.user?.id ?? null;

  // Stable scalar keys so the load effect doesn't re-run on every render
  // when the caller passes a new object literal for `target`.
  const targetKind = target.kind;
  const targetId =
    target.kind === 'dm' ? target.conversationId : target.eventId;

  const [status, setStatus] = useState<ChatStatus>({ phase: 'loading' });
  const [messages, setMessages] = useState<MessageWithDetails[]>([]);
  const [header, setHeader] = useState<ChatHeader>(() => initialHeader(target));
  const [typingUsers, setTypingUsers] = useState<Profile[]>([]);
  const [draft, setDraftState] = useState('');
  const [sending, setSending] = useState(false);
  const [lastSendError, setLastSendError] = useState<SendError | null>(null);
  const [retryNonce, setRetryNonce] = useState(0);

  const mountedRef = useRef(true);
  const conversationIdRef = useRef<number | null>(null);
  const channelsRef = useRef<{
    messages?: RealtimeChannel;
    typing?: RealtimeChannel;
  }>({});
  const isTypingRef = useRef(false);
  const typingTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const meProfile = useMemo<Profile | null>(() => {
    if (!userId) return null;
    return {
      id: userId,
      full_name: session?.user?.user_metadata?.full_name ?? 'You',
      avatar_url: session?.user?.user_metadata?.avatar_url ?? null,
    };
  }, [userId, session?.user?.user_metadata?.full_name, session?.user?.user_metadata?.avatar_url]);

  const teardownChannels = useCallback(() => {
    const { messages: m, typing: t } = channelsRef.current;
    if (m) {
      m.unsubscribe();
      supabase.removeChannel(m);
    }
    if (t) {
      t.unsubscribe();
      supabase.removeChannel(t);
    }
    channelsRef.current = {};
  }, []);

  const stopTypingLocal = useCallback(() => {
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }
    if (!isTypingRef.current) return;
    isTypingRef.current = false;
    const convId = conversationIdRef.current;
    if (!convId || !userId) return;
    void supabase
      .from('typing_indicators')
      .delete()
      .eq('conversation_id', convId)
      .eq('user_id', userId);
  }, [userId]);

  const refreshTypingUsers = useCallback(async () => {
    const convId = conversationIdRef.current;
    if (!convId || !userId) return;
    const { data } = await supabase
      .from('typing_indicators')
      .select('*, user:profiles(*)')
      .eq('conversation_id', convId)
      .neq('user_id', userId);
    if (!mountedRef.current) return;
    const profiles = ((data ?? []) as { user?: Profile }[])
      .map((row) => row?.user)
      .filter((u): u is Profile => Boolean(u));
    setTypingUsers(profiles);
  }, [userId]);

  const ingestIncomingMessage = useCallback(
    async (id: number) => {
      const { data } = await supabase
        .from('messages')
        .select(MESSAGE_SELECT)
        .eq('id', id)
        .single();
      if (!data || !mountedRef.current) return;
      const row = data as unknown as MessageWithDetails;
      setMessages((prev) => {
        if (prev.some((m) => m.id === row.id)) return prev;
        return [...prev, row];
      });
      if (row.user_id !== userId && conversationIdRef.current && userId) {
        markAsRead(conversationIdRef.current, userId);
      }
    },
    [userId],
  );

  // Main effect: load metadata + messages, set up channels.
  // Tear down on unmount or target change.
  useEffect(() => {
    mountedRef.current = true;
    let cancelled = false;

    // Reset state when target changes
    setStatus({ phase: 'loading' });
    setMessages([]);
    setTypingUsers([]);
    setLastSendError(null);
    setDraftState('');
    isTypingRef.current = false;
    if (typingTimerRef.current) {
      clearTimeout(typingTimerRef.current);
      typingTimerRef.current = null;
    }

    if (!userId) {
      return () => {
        cancelled = true;
        mountedRef.current = false;
        teardownChannels();
      };
    }

    const localTarget: ChatTarget =
      targetKind === 'dm'
        ? { kind: 'dm', conversationId: targetId }
        : { kind: 'event', eventId: targetId };

    setHeader(initialHeader(localTarget));

    (async () => {
      try {
        const convId = await resolveConversationId(localTarget);
        if (cancelled) return;
        conversationIdRef.current = convId;

        const [headerData, messagesData] = await Promise.all([
          loadHeader(localTarget, convId, userId),
          loadMessages(convId),
        ]);
        if (cancelled) return;

        setHeader(headerData);
        setMessages(messagesData);
        setStatus({ phase: 'ready' });
        markAsRead(convId, userId);

        // Subscribe to new messages
        const messagesChannel = supabase
          .channel(`chat-messages-${convId}`)
          .on(
            'postgres_changes',
            {
              event: 'INSERT',
              schema: 'public',
              table: 'messages',
              filter: `conversation_id=eq.${convId}`,
            },
            (payload) => {
              const newId = (payload.new as { id?: number } | null)?.id;
              if (typeof newId === 'number') void ingestIncomingMessage(newId);
            },
          )
          .subscribe();

        // Subscribe to typing indicators
        const typingChannel = supabase
          .channel(`chat-typing-${convId}`)
          .on(
            'postgres_changes',
            {
              event: '*',
              schema: 'public',
              table: 'typing_indicators',
              filter: `conversation_id=eq.${convId}`,
            },
            () => {
              void refreshTypingUsers();
            },
          )
          .subscribe();

        channelsRef.current = {
          messages: messagesChannel,
          typing: typingChannel,
        };

        // Seed initial typing list (some indicators may already be live)
        void refreshTypingUsers();
      } catch (err) {
        if (cancelled || !mountedRef.current) return;
        setStatus({
          phase: 'error',
          code: isNotFound(err) ? 'not_found' : 'load_failed',
          cause: err,
          retry: () => setRetryNonce((n) => n + 1),
        });
      }
    })();

    return () => {
      cancelled = true;
      mountedRef.current = false;
      teardownChannels();
      stopTypingLocal();
      conversationIdRef.current = null;
    };
  }, [
    targetKind,
    targetId,
    userId,
    retryNonce,
    teardownChannels,
    stopTypingLocal,
    ingestIncomingMessage,
    refreshTypingUsers,
  ]);

  const setDraft = useCallback(
    (next: string) => {
      setDraftState(next);
      if (lastSendError) setLastSendError(null);

      const convId = conversationIdRef.current;
      if (!convId || !userId) return;

      const hasText = next.length > 0;

      if (hasText && !isTypingRef.current) {
        isTypingRef.current = true;
        void supabase.from('typing_indicators').upsert({
          conversation_id: convId,
          user_id: userId,
          started_at: new Date().toISOString(),
        });
      } else if (!hasText && isTypingRef.current) {
        stopTypingLocal();
        return;
      }

      if (typingTimerRef.current) clearTimeout(typingTimerRef.current);
      if (hasText) {
        typingTimerRef.current = setTimeout(stopTypingLocal, typingTtlMs(targetKind));
      }
    },
    [userId, targetKind, lastSendError, stopTypingLocal],
  );

  const send = useCallback(async () => {
    const text = draft.trim();
    if (!text || sending || !userId || !meProfile) return;
    const convId = conversationIdRef.current;
    if (!convId) return;

    setSending(true);
    setLastSendError(null);
    setDraftState('');
    stopTypingLocal();

    const tempId = -Date.now();
    const optimistic: MessageWithDetails = {
      id: tempId,
      conversation_id: convId,
      event_id: targetKind === 'event' ? targetId : null,
      user_id: userId,
      content: text,
      created_at: new Date().toISOString(),
      reply_to_id: null,
      is_edited: false,
      is_deleted: false,
      message_type: 'text',
      user: meProfile,
      read_by: [],
    };

    setMessages((prev) => [...prev, optimistic]);

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: convId,
          event_id: targetKind === 'event' ? targetId : null,
          user_id: userId,
          content: text,
          message_type: 'text',
        })
        .select(MESSAGE_SELECT)
        .single();

      if (error || !data) throw error ?? new Error('insert returned no row');
      if (!mountedRef.current) return;

      const real = data as unknown as MessageWithDetails;
      setMessages((prev) => {
        const realAlreadyArrived = prev.some((m) => m.id === real.id);
        if (realAlreadyArrived) {
          // Realtime INSERT beat us; just drop the optimistic row.
          return prev.filter((m) => m.id !== tempId);
        }
        return prev.map((m) => (m.id === tempId ? real : m));
      });
    } catch (err) {
      if (!mountedRef.current) return;
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
      setDraftState(text);
      setLastSendError({ cause: err, restoredDraft: text });
    } finally {
      if (mountedRef.current) setSending(false);
    }
  }, [draft, sending, userId, meProfile, targetKind, targetId, stopTypingLocal]);

  const refresh = useCallback(async () => {
    const convId = conversationIdRef.current;
    if (!convId) return;
    try {
      const next = await loadMessages(convId);
      if (!mountedRef.current) return;
      setMessages(next);
    } catch {
      // refresh is best-effort; if it fails, keep what we had
    }
  }, []);

  return {
    status,
    messages,
    header,
    typingUsers,
    draft,
    sending,
    lastSendError,
    setDraft,
    send,
    refresh,
  };
}
