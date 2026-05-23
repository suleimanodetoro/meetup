import {
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { ChatShell, useChat, type ChatHeader } from '~/modules/chat';

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
  const other = header.kind === 'dm' ? header.other : null;
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
        <Image
          source={{
            uri: other?.avatar_url || 'https://via.placeholder.com/40',
          }}
          style={styles.headerAvatar}
        />
        <Text style={styles.headerTitle} numberOfLines={1}>
          {other?.full_name || 'Direct Message'}
        </Text>
      </Pressable>
      <View style={styles.headerButton}>
        <Ionicons name="information-circle-outline" size={24} color="#000" />
      </View>
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
