// app/(auth)/onboarding-languages.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SafeAreaView,
  FlatList,
  ScrollView,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

const LANGUAGES = [
  { code: 'ak', name: 'Akan', flag: '🇬🇭' },
  { code: 'am', name: 'Amharic', flag: '🇪🇹' },
  { code: 'ar', name: 'Arabic', flag: '🇸🇦' },
  { code: 'az', name: 'Azerbaijani', flag: '🇦🇿' },
  { code: 'be', name: 'Belarusian', flag: '🇧🇾' },
  { code: 'bn', name: 'Bengali', flag: '🇧🇩' },
  { code: 'my', name: 'Burmese', flag: '🇲🇲' },
  { code: 'zh', name: 'Mandarin Chinese', flag: '🇨🇳' },
  { code: 'hr', name: 'Serbo-Croatian', flag: '🇷🇸' }, // ISO 639-1 code for Croatian/Serbian
  { code: 'cs', name: 'Czech', flag: '🇨🇿' },
  { code: 'nl', name: 'Dutch', flag: '🇳🇱' },
  { code: 'en', name: 'English', flag: '🇬🇧' },
  { code: 'fa', name: 'Persian (Farsi)', flag: '🇮🇷' },
  { code: 'fr', name: 'French', flag: '🇫🇷' },
  { code: 'de', name: 'German', flag: '🇩🇪' },
  { code: 'el', name: 'Greek', flag: '🇬🇷' },
  { code: 'gu', name: 'Gujarati', flag: '🇮🇳' },
  { code: 'ht', name: 'Haitian Creole', flag: '🇭🇹' },
  { code: 'ha', name: 'Hausa', flag: '🇳🇬' },
  { code: 'he', name: 'Hebrew', flag: '🇮🇱' }, // not in your ranking, optional to remove
  { code: 'hi', name: 'Hindi', flag: '🇮🇳' },
  { code: 'hu', name: 'Hungarian', flag: '🇭🇺' },
  { code: 'ig', name: 'Igbo', flag: '🇳🇬' },
  { code: 'id', name: 'Indonesian', flag: '🇮🇩' },
  { code: 'it', name: 'Italian', flag: '🇮🇹' },
  { code: 'ja', name: 'Japanese', flag: '🇯🇵' },
  { code: 'jv', name: 'Javanese', flag: '🇮🇩' },
  { code: 'kk', name: 'Kazakh', flag: '🇰🇿' },
  { code: 'kn', name: 'Kannada', flag: '🇮🇳' },
  { code: 'km', name: 'Khmer', flag: '🇰🇭' },
  { code: 'ko', name: 'Korean', flag: '🇰🇷' },
  { code: 'ml', name: 'Malayalam', flag: '🇮🇳' },
  { code: 'ms', name: 'Malay', flag: '🇲🇾' },
  { code: 'mr', name: 'Marathi', flag: '🇮🇳' },
  { code: 'ne', name: 'Nepali', flag: '🇳🇵' },
  { code: 'or', name: 'Odia', flag: '🇮🇳' },
  { code: 'pa', name: 'Punjabi', flag: '🇮🇳' },
  { code: 'ps', name: 'Pashto', flag: '🇦🇫' },
  { code: 'pl', name: 'Polish', flag: '🇵🇱' },
  { code: 'pt', name: 'Portuguese', flag: '🇵🇹' },
  { code: 'ro', name: 'Romanian', flag: '🇷🇴' },
  { code: 'ru', name: 'Russian', flag: '🇷🇺' },
  { code: 'si', name: 'Sinhala', flag: '🇱🇰' },
  { code: 'so', name: 'Somali', flag: '🇸🇴' },
  { code: 'es', name: 'Spanish', flag: '🇪🇸' },
  { code: 'sv', name: 'Swedish', flag: '🇸🇪' },
  { code: 'ta', name: 'Tamil', flag: '🇮🇳' },
  { code: 'te', name: 'Telugu', flag: '🇮🇳' },
  { code: 'th', name: 'Thai', flag: '🇹🇭' },
  { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
  { code: 'tr', name: 'Turkish', flag: '🇹🇷' },
  { code: 'uk', name: 'Ukrainian', flag: '🇺🇦' },
  { code: 'ur', name: 'Urdu', flag: '🇵🇰' },
  { code: 'uz', name: 'Uzbek', flag: '🇺🇿' },
  { code: 'vi', name: 'Vietnamese', flag: '🇻🇳' },
  { code: 'yo', name: 'Yoruba', flag: '🇳🇬' },
  { code: 'zu', name: 'Zulu', flag: '🇿🇦' }
];

export default function OnboardingLanguagesScreen() {
  const params = useLocalSearchParams();
  const [selectedLanguages, setSelectedLanguages] = useState<string[]>(['en']);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredLanguages = useMemo(() => {
    if (!searchQuery) {
      return LANGUAGES;
    }
    return LANGUAGES.filter(lang =>
      lang.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const toggleLanguage = (code: string) => {
    setSelectedLanguages((prev) => {
      if (prev.includes(code)) {
        // Don't allow deselecting if it's the only language
        if (prev.length === 1) return prev;
        return prev.filter((c) => c !== code);
      } else {
        return [...prev, code];
      }
    });
  };

  const handleContinue = () => {
    router.push({
      pathname: '/onboarding-bio',
      params: {
        ...params,
        languages: JSON.stringify(selectedLanguages),
      },
    });
  };

  const handleSkip = () => {
    router.push({
      pathname: '/onboarding-bio',
      params: {
        ...params,
        languages: JSON.stringify(['en']),
      },
    });
  };

  const LanguageItem = ({ item }: { item: typeof LANGUAGES[0] }) => {
    const isSelected = selectedLanguages.includes(item.code);
    
    return (
      <Pressable
        onPress={() => toggleLanguage(item.code)}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingVertical: 16,
          paddingHorizontal: 20,
          backgroundColor: isSelected ? '#E3F2FD' : 'transparent',
        }}>
        <Text style={{ fontSize: 24, marginRight: 12 }}>{item.flag}</Text>
        <Text style={{
          fontSize: 17,
          flex: 1,
          color: isSelected ? '#1976D2' : '#333',
          fontWeight: isSelected ? '600' : '400',
        }}>
          {item.name}
        </Text>
        {isSelected && (
          <Text style={{ fontSize: 20, color: '#4A90E2' }}>✓</Text>
        )}
      </Pressable>
    );
  };

  return (
    <LinearGradient
      colors={['#E8F5E9', '#C8E6C9', '#A5D6A7']}
      style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        {/* Header */}
        <View style={{ 
          flexDirection: 'row', 
          alignItems: 'center', 
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingTop: 10,
        }}>
          <Pressable onPress={() => router.back()} style={{ padding: 10 }}>
            <Text style={{ fontSize: 30 }}>←</Text>
          </Pressable>
          <Pressable onPress={handleSkip} style={{ padding: 10 }}>
            <Text style={{ fontSize: 16, color: '#666' }}>Skip</Text>
          </Pressable>
        </View>

        <View style={{ flex: 1 }}>
          {/* Title Section */}
          <View style={{ paddingHorizontal: 30, marginBottom: 20 }}>
            <Text style={{
              fontSize: 36,
              fontWeight: 'bold',
              marginBottom: 8,
            }}>
              which languages do you speak?
            </Text>
            
            <Text style={{
              fontSize: 16,
              color: '#666',
            }}>
              helps us match you with other travelers ⭐
            </Text>
          </View>

          {/* Globe decoration */}
          <View style={{ position: 'absolute', right: 30, top: 60 }}>
            <Text style={{ fontSize: 60 }}>🌐</Text>
          </View>

          {/* Search Bar */}
          <View style={{
            marginHorizontal: 30,
            marginBottom: 10,
            backgroundColor: 'white',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: '#E0E0E0',
          }}>
            <Text style={{ fontSize: 18, marginRight: 10 }}>🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search languages"
              placeholderTextColor="#9E9E9E"
              style={{
                flex: 1,
                fontSize: 16,
              }}
            />
          </View>

          {/* Languages List */}
          <FlatList
            data={filteredLanguages}
            renderItem={({ item }) => <LanguageItem item={item} />}
            keyExtractor={(item) => item.code}
            style={{
              flex: 1,
              backgroundColor: 'white',
              marginHorizontal: 30,
              borderRadius: 12,
              marginBottom: 20,
            }}
            showsVerticalScrollIndicator={false}
          />
        </View>

        {/* Continue Button */}
        <View style={{ paddingHorizontal: 30, paddingBottom: 30 }}>
          <Pressable
            onPress={handleContinue}
            style={{
              backgroundColor: '#4A90E2',
              paddingVertical: 18,
              borderRadius: 30,
              alignItems: 'center',
            }}>
            <Text style={{
              color: 'white',
              fontSize: 18,
              fontWeight: '600',
            }}>
              Continue
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}