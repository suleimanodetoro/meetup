// components/ErrorBoundary.tsx
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { GradientButton } from '~/components/GradientButton';

type Props = { children: React.ReactNode };
type State = { hasError: boolean };

/**
 * App-wide error boundary. Without it, any render-time throw (e.g. a malformed
 * RPC payload feeding an indexed access) white-screens the entire app with no
 * recovery — and that's a hard App Review rejection. This catches the throw,
 * shows a recover screen, and lets the user retry.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    // Visible in dev; stripped from production bundles by transform-remove-console.
    console.error('[ErrorBoundary] caught:', error, info);
    // TODO(Q1/Sentry): once @sentry/react-native is installed + initialised,
    // report here via Sentry.captureException(error). Deliberately omitted until
    // the SDK is installed — referencing an uninstalled module breaks the Metro
    // bundle (the same failure mode as the expo-store-review crash).
  }

  reset = () => this.setState({ hasError: false });

  render() {
    if (!this.state.hasError) return this.props.children;
    return (
      <View style={styles.container}>
        <Text style={styles.title}>Something went wrong</Text>
        <Text style={styles.body}>
          The app hit an unexpected error. Try again — if it keeps happening, restart the app.
        </Text>
        <GradientButton label="Try again" onPress={this.reset} style={{ alignSelf: 'center' }} />
      </View>
    );
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    backgroundColor: '#FFFFFF',
  },
  title: { fontSize: 22, fontWeight: '800', color: '#111111', marginBottom: 10 },
  body: {
    fontSize: 15,
    lineHeight: 21,
    color: '#6B7280',
    textAlign: 'center',
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#007AFF',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 14,
  },
  buttonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
});
