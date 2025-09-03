// components/UpsellModal.tsx
import React from 'react';
import {
  Modal,
  View,
  Text,
  Pressable,
  StyleSheet,
  SafeAreaView,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';

interface UpsellModalProps {
  visible: boolean;
  onDismiss: () => void;
  onSubscribe: () => void;
}

export default function UpsellModal({ visible, onDismiss, onSubscribe }: UpsellModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
    >
      <LinearGradient
        colors={['#4A90E2', '#667eea']}
        style={styles.container}
      >
        <SafeAreaView style={styles.content}>
          {/* Close Button */}
          <Pressable onPress={onDismiss} style={styles.closeButton}>
            <Ionicons name="close" size={28} color="white" />
          </Pressable>

          {/* Content */}
          <View style={styles.main}>
            <View style={styles.iconContainer}>
              <Ionicons name="lock-open" size={64} color="white" />
            </View>
            
            <Text style={styles.title}>Unlock All Travelers</Text>
            <Text style={styles.subtitle}>
              Connect with unlimited travelers and see who's visiting your destinations
            </Text>

            {/* Benefits */}
            <View style={styles.benefits}>
              {[
                'See all travelers in any city',
                'Send unlimited messages',
                'Get priority visibility',
                'Access exclusive events',
              ].map((benefit, index) => (
                <View key={index} style={styles.benefit}>
                  <Ionicons name="checkmark-circle" size={24} color="#4CAF50" />
                  <Text style={styles.benefitText}>{benefit}</Text>
                </View>
              ))}
            </View>

            {/* CTA Buttons */}
            <Pressable onPress={onSubscribe} style={styles.ctaButton}>
              <Text style={styles.ctaText}>Start Free Trial</Text>
            </Pressable>
            
            <Pressable onPress={onDismiss} style={styles.secondaryButton}>
              <Text style={styles.secondaryText}>Maybe Later</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: 60,
    right: 20,
    zIndex: 1,
    padding: 8,
  },
  main: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  iconContainer: {
    marginBottom: 32,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 16,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 18,
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 40,
  },
  benefits: {
    marginBottom: 48,
  },
  benefit: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  benefitText: {
    fontSize: 16,
    color: 'white',
    marginLeft: 12,
  },
  ctaButton: {
    backgroundColor: 'white',
    paddingVertical: 18,
    paddingHorizontal: 48,
    borderRadius: 30,
    marginBottom: 16,
  },
  ctaText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#4A90E2',
  },
  secondaryButton: {
    paddingVertical: 12,
  },
  secondaryText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
  },
});