import React, { useEffect, useRef } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { format } from 'date-fns';
import { useAuth } from '~/app/contexts/AuthProvider';
import type { MessageWithDetails, Profile } from '~/types/messaging';
import type { ChatController, ChatHeader } from './useChat';

export type RenderMessageArgs = {
  message: MessageWithDetails;
  isOwn: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  prev: MessageWithDetails | null;
  onPressUser?: (userId: string) => void;
};

export interface ChatShellProps {
  chat: ChatController;
  renderHeader: (header: ChatHeader) => React.ReactElement | null;
  /**
   * Custom message bubble renderer. Receives precomputed grouping decisions
   * (showAvatar, showSenderName) so the override doesn't have to re-derive them.
   */
  renderMessage?: (args: RenderMessageArgs) => React.ReactElement;
  /** Tap-to-profile callback. No-op if omitted. */
  onPressUser?: (userId: string) => void;
  /** Default: false for DM, true for event chats. */
  groupAvatarsBySender?: boolean;
  /** Default: false for DM, true for event chats. */
  showSenderName?: boolean;
}

export function ChatShell(props: ChatShellProps) {
  const { chat, renderHeader, onPressUser } = props;
  const { session } = useAuth();
  const meId = session?.user?.id ?? null;
  const flatListRef = useRef<FlatList>(null);
  const lastSendErrorRef = useRef(chat.lastSendError);

  useEffect(() => {
    if (
      chat.lastSendError &&
      chat.lastSendError !== lastSendErrorRef.current
    ) {
      Alert.alert(
        "Couldn't send",
        'Your message has been restored. Try again.',
      );
    }
    lastSendErrorRef.current = chat.lastSendError;
  }, [chat.lastSendError]);

  const groupAvatars =
    props.groupAvatarsBySender ?? chat.header.kind === 'event';
  const showSenderName =
    props.showSenderName ?? chat.header.kind === 'event';

  const renderItem = ({
    item,
    index,
  }: {
    item: MessageWithDetails;
    index: number;
  }) => {
    const prev = index > 0 ? chat.messages[index - 1] : null;
    const isOwn = item.user_id === meId;
    const showAvatar =
      !isOwn && (!groupAvatars || !prev || prev.user_id !== item.user_id);
    const showName =
      !isOwn &&
      showSenderName &&
      (!prev || prev.user_id !== item.user_id);

    if (props.renderMessage) {
      return props.renderMessage({
        message: item,
        isOwn,
        showAvatar,
        showSenderName: showName,
        prev,
        onPressUser,
      });
    }

    return (
      <DefaultBubble
        message={item}
        isOwn={isOwn}
        showAvatar={showAvatar}
        showSenderName={showName}
        onPressUser={onPressUser}
      />
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {renderHeader(chat.header)}

      {chat.status.phase === 'loading' && (
        <View style={styles.loadingBody}>
          <ActivityIndicator size="large" color="#007AFF" />
        </View>
      )}

      {chat.status.phase === 'error' && (
        <View style={styles.errorBody}>
          <Text style={styles.errorTitle}>
            {chat.status.code === 'not_found'
              ? 'Conversation not found'
              : "Couldn't load this chat"}
          </Text>
          <Pressable style={styles.retryButton} onPress={chat.status.retry}>
            <Text style={styles.retryButtonText}>Retry</Text>
          </Pressable>
        </View>
      )}

      {chat.status.phase === 'ready' && (
        <KeyboardAvoidingView
          style={styles.body}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <FlatList
            ref={flatListRef}
            data={chat.messages}
            renderItem={renderItem}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={styles.messagesList}
            keyboardShouldPersistTaps="handled"
            onContentSizeChange={() =>
              flatListRef.current?.scrollToEnd({ animated: true })
            }
            ListFooterComponent={<TypingRow users={chat.typingUsers} />}
          />

          <Composer
            value={chat.draft}
            onChange={chat.setDraft}
            onSend={chat.send}
            sending={chat.sending}
          />
        </KeyboardAvoidingView>
      )}
    </SafeAreaView>
  );
}

function DefaultBubble({
  message,
  isOwn,
  showAvatar,
  showSenderName,
  onPressUser,
}: {
  message: MessageWithDetails;
  isOwn: boolean;
  showAvatar: boolean;
  showSenderName: boolean;
  onPressUser?: (userId: string) => void;
}) {
  return (
    <View style={[styles.messageRow, isOwn && styles.messageRowOwn]}>
      {!isOwn && showAvatar && (
        <Pressable
          onPress={() => onPressUser?.(message.user_id)}
          hitSlop={6}
        >
          <Image
            source={{
              uri:
                message.user?.avatar_url ||
                'https://via.placeholder.com/32',
            }}
            style={styles.avatar}
          />
        </Pressable>
      )}
      {!isOwn && !showAvatar && <View style={styles.avatarPlaceholder} />}

      <View style={[styles.bubble, isOwn && styles.bubbleOwn]}>
        {!isOwn && showSenderName && (
          <Text style={styles.senderName}>
            {message.user?.full_name ?? 'Unknown'}
          </Text>
        )}

        {message.reply_to?.content ? (
          <View style={styles.replyQuote}>
            <Text style={styles.replyName}>
              {message.reply_to.user?.full_name ?? 'Unknown'}
            </Text>
            <Text style={styles.replyText} numberOfLines={1}>
              {message.reply_to.content}
            </Text>
          </View>
        ) : null}

        <Text style={[styles.text, isOwn && styles.textOwn]}>
          {message.content}
        </Text>
        <Text style={[styles.time, isOwn && styles.timeOwn]}>
          {format(new Date(message.created_at), 'HH:mm')}
        </Text>
      </View>
    </View>
  );
}

function TypingRow({ users }: { users: Profile[] }) {
  if (users.length === 0) return null;
  const names = users
    .slice(0, 2)
    .map((u) => u.full_name?.split(' ')[0])
    .filter(Boolean)
    .join(', ');
  const text =
    users.length > 2
      ? `${names} and ${users.length - 2} others are typing…`
      : `${names} ${users.length === 1 ? 'is' : 'are'} typing…`;

  return (
    <View style={styles.typingRow}>
      <View style={styles.dots}>
        <View style={styles.dot} />
        <View style={styles.dot} />
        <View style={styles.dot} />
      </View>
      <Text style={styles.typingText}>{text}</Text>
    </View>
  );
}

function Composer({
  value,
  onChange,
  onSend,
  sending,
}: {
  value: string;
  onChange: (next: string) => void;
  onSend: () => void;
  sending: boolean;
}) {
  const disabled = !value.trim() || sending;
  return (
    <View style={styles.composer}>
      <TextInput
        style={styles.input}
        placeholder="Type a message…"
        placeholderTextColor="#999"
        value={value}
        onChangeText={onChange}
        multiline
        maxLength={1000}
        editable={!sending}
      />
      <Pressable
        style={[styles.sendButton, disabled && styles.sendButtonDisabled]}
        onPress={onSend}
        disabled={disabled}
      >
        {sending ? (
          <ActivityIndicator size="small" color="#007AFF" />
        ) : (
          <Ionicons
            name="send"
            size={20}
            color={disabled ? '#ccc' : '#007AFF'}
          />
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff' },
  body: { flex: 1 },
  loadingBody: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  errorBody: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
    gap: 12,
  },
  errorTitle: { fontSize: 16, color: '#333', textAlign: 'center' },
  retryButton: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#007AFF',
  },
  retryButtonText: { color: '#fff', fontWeight: '600' },
  messagesList: { paddingVertical: 16 },
  messageRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 4,
  },
  messageRowOwn: { justifyContent: 'flex-end' },
  avatar: { width: 32, height: 32, borderRadius: 16, marginRight: 8 },
  avatarPlaceholder: { width: 32, marginRight: 8 },
  bubble: {
    maxWidth: '75%',
    backgroundColor: '#f0f0f0',
    borderRadius: 16,
    padding: 12,
  },
  bubbleOwn: { backgroundColor: '#007AFF' },
  senderName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#007AFF',
    marginBottom: 4,
  },
  replyQuote: {
    backgroundColor: 'rgba(0,0,0,0.05)',
    borderLeftWidth: 3,
    borderLeftColor: '#007AFF',
    padding: 8,
    marginBottom: 8,
    borderRadius: 4,
  },
  replyName: { fontSize: 12, fontWeight: '600', color: '#666' },
  replyText: { fontSize: 12, color: '#666', marginTop: 2 },
  text: { fontSize: 15, color: '#000', lineHeight: 20 },
  textOwn: { color: '#fff' },
  time: { fontSize: 11, color: '#666', marginTop: 4 },
  timeOwn: { color: 'rgba(255,255,255,0.7)' },
  typingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dots: { flexDirection: 'row', marginRight: 8 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#666',
    marginHorizontal: 2,
    opacity: 0.6,
  },
  typingText: { fontSize: 12, color: '#666', fontStyle: 'italic' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
    borderTopWidth: 1,
    borderTopColor: '#f0f0f0',
  },
  input: {
    flex: 1,
    minHeight: 40,
    maxHeight: 100,
    backgroundColor: '#f5f5f5',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 15,
    marginRight: 8,
  },
  sendButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 20,
  },
  sendButtonDisabled: { opacity: 0.5 },
});
