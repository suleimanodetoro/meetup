// app/(auth)/onboarding-languages.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SafeAreaView,
  FlatList,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { LANGUAGES } from '~/utils/constants';

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
          backgroundColor: isSelected ? '#E3F2FD' : 'white',
          marginHorizontal: 20,
          marginBottom: 8,
          borderRadius: 16,
          borderWidth: 2,
          borderColor: isSelected ? '#007AFF' : '#F0F0F0',
        }}>
        <View style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: isSelected ? '#007AFF' : '#F5F5F5',
          justifyContent: 'center',
          alignItems: 'center',
          marginRight: 12,
        }}>
          <Text style={{ fontSize: 20 }}>{item.flag}</Text>
        </View>
        <Text style={{
          fontSize: 17,
          flex: 1,
          color: '#333',
          fontWeight: isSelected ? '600' : '400',
        }}>
          {item.name}
        </Text>
        {isSelected && (
          <View style={{
            width: 24,
            height: 24,
            borderRadius: 12,
            backgroundColor: '#007AFF',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 14, color: 'white' }}>✓</Text>
          </View>
        )}
      </Pressable>
    );
  };

  return (
    <LinearGradient
      colors={['#E3F2FD', '#BBDEFB', '#90CAF9']}
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
          <View style={{ paddingHorizontal: 30, marginBottom: 20, marginTop: 20 }}>
            <Text style={{
              fontSize: 36,
              fontWeight: 'bold',
              marginBottom: 8,
            }}>
              languages you speak
            </Text>

            <Text style={{
              fontSize: 16,
              color: '#666',
              marginBottom: 24,
            }}>
              select all that apply 🌍
            </Text>

            {/* Search Bar */}
            <View style={{
              backgroundColor: 'white',
              borderRadius: 16,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 2,
              borderColor: '#F0F0F0',
            }}>
              <Text style={{ fontSize: 18, marginRight: 10 }}>🔍</Text>
              <TextInput
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search languages..."
                placeholderTextColor="#999"
                style={{
                  flex: 1,
                  paddingVertical: 14,
                  fontSize: 16,
                }}
              />
            </View>
          </View>

          {/* Languages List */}
          <FlatList
            data={filteredLanguages}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => <LanguageItem item={item} />}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        </View>

        {/* Continue Button */}
        <View style={{ paddingHorizontal: 30, paddingBottom: 30 }}>
          <Pressable
            onPress={handleContinue}
            style={{
              backgroundColor: '#007AFF',
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