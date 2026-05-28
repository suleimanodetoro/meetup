// components/auth/AuthScreen.tsx
import React from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';

import { authColors, authSpace } from '../../utils/authTheme';

interface AuthScreenProps {
  children: React.ReactNode;
  scrollable?: boolean;
  keyboardOffset?: number;
}

export default function AuthScreen({
  children,
  scrollable = true,
  keyboardOffset = 0,
}: AuthScreenProps) {
  const inner = scrollable ? (
    <ScrollView
      style={styles.scroll}
      contentContainerStyle={styles.scrollContent}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={styles.staticContent}>{children}</View>
  );

  return (
    <SafeAreaView style={styles.safe}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={keyboardOffset}
      >
        {inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
    backgroundColor: authColors.bg,
  },
  flex: {
    flex: 1,
  },
  scroll: {
    flex: 1,
    backgroundColor: authColors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    paddingHorizontal: authSpace.xl,
    paddingBottom: authSpace.xl,
  },
  staticContent: {
    flex: 1,
    paddingHorizontal: authSpace.xl,
    paddingBottom: authSpace.xl,
    backgroundColor: authColors.bg,
  },
});
