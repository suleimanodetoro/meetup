import { ReactNode } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

export interface OnboardingFrameProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
  onSkip?: () => void;
  onContinue?: () => void;
  /** When `onContinue` is set: gates the Continue button. */
  canContinue?: boolean;
  /** When true: Continue/Skip render as disabled, Continue shows a spinner. */
  busy?: boolean;
  /** Continue label override. Defaults to "Continue". */
  continueLabel?: string;
  /** Body of the step. */
  children: ReactNode;
}

/**
 * The shared chrome of every onboarding step: gradient, safe area, back +
 * Skip header, title/subtitle, scroll body, Continue button. Owns
 * KeyboardAvoidingView so per-step bodies can ignore keyboard layout.
 */
export function OnboardingFrame({
  title,
  subtitle,
  onBack,
  onSkip,
  onContinue,
  canContinue = true,
  busy = false,
  continueLabel = 'Continue',
  children,
}: OnboardingFrameProps) {
  const continueDisabled = busy || !canContinue;

  return (
    <LinearGradient
      colors={['#E3F2FD', '#BBDEFB', '#90CAF9']}
      style={{ flex: 1 }}
    >
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <View style={headerStyle}>
            {onBack ? (
              <Pressable
                onPress={onBack}
                hitSlop={8}
                disabled={busy}
                style={{ padding: 10 }}
              >
                <Text style={{ fontSize: 30 }}>←</Text>
              </Pressable>
            ) : (
              <View style={{ width: 44 }} />
            )}
            {onSkip ? (
              <Pressable
                onPress={onSkip}
                disabled={busy}
                style={{ padding: 10 }}
              >
                <Text style={{ fontSize: 16, color: '#666' }}>Skip</Text>
              </Pressable>
            ) : (
              <View style={{ width: 44 }} />
            )}
          </View>

          <ScrollView
            contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 30 }}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
          >
            <Text
              style={{
                fontSize: 36,
                fontWeight: 'bold',
                marginTop: 20,
                marginBottom: 8,
              }}
            >
              {title}
            </Text>
            {subtitle ? (
              <Text
                style={{ fontSize: 16, color: '#666', marginBottom: 30 }}
              >
                {subtitle}
              </Text>
            ) : null}

            {children}
          </ScrollView>

          {onContinue ? (
            <View style={{ paddingHorizontal: 30, paddingBottom: 30 }}>
              <Pressable
                onPress={onContinue}
                disabled={continueDisabled}
                style={{
                  backgroundColor: continueDisabled ? '#ccc' : '#007AFF',
                  paddingVertical: 18,
                  borderRadius: 30,
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 10,
                }}
              >
                {busy ? (
                  <ActivityIndicator size="small" color="white" />
                ) : null}
                <Text
                  style={{ color: 'white', fontSize: 18, fontWeight: '600' }}
                >
                  {continueLabel}
                </Text>
              </Pressable>
            </View>
          ) : null}
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const headerStyle = {
  flexDirection: 'row' as const,
  alignItems: 'center' as const,
  justifyContent: 'space-between' as const,
  paddingHorizontal: 20,
  paddingTop: 10,
};
