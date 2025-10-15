// app/(auth)/onboarding-basic.tsx
import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SafeAreaView,
  ScrollView,
  Image,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import DatePicker from 'react-native-date-picker';
import { LinearGradient } from 'expo-linear-gradient';

export default function OnboardingBasicScreen() {
  const [name, setName] = useState('');
  const [birthDate, setBirthDate] = useState(new Date(1998, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);

  const handleContinue = () => {
    if (name.trim()) {
      // Store data temporarily (we'll save everything at the end)
      router.push({
        pathname: '/onboarding-nationality',
        params: { name, birthDate: birthDate.toISOString() }
      });
    }
  };

  // Calculate age for display
  const calculateAge = (date: Date) => {
  const today = new Date();
  let age = today.getFullYear() - date.getFullYear();
  const monthDiff = today.getMonth() - date.getMonth();
  
  // If birthday hasn't occurred yet this year, subtract 1
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < date.getDate())) {
    age--;
  }
  
  return age;
};

  return (
    <LinearGradient
      colors={['#E3F2FD', '#BBDEFB', '#90CAF9']}
      style={{ flex: 1 }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView 
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
          
          {/* Back button */}
          <Pressable
            onPress={() => router.back()}
            style={{
              position: 'absolute',
              top: 60,
              left: 20,
              zIndex: 1,
              padding: 10,
            }}>
            <Text style={{ fontSize: 30 }}>←</Text>
          </Pressable>

          <ScrollView 
            contentContainerStyle={{ flexGrow: 1 }}
            showsVerticalScrollIndicator={false}>
            
            {/* Photo Collage Background */}
            <View style={{
              position: 'absolute',
              top: 0,
              left: 0,
              right: 0,
              height: 400,
              opacity: 0.3,
            }}>
              {/* Circular photo frames */}
              <View style={{ position: 'absolute', top: 100, left: 20 }}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=200' }}
                  style={{ width: 80, height: 80, borderRadius: 40 }}
                />
              </View>
              <View style={{ position: 'absolute', top: 150, right: 30 }}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200' }}
                  style={{ width: 100, height: 100, borderRadius: 50 }}
                />
              </View>
              <View style={{ position: 'absolute', top: 200, left: 100 }}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1522075469751-3a6694fb2f61?w=200' }}
                  style={{ width: 120, height: 120, borderRadius: 60 }}
                />
              </View>
              <View style={{ position: 'absolute', top: 280, right: 80 }}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200' }}
                  style={{ width: 90, height: 90, borderRadius: 45 }}
                />
              </View>
              <View style={{ position: 'absolute', top: 320, left: 40 }}>
                <Image
                  source={{ uri: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200' }}
                  style={{ width: 70, height: 70, borderRadius: 35 }}
                />
              </View>
            </View>

            <View style={{ flex: 1, paddingHorizontal: 30, paddingTop: 120 }}>
              <Text style={{
                fontSize: 36,
                fontWeight: 'bold',
                marginBottom: 8,
              }}>
                basic info
              </Text>
              
              <Text style={{
                fontSize: 16,
                color: '#666',
                marginBottom: 40,
              }}>
                let's get started with your profile 🤝
              </Text>

              {/* Name Input */}
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                marginBottom: 12,
              }}>
                Your first name
              </Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
                style={{
                  backgroundColor: 'white',
                  padding: 20,
                  borderRadius: 16,
                  fontSize: 18,
                  marginBottom: 30,
                  borderWidth: 2,
                  borderColor: '#007AFF',
                }}
              />

              {/* Birthday Selector */}
              <Text style={{
                fontSize: 16,
                fontWeight: '600',
                marginBottom: 12,
              }}>
                Your Birthday
              </Text>
              <Pressable
                onPress={() => setShowDatePicker(true)}
                style={{
                  backgroundColor: 'white',
                  padding: 20,
                  borderRadius: 16,
                  marginBottom: 30,
                  borderWidth: 2,
                  borderColor: '#007AFF',
                }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text style={{ fontSize: 18, color: '#333' }}>
                    {birthDate.toLocaleDateString('en-US', { 
                      month: 'long', 
                      day: 'numeric', 
                      year: 'numeric' 
                    })}
                  </Text>
                  <Text style={{ fontSize: 16, color: '#666' }}>
                    Age {calculateAge(birthDate)}
                  </Text>
                </View>
              </Pressable>

              {/* Modal Date Picker */}
              <DatePicker
                modal
                open={showDatePicker}
                date={birthDate}
                mode="date"
                maximumDate={new Date()}
                minimumDate={new Date(1920, 0, 1)}
                onConfirm={(date) => {
                  setBirthDate(date);
                  setShowDatePicker(false);
                }}
                onCancel={() => setShowDatePicker(false)}
                title="Select your birthday"
              />
            </View>
          </ScrollView>

          {/* Continue Button */}
          <View style={{ paddingHorizontal: 30, paddingBottom: 30 }}>
            <Pressable
              onPress={handleContinue}
              disabled={!name.trim()}
              style={{
                backgroundColor: name.trim() ? '#007AFF' : '#ccc',
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
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}