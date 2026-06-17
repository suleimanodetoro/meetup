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

export default function GroupChatScreen() {
  const { eventId } = useLocalSearchParams<{ eventId: string }>();
  const chat = useChat({
    kind: 'event',
    eventId: Number(eventId),
  });

  return (
    <ChatShell
      chat={chat}
      onPressUser={(userId) => router.push(`/profile/${userId}`)}
      renderHeader={(header) => (
        <GroupHeader header={header} eventId={String(eventId)} />
      )}
    />
  );
}

function GroupHeader({
  header,
  eventId,
}: {
  header: ChatHeader;
  eventId: string;
}) {
  const event = header.kind === 'event' ? header.event : null;
  const participantCount =
    header.kind === 'event' ? header.participants.length : 0;

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
        style={styles.headerInfo}
        onPress={() => router.push(`/event/${eventId}`)}
      >
        {event?.image_uri ? (
          <AppImage source={{ uri: event.image_uri }} style={styles.headerAvatar} />
        ) : (
          <InitialsAvatar
            name={event?.title || 'Group Chat'}
            id={String(eventId)}
            size={40}
            style={styles.headerAvatar}
          />
        )}
        <View style={styles.headerText}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {event?.title || 'Group Chat'}
          </Text>
          <Text style={styles.headerSubtitle}>
            {participantCount} members
          </Text>
        </View>
      </Pressable>

      <View style={styles.headerButton}>
        <Ionicons name="ellipsis-vertical" size={24} color="#000" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f0f0f0',
  },
  headerButton: { padding: 4 },
  headerInfo: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
  },
  headerAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 16, fontWeight: '600', color: '#000' },
  headerSubtitle: { fontSize: 12, color: '#666', marginTop: 2 },
});
