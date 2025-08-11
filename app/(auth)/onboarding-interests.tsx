// app/(auth)/onboarding-interests.tsx
import React, { useState } from 'react';
import { View, Text, Pressable, SafeAreaView, ScrollView, Alert, StyleSheet } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const INTERESTS = [
  { id: 'music', label: 'Live Music & Concerts', emoji: '🎶' },
  { id: 'gaming', label: 'Gaming & Esports', emoji: '🎮' },
  { id: 'dance', label: 'Dance Nights', emoji: '💃' },
  { id: 'fitness', label: 'Group Fitness', emoji: '🏋️‍♂️' },
  { id: 'yoga', label: 'Yoga & Mindfulness', emoji: '🧘‍♀️' },
  { id: 'foodie', label: 'Foodie Adventures', emoji: '🍣' },
  { id: 'coffee', label: 'Coffee & Chill', emoji: '☕' },
  { id: 'arts', label: 'Arts & Crafts', emoji: '🎨' },
  { id: 'photography', label: 'Photography Walks', emoji: '📸' },
  { id: 'boardgames', label: 'Board Game Nights', emoji: '🎲' },
  { id: 'karaoke', label: 'Karaoke', emoji: '🎤' },
  { id: 'outdoor', label: 'Outdoor Hangouts', emoji: '🌳' },
  { id: 'volunteer', label: 'Volunteering', emoji: '🤝' },
  { id: 'film', label: 'Movie Nights', emoji: '🎬' },
  { id: 'fashion', label: 'Thrift & Fashion', emoji: '🛍️' },
  { id: 'tech', label: 'Tech Meetups', emoji: '💻' },
  { id: 'skate', label: 'Skateboarding', emoji: '🛹' },
  { id: 'sports', label: 'Pick-up Sports', emoji: '⚽' },
  { id: 'bookclub', label: 'Book Club', emoji: '📚' },
  { id: 'creative', label: 'Creative Writing', emoji: '✍️' },
  { id: 'thrill', label: 'Thrill & Adventure', emoji: '🏎️' },
].sort((a, b) => a.label.localeCompare(b.label));


export default function OnboardingInterestsScreen() {
  const params = useLocalSearchParams();
  const [selectedInterests, setSelectedInterests] = useState<string[]>([]);
  const [matchCount, setMatchCount] = useState(102192);

  const toggleInterest = (interestId: string) => {
    setSelectedInterests(prev => {
      if (prev.includes(interestId)) return prev.filter(id => id !== interestId);
      if (prev.length < 5) {
        setMatchCount(c => c + Math.floor(Math.random() * 5000));
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
    <LinearGradient colors={['#E8F5E9', '#DFF4E6', '#CFF0DA']} style={{ flex: 1 }}>
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

        <ScrollView contentContainerStyle={{ paddingBottom: 100 }} showsVerticalScrollIndicator={false}>
          <View style={{ paddingHorizontal: 30 }}>
            <Text style={styles.title}>select up to 5{'\n'}interests</Text>
            <Text style={styles.subtitle}>match with travelers that have similar interests 🤝</Text>

            <View style={{ position: 'absolute', right: 20, top: 0 }}>
              <Text style={{ fontSize: 56 }}>🏄‍♀️</Text>
            </View>

           <View className="flex-row flex-wrap mt-2">
  {INTERESTS.map((i) => {
    const selected = selectedInterests.includes(i.id);
    return (
      <Pressable
        key={i.id}
        onPress={() => toggleInterest(i.id)}
        className={[
          "w-auto self-start grow-0 shrink-0 mr-3 mb-3",
          "flex-row items-center rounded-full border px-3 py-3",
          selected ? "bg-[#4A90E2] border-[#4A90E2]" : "bg-white border-[#E0E0E0]",
        ].join(" ")}
      >
        <Text className="text-[17px] mr-2">{i.emoji}</Text>
        <Text
          className={["text-[14px] font-semibold", selected ? "text-white" : "text-[#333]"].join(" ")}
          numberOfLines={1}
          ellipsizeMode="tail"
        >
          {i.label}
        </Text>
      </Pressable>
    );
  })}
</View>


          </View>
        </ScrollView>

        {/* Bottom CTA */}
        <View style={styles.bottom}>
          <Pressable onPress={handleContinue} style={styles.cta}>
            <Text style={styles.ctaText}>Continue</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 20, paddingTop: 10, marginBottom: 12,
  },
  headerBtn: { padding: 10 },
  skip: { fontSize: 16, color: '#666' },

  title: { fontSize: 36, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, color: '#666', marginBottom: 20 },

  chipsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    // spacing with margins (gap can be flaky in RN)
    marginTop: 8,
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 25,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    backgroundColor: 'white',

    // make chips auto-width and never stretch
    flexGrow: 0,
    flexShrink: 0,
    alignSelf: 'flex-start',

    // row/column spacing
    marginRight: 12,
    marginBottom: 12,
  },
  chipSelected: {
    backgroundColor: '#4A90E2',
    borderColor: '#4A90E2',
  },
  emoji: { fontSize: 18, marginRight: 8 },
  chipLabel: { fontSize: 15, fontWeight: '600', color: '#333' },
  chipLabelSelected: { color: 'white' },

  bottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: 30, paddingBottom: 30, backgroundColor: 'transparent',
  },
  cta: {
    backgroundColor: '#4A90E2', paddingVertical: 18, borderRadius: 30, alignItems: 'center',
  },
  ctaText: { color: 'white', fontSize: 18, fontWeight: '600' },
});
