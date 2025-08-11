// app/(auth)/onboarding-gender.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  SafeAreaView,
  Image,
  StyleSheet,
  ScrollView,
  Platform,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const IMAGES = [
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
  'https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800',
  'https://images.unsplash.com/photo-1500530855697-b586d89ba3ee?w=800',
  'https://images.unsplash.com/photo-1557862921-37829c790f19?w=800',
  'https://images.unsplash.com/photo-1524502397800-2eeaad7c3fe5?w=800',
  'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800',
  'https://images.unsplash.com/photo-1520813792240-56fc4a3765a7?w=800',
  'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800',
  'https://images.unsplash.com/photo-1463453091185-61582044d556?w=800',
];

export default function OnboardingGenderScreen() {
  const params = useLocalSearchParams();
  const [selectedGender, setSelectedGender] = useState<string>('');

  const genderOptions = [
    { id: 'male', label: 'Male', emoji: '🙋‍♂️' },
    { id: 'female', label: 'Female', emoji: '🙋‍♀️' },
    { id: 'other', label: 'Other', emoji: '🦄' },
  ];

  const handleContinue = () => {
    if (!selectedGender) return;
    router.push({
      pathname: '/onboarding-interests',
      params: { ...params, gender: selectedGender },
    });
  };

  return (
    <LinearGradient colors={['#EFF4FF', '#F7FAFF']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} hitSlop={10}>
            <Text style={styles.backArrow}>←</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View style={styles.titleWrap}>
            <Text style={styles.title}>what's your gender?</Text>
            <Text style={styles.subtitle}>
              helps us connect you with other travelers 🤝
            </Text>
          </View>

          {/* Collage (two neat rows of pill images) */}
          <View style={styles.collage}>
            {IMAGES.slice(0, 5).map((src, i) => (
              <Image key={`row1-${i}`} source={{ uri: src }} style={styles.pillPhoto} />
            ))}
          </View>
          <View style={[styles.collage, { marginTop: 12 }]}>
            {IMAGES.slice(5, 10).map((src, i) => (
              <Image key={`row2-${i}`} source={{ uri: src }} style={styles.pillPhoto} />
            ))}
          </View>

          {/* Card container for options */}
          <View style={styles.card}>
            {genderOptions.map((o, idx) => {
              const selected = selectedGender === o.id;
              return (
                <Pressable
                  key={o.id}
                  onPress={() => setSelectedGender(o.id)}
                  style={[
                    styles.option,
                    selected && styles.optionSelected,
                    idx !== genderOptions.length - 1 && styles.optionDivider,
                  ]}
                >
                  <View style={styles.optionLeft}>
                    <Text style={styles.optionEmoji}>{o.emoji}</Text>
                    <Text style={styles.optionLabel}>{o.label}</Text>
                  </View>

                  {/* Radio */}
                  <View
                    style={[
                      styles.radioOuter,
                      selected && { borderColor: '#1B66F1' },
                    ]}
                  >
                    {selected && <View style={styles.radioInner} />}
                  </View>
                </Pressable>
              );
            })}
          </View>

          {/* bottom spacer so button isn't covered on small screens */}
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Sticky continue button */}
        <View style={styles.footer}>
          <Pressable
            onPress={handleContinue}
            disabled={!selectedGender}
            style={[
              styles.cta,
              { opacity: selectedGender ? 1 : 0.6 },
            ]}
          >
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const PILL_HEIGHT = 68;
const RADIUS = PILL_HEIGHT / 2;

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 4,
  },
  backArrow: { fontSize: 28 },
  scrollContent: {
    paddingHorizontal: 24,
  },
  titleWrap: {
    marginTop: 4,
    marginBottom: 12,
  },
  title: {
    fontSize: 34,
    lineHeight: 40,
    fontWeight: '800',
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 16,
    color: '#6B7280',
  },

  // --- Collage ---
  collage: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.95,
  },
  pillPhoto: {
    height: PILL_HEIGHT,
    width: 0,               // we’ll set flex for even spacing
    flexGrow: 1,
    flexBasis: 0,
    marginHorizontal: 4,
    borderRadius: RADIUS,   // uniform “capsule”
  },

  // --- Options card ---
  card: {
    marginTop: 18,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    paddingVertical: 6,
    paddingHorizontal: 8,
    // subtle shadow
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
      android: { elevation: 3 },
    }),
  },
  option: {
    borderRadius: 18,
    paddingVertical: 16,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  optionSelected: {
    borderWidth: 2,
    borderColor: '#1B66F1',
  },
  optionDivider: {
    marginBottom: 8,
  },
  optionLeft: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  optionEmoji: {
    fontSize: 26,
    marginRight: 12,
  },
  optionLabel: {
    fontSize: 18,
    fontWeight: '600',
  },
  radioOuter: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#D1D5DB',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#1B66F1',
  },

  // --- Footer / CTA ---
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingBottom: Platform.OS === 'ios' ? 24 : 16,
    paddingTop: 8,
    backgroundColor: 'transparent',
  },
  cta: {
    backgroundColor: '#1B66F1',
    height: 56,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
});
