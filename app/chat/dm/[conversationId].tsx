import {
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppImage } from '~/components/AppImage';
import { Ionicons } from '@expo/vector-icons';
import { InitialsAvatar } from '~/components/InitialsAvatar';
import { router, useLocalSearchParams } from 'expo-router';
import { ChatShell, useChat, type ChatHeader } from '~/modules/chat';
import { useAuth } from '~/contexts/AuthProvider';
import { presentUserSafetyActions } from '~/modules/safety';

export default function DMChatScreen() {
  const { conversationId } = useLocalSearchParams<{ conversationId: string }>();
  const chat = useChat({
    kind: 'dm',
    conversationId: Number(conversationId),
  });

  return (
    <ChatShell
      chat={chat}
      onPressUser={(userId) => router.push(`/profile/${userId}`)}
      renderHeader={(header) => <DMHeader header={header} />}
    />
  );
}

function DMHeader({ header }: { header: ChatHeader }) {
  const { session } = useAuth();
  const other = header.kind === 'dm' ? header.other : null;

  const openSafetyActions = () => {
    if (!session?.user?.id || !other?.id) return;
    presentUserSafetyActions({
      currentUserId: session.user.id,
      targetUserId: other.id,
      targetName: other.full_name,
      onBlocked: () => router.back(),
    });
  };

  return (
    <View style={styles.header}>
      <Pressable
        onPress={() => router.back()}
        style={styles.headerButton}
        hitSlop={6}
      >
        <Ionicons name="arrow-back" size={24} color="#000" />
      </Pressable>
      <Pressable
        style={styles.headerCenter}
        onPress={() => other?.id && router.push(`/profile/${other.id}`)}
      >
        {other?.avatar_url ? (
          <AppImage source={{ uri: other.avatar_url }} style={styles.headerAvatar} />
        ) : (
          <InitialsAvatar
            name={other?.full_name || 'Direct Message'}
            id={other?.id}
            size={40}
            style={styles.headerAvatar}
          />
        )}
        <Text style={styles.headerTitle} numberOfLines={1}>
          {other?.full_name || 'Direct Message'}
        </Text>
      </Pressable>
      <Pressable
        onPress={openSafetyActions}
        style={styles.headerButton}
        hitSlop={6}
        disabled={!other?.id}
      >
        <Ionicons name="ellipsis-horizontal" size={24} color="#000" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  headerButton: { padding: 4 },
  headerCenter: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
    marginRight: 8,
  },
  headerTitle: { fontSize: 16, fontWeight: '600', flex: 1 },
});
