// components/DebugOverlay.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { supabase } from '~/utils/supabase';

export function DebugOverlay() {
  const [isExpanded, setIsExpanded] = useState(false);
  const [channels, setChannels] = useState<string[]>([]);
  const [eventCount, setEventCount] = useState(0);

  useEffect(() => {
    // Poll for active channels every second
    const interval = setInterval(() => {
      // Get all active channels from Supabase client
      const activeChannels = supabase.getChannels();
      const channelNames = activeChannels.map(ch => ch.topic);
      setChannels(channelNames);
    }, 1000);

    // Listen for console logs to count events
    const originalLog = console.log;
    console.log = (...args) => {
      const message = args.join(' ');
      if (message.includes('event #')) {
        setEventCount(prev => prev + 1);
      }
      originalLog(...args);
    };

    return () => {
      clearInterval(interval);
      console.log = originalLog;
    };
  }, []);

  if (!__DEV__) return null; // Only show in development

  return (
    <View style={styles.container}>
      <Pressable 
        style={styles.toggleButton}
        onPress={() => setIsExpanded(!isExpanded)}>
        <Text style={styles.toggleText}>
          🔴 {channels.length} subs | {eventCount} events
        </Text>
      </Pressable>

      {isExpanded && (
        <View style={styles.expandedView}>
          <Text style={styles.title}>Active Subscriptions ({channels.length})</Text>
          {channels.length === 0 ? (
            <Text style={styles.emptyText}>No active subscriptions</Text>
          ) : (
            channels.map((channel, idx) => (
              <Text key={idx} style={styles.channelText}>
                • {channel}
              </Text>
            ))
          )}
          <Text style={styles.eventText}>Total events received: {eventCount}</Text>
          <Pressable 
            style={styles.clearButton}
            onPress={() => setEventCount(0)}>
            <Text style={styles.clearText}>Reset Counter</Text>
          </Pressable>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 50,
    right: 10,
    zIndex: 999999,
  },
  toggleButton: {
    backgroundColor: 'rgba(255, 0, 0, 0.8)',
    padding: 8,
    borderRadius: 8,
    minWidth: 120,
  },
  toggleText: {
    color: 'white',
    fontSize: 11,
    fontWeight: 'bold',
  },
  expandedView: {
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    padding: 12,
    borderRadius: 8,
    marginTop: 4,
    maxWidth: 300,
    maxHeight: 400,
  },
  title: {
    color: 'white',
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  emptyText: {
    color: '#aaa',
    fontSize: 12,
    fontStyle: 'italic',
  },
  channelText: {
    color: '#0f0',
    fontSize: 10,
    fontFamily: 'monospace',
    marginBottom: 4,
  },
  eventText: {
    color: 'yellow',
    fontSize: 12,
    marginTop: 8,
    marginBottom: 8,
  },
  clearButton: {
    backgroundColor: '#444',
    padding: 6,
    borderRadius: 4,
    alignItems: 'center',
  },
  clearText: {
    color: 'white',
    fontSize: 11,
  },
});