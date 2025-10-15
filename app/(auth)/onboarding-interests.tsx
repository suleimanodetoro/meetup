// app/(auth)/onboarding-interests.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, SafeAreaView, ScrollView, Alert, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { SORTED_INTERESTS as INTERESTS, type InterestId } from '~/utils/constants';

export default function OnboardingInterestsScreen() {
  const params = useLocalSearchParams();
  const [selectedInterests, setSelectedInterests] = useState<InterestId[]>([]);
  const [matchCount, setMatchCount] = useState(102192);

  const toggleInterest = (interestId: InterestId) => {
    setSelectedInterests((prev) => {
      if (prev.includes(interestId)) return prev.filter((id) => id !== interestId);
      if (prev.length < 5) {
        setMatchCount((c) => c + Math.floor(Math.random() * 5000));
        return [...prev, interestId];
      }
      Alert.alert('Maximum Interests', 'You can select up to 5 interests');
      return prev;
    });
  };

  const handleContinue = () => {
    router.push({
      pathname: '/onboarding-pause',
      params: { ...params, interests: JSON.stringify(selectedInterests) },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/onboarding-pause',
      params: { ...params, interests: JSON.stringify([]) },
    });
  };

  return (
    <LinearGradient colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.headerBtn}>
            <Text style={{ fontSize: 28 }}>←</Text>
          </Pressable>
          <Pressable onPress={handleSkip} style={styles.headerBtn}>
            <Text style={styles.skip}>Skip</Text>
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={{ paddingBottom: 100 }}
          showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 30 }}>
            <Text style={styles.title}>select up to 5{'\n'}interests</Text>
            <Text style={styles.subtitle}>connect with people who share your vibe 🤝</Text>

            <View style={{ position: 'absolute', right: 20, top: 0 }}>
              <Text style={{ fontSize: 56 }}>🏄‍♀️</Text>
            </View>

            <View className="mt-2 flex-row flex-wrap">
              {INTERESTS.map((i) => {
                const selected = selectedInterests.includes(i.id);
                return (
                  <Pressable
                    key={i.id}
                    onPress={() => toggleInterest(i.id)}
                    className={[
                      'mb-3 mr-3 w-auto shrink-0 grow-0 self-start',
                      'flex-row items-center rounded-full border px-3 py-3',
                      selected ? 'border-[#007AFF] bg-[#007AFF]' : 'border-[#E0E0E0] bg-white',
                    ].join(' ')}>
                    <Text className="mr-2 text-[17px]">{i.emoji}</Text>
                    <Text
                      className={[
                        'text-[14px] font-semibold',
                        selected ? 'text-white' : 'text-[#333]',
                      ].join(' ')}>
                      {i.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        </ScrollView>

        {/* Bottom Bar */}
        <View style={styles.bottomBar}>
          <Pressable
            onPress={handleContinue}
            disabled={selectedInterests.length === 0}
            style={[
              styles.continueBtn,
              selectedInterests.length === 0 && styles.continueBtnDisabled,
            ]}>
            <Text style={styles.continueBtnTxt}>Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  headerBtn: {
    padding: 10,
  },
  skip: {
    fontSize: 16,
    color: '#666',
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
    marginTop: 20,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 30,
  },
  bottomBar: {
    paddingHorizontal: 30,
    paddingVertical: 20,
    backgroundColor: 'transparent',
  },
  continueBtn: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  continueBtnDisabled: {
    backgroundColor: '#ccc',
  },
  continueBtnTxt: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
