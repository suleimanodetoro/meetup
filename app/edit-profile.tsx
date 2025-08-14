// app/edit-profile.tsx
import React, { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import DatePicker from 'react-native-date-picker';
import { supabase } from '~/utils/supabase';
import { decode } from 'base64-arraybuffer';
import { COUNTRIES } from '~/utils/countryFlags';
import { useAuth } from './contexts/AuthProvider';

const INTERESTS = [
  'Music & Concerts',
  'Gaming',
  'Dance Nights',
  'Group Fitness',
  'Yoga & Mindfulness',
  'Foodie Adventures',
  'Coffee & Chill',
  'Arts & Crafts',
  'Photography',
  'Board Games',
  'Karaoke',
  'Outdoor Activities',
  'Volunteering',
  'Movie Nights',
  'Fashion',
  'Tech Meetups',
  'Sports',
  'Book Club',
  'Creative Writing',
  'Adventure',
];

const LANGUAGES = [
  { name: 'English', code: 'en' },
  { name: 'German', code: 'de' },
  { name: 'Hausa', code: 'ha' },
  { name: 'Spanish', code: 'es' },
  { name: 'French', code: 'fr' },
  { name: 'Italian', code: 'it' },
  { name: 'Portuguese', code: 'pt' },
  { name: 'Russian', code: 'ru' },
  { name: 'Chinese', code: 'zh' },
  { name: 'Japanese', code: 'ja' },
  { name: 'Korean', code: 'ko' },
  { name: 'Arabic', code: 'ar' },
  { name: 'Hindi', code: 'hi' },
  { name: 'Bengali', code: 'bn' },
  { name: 'Punjabi', code: 'pa' },
  { name: 'Turkish', code: 'tr' },
  { name: 'Vietnamese', code: 'vi' },
  { name: 'Thai', code: 'th' },
  { name: 'Dutch', code: 'nl' },
  { name: 'Polish', code: 'pl' },
];

type Country = {
  name: string;
  code: string;
  flag: string;
};

export default function EditProfile() {
  const { session } = useAuth();

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Profile Picture States
  const [mainImage, setMainImage] = useState<string | null>(null);
  const [secondImage, setSecondImage] = useState<string | null>(null);
  const [thirdImage, setThirdImage] = useState<string | null>(null);

  // Profile Fields
  const [firstName, setFirstName] = useState('');
  const [introduction, setIntroduction] = useState('');
  const [birthDate, setBirthDate] = useState(new Date(1998, 0, 1));
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [genderPreference, setGenderPreference] = useState<'everyone' | 'guys' | 'girls'>('everyone');
  const [travelLifestyle, setTravelLifestyle] = useState('Digital nomad');
  const [instagramUsername, setInstagramUsername] = useState('');
  const [tiktokUsername, setTiktokUsername] = useState('');
  const [nationality, setNationality] = useState<Country>(COUNTRIES[0] as Country);
  const [languages, setLanguages] = useState<string[]>(['English']);
  const [interests, setInterests] = useState<string[]>([]);

  // Modal States
  const [showNationalityModal, setShowNationalityModal] = useState(false);
  const [showLanguagesModal, setShowLanguagesModal] = useState(false);
  const [showInterestsModal, setShowInterestsModal] = useState(false);
  const [showGenderPreferenceModal, setShowGenderPreferenceModal] = useState(false);
  const [showTravelLifestyleModal, setShowTravelLifestyleModal] = useState(false);

  useEffect(() => {
    loadProfile();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id]);

  const loadProfile = async () => {
    if (!session?.user?.id) return;

    setLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', session.user.id)
        .single();

      if (error) throw error;

      if (profile) {
        setFirstName(profile.full_name || '');
        setIntroduction(profile.bio || '');
        if (profile.birth_date) setBirthDate(new Date(profile.birth_date));

        setMainImage(profile.avatar_url || null);
        setInstagramUsername(profile.username || '');

        // nationality
        const country =
          (COUNTRIES as Country[]).find(c => c.code === profile.nationality_code) ||
          (COUNTRIES[0] as Country);
        setNationality(country);

        // languages
        if (Array.isArray(profile.languages)) {
          const names = (profile.languages as string[]).map(code => {
            const lang = LANGUAGES.find(l => l.code === code);
            return lang?.name || code;
          });
          setLanguages(names);
        }

        // interests
        if (Array.isArray(profile.interests)) {
          setInterests(profile.interests as string[]);
        }

        setGenderPreference((profile.gender_preference as 'everyone' | 'guys' | 'girls') || 'everyone');
      }
    } catch (err) {
      console.error('Error loading profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const pickImage = async (position: 'main' | 'second' | 'third') => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.5,
        base64: true,
      });

      if (!result.canceled && result.assets?.length) {
        const image = result.assets[0];

        if (image.base64) {
          const fileName = `${session?.user.id}-${position}-${Date.now()}.jpg`;

          const { error: uploadError } = await supabase.storage
            .from('avatars')
            .upload(fileName, decode(image.base64), {
              contentType: 'image/jpeg',
              upsert: true,
            });

          if (uploadError) throw uploadError;

          const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName);
          const publicUrl = publicData.publicUrl;

          if (position === 'main') setMainImage(publicUrl);
          if (position === 'second') setSecondImage(publicUrl);
          if (position === 'third') setThirdImage(publicUrl);
        }
      }
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  const handleSave = async () => {
    if (!session?.user?.id) return;

    setSaving(true);
    try {
      // Convert language names back to codes
      const languageCodes = languages.map(name => LANGUAGES.find(l => l.name === name)?.code || name);

      const updates = {
        id: session.user.id,
        full_name: firstName,
        bio: introduction,
        birth_date: birthDate.toISOString().split('T')[0],
        avatar_url: mainImage,
        username: instagramUsername,
        tiktok: tiktokUsername,
        nationality: nationality.name,
        nationality_code: nationality.code,
        languages: languageCodes,
        interests,
        gender_preference: genderPreference,
        updated_at: new Date().toISOString(),
      };

      const { error } = await supabase.from('profiles').upsert(updates);

      if (error) throw error;

      Alert.alert('Success', 'Profile updated successfully');
      router.back();
    } catch (err: any) {
      console.error('Error saving profile:', err);
      Alert.alert('Error', err.message || 'Failed to save profile');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 16,
          borderBottomWidth: 1,
          borderBottomColor: '#F0F0F0',
        }}
      >
        <Pressable onPress={() => router.back()} style={{ padding: 8 }}>
          <Ionicons name="arrow-back" size={24} color="#333" />
        </Pressable>

        <Text style={{ fontSize: 20, fontWeight: 'bold' }}>Edit Profile</Text>

        <Pressable
          onPress={handleSave}
          disabled={saving}
          style={{
            backgroundColor: '#4A90E2',
            paddingHorizontal: 20,
            paddingVertical: 10,
            borderRadius: 20,
            opacity: saving ? 0.7 : 1,
          }}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>Update</Text>
          )}
        </Pressable>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} style={{ flex: 1 }}>
        {/* Profile Pictures */}
        <View style={{ padding: 20 }}>
          <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 16 }}>Profile Pictures</Text>

          {/* Main Picture */}
          <Pressable
            onPress={() => pickImage('main')}
            style={{
              width: '100%',
              height: 200,
              borderRadius: 16,
              backgroundColor: mainImage ? '#4A90E2' : '#E0E0E0',
              marginBottom: 16,
              overflow: 'hidden',
              justifyContent: 'center',
              alignItems: 'center',
            }}
          >
            {mainImage ? (
              <Image source={{ uri: mainImage }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={{ alignItems: 'center' }}>
                <Ionicons name="camera-outline" size={40} color="white" />
                <Text style={{ color: 'white', marginTop: 8 }}>Main Picture</Text>
              </View>
            )}

            <Pressable
              onPress={() => pickImage('main')}
              style={{
                position: 'absolute',
                bottom: 12,
                right: 12,
                backgroundColor: 'rgba(255,255,255,0.9)',
                width: 36,
                height: 36,
                borderRadius: 18,
                justifyContent: 'center',
                alignItems: 'center',
              }}
            >
              <Ionicons name="camera" size={20} color="#333" />
            </Pressable>
          </Pressable>

          {/* Secondary Pictures */}
          <View style={{ flexDirection: 'row' }}>
            {/* second */}
            <Pressable
              onPress={() => pickImage('second')}
              style={{
                flex: 1,
                height: 140,
                borderRadius: 16,
                backgroundColor: '#E0E0E0',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
                marginRight: 16,
              }}
            >
              {secondImage ? (
                <Image source={{ uri: secondImage }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, color: '#999' }}>+</Text>
                  <Text style={{ color: '#999', marginTop: 4 }}>2nd Pic</Text>
                </View>
              )}
              <Pressable
                onPress={() => pickImage('second')}
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="camera" size={16} color="#333" />
              </Pressable>
            </Pressable>

            {/* third */}
            <Pressable
              onPress={() => pickImage('third')}
              style={{
                flex: 1,
                height: 140,
                borderRadius: 16,
                backgroundColor: '#E0E0E0',
                justifyContent: 'center',
                alignItems: 'center',
                overflow: 'hidden',
              }}
            >
              {thirdImage ? (
                <Image source={{ uri: thirdImage }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: 30, color: '#999' }}>+</Text>
                  <Text style={{ color: '#999', marginTop: 4 }}>3rd Pic</Text>
                </View>
              )}
              <Pressable
                onPress={() => pickImage('third')}
                style={{
                  position: 'absolute',
                  bottom: 8,
                  right: 8,
                  backgroundColor: 'rgba(255,255,255,0.9)',
                  width: 30,
                  height: 30,
                  borderRadius: 15,
                  justifyContent: 'center',
                  alignItems: 'center',
                }}
              >
                <Ionicons name="camera" size={16} color="#333" />
              </Pressable>
            </Pressable>
          </View>
        </View>

        {/* First Name */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>First Name</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="Enter your first name"
            style={{
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
            }}
          />
        </View>

        {/* Introduction */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Introduction</Text>
          <TextInput
            value={introduction}
            onChangeText={setIntroduction}
            placeholder="Write something..."
            multiline
            numberOfLines={4}
            style={{
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
              minHeight: 100,
              textAlignVertical: 'top',
            }}
          />
        </View>

        {/* Date of Birth */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Date of Birth</Text>
          <Pressable
            onPress={() => setShowDatePicker(true)}
            style={{
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 16 }}>
              {birthDate.toLocaleDateString('en-US', {
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </Text>
            <Ionicons name="calendar-outline" size={20} color="#666" />
          </Pressable>
        </View>

        {/* Gender Preference */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 4 }}>Gender Preference</Text>
          <Text style={{ fontSize: 14, color: '#666', marginBottom: 8 }}>Who do you want to meet?</Text>
          <Pressable
            onPress={() => setShowGenderPreferenceModal(true)}
            style={{
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>👫</Text>
              <Text style={{ fontSize: 16, textTransform: 'capitalize' }}>{genderPreference}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </Pressable>
        </View>

        {/* Travel Lifestyle */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Travel Lifestyle</Text>
          <Pressable
            onPress={() => setShowTravelLifestyleModal(true)}
            style={{
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>💻</Text>
              <Text style={{ fontSize: 16 }}>{travelLifestyle}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </Pressable>
        </View>

        {/* Instagram Username */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Instagram Username</Text>
          <TextInput
            value={instagramUsername}
            onChangeText={setInstagramUsername}
            placeholder="Instagram username"
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
            }}
          />
        </View>

        {/* TikTok Username */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>TikTok Username</Text>
          <TextInput
            value={tiktokUsername}
            onChangeText={setTiktokUsername}
            placeholder="TikTok username"
            autoCapitalize="none"
            style={{
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 12,
              padding: 16,
              fontSize: 16,
            }}
          />
        </View>

        {/* Nationality */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Nationality</Text>
          <Pressable
            onPress={() => setShowNationalityModal(true)}
            style={{
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 20, marginRight: 8 }}>{nationality.flag}</Text>
              <Text style={{ fontSize: 16 }}>{nationality.name}</Text>
            </View>
            <Ionicons name="chevron-down" size={20} color="#666" />
          </Pressable>
        </View>

        {/* Languages */}
        <View style={{ paddingHorizontal: 20, marginBottom: 24 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Languages</Text>
          <Pressable
            onPress={() => setShowLanguagesModal(true)}
            style={{
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 12,
              padding: 16,
            }}
          >
            {languages.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap' }}>
                {languages.map((lang, index) => (
                  <View
                    key={`${lang}-${index}`}
                    style={{
                      backgroundColor: '#E3F2FD',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                      marginRight: 8,
                      marginBottom: 8,
                    }}
                  >
                    <Text style={{ fontSize: 14, color: '#4A90E2' }}>{lang}</Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 16, color: '#999' }}>Select languages</Text>
            )}
          </Pressable>
        </View>

        {/* Interests */}
        <View style={{ paddingHorizontal: 20, marginBottom: 40 }}>
          <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Interests</Text>
          <Pressable
            onPress={() => setShowInterestsModal(true)}
            style={{
              borderWidth: 1,
              borderColor: '#E0E0E0',
              borderRadius: 12,
              padding: 16,
              flexDirection: 'row',
              alignItems: 'center',
            }}
          >
            <Text style={{ fontSize: 20, marginRight: 8 }}>+</Text>
            <Text style={{ fontSize: 16, color: '#999' }}>
              {interests.length > 0 ? `${interests.length} interests selected` : 'Tap here to add interests'}
            </Text>
          </Pressable>

          {interests.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', marginTop: 12 }}>
              {interests.map((interest, index) => (
                <View
                  key={`${interest}-${index}`}
                  style={{
                    backgroundColor: '#E3F2FD',
                    paddingHorizontal: 12,
                    paddingVertical: 6,
                    borderRadius: 16,
                    marginRight: 8,
                    marginBottom: 8,
                  }}
                >
                  <Text style={{ fontSize: 14, color: '#4A90E2' }}>{interest}</Text>
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Date Picker */}
      <DatePicker
        modal
        open={showDatePicker}
        date={birthDate}
        mode="date"
        maximumDate={new Date()}
        minimumDate={new Date(1920, 0, 1)}
        onConfirm={(date) => {
          setShowDatePicker(false);
          setBirthDate(date);
        }}
        onCancel={() => setShowDatePicker(false)}
      />

      {/* Gender Preference Modal */}
      <Modal visible={showGenderPreferenceModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 20 }}>Gender Preference</Text>
            {['everyone', 'guys', 'girls'].map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  setGenderPreference(option as 'everyone' | 'guys' | 'girls');
                  setShowGenderPreferenceModal(false);
                }}
                style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}
              >
                <Text style={{ fontSize: 16, textTransform: 'capitalize' }}>{option}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setShowGenderPreferenceModal(false)} style={{ marginTop: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: '#666' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Travel Lifestyle Modal */}
      <Modal visible={showTravelLifestyleModal} animationType="slide" transparent>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: 'white', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', marginBottom: 20 }}>Travel Lifestyle</Text>
            {['Digital nomad', 'Backpacker', 'Luxury traveler', 'Weekend explorer', 'Adventure seeker'].map((option) => (
              <Pressable
                key={option}
                onPress={() => {
                  setTravelLifestyle(option);
                  setShowTravelLifestyleModal(false);
                }}
                style={{ paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}
              >
                <Text style={{ fontSize: 16 }}>{option}</Text>
              </Pressable>
            ))}
            <Pressable onPress={() => setShowTravelLifestyleModal(false)} style={{ marginTop: 20, alignItems: 'center' }}>
              <Text style={{ fontSize: 16, color: '#666' }}>Cancel</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      {/* Nationality Modal */}
      <Modal visible={showNationalityModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#E0E0E0',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600' }}>Select Nationality</Text>
            <Pressable onPress={() => setShowNationalityModal(false)}>
              <Text style={{ fontSize: 16, color: '#4A90E2' }}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={COUNTRIES as Country[]}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setNationality(item);
                  setShowNationalityModal(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: '#F0F0F0',
                }}
              >
                <Text style={{ fontSize: 20, marginRight: 12 }}>{item.flag}</Text>
                <Text style={{ fontSize: 16 }}>{item.name}</Text>
                {nationality.code === item.code && (
                  <Ionicons name="checkmark" size={20} color="#4A90E2" style={{ marginLeft: 'auto' }} />
                )}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Languages Modal */}
      <Modal visible={showLanguagesModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#E0E0E0',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600' }}>Select Languages</Text>
            <Pressable onPress={() => setShowLanguagesModal(false)}>
              <Text style={{ fontSize: 16, color: '#4A90E2' }}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={LANGUAGES}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setLanguages(prev =>
                    prev.includes(item.name) ? prev.filter(l => l !== item.name) : [...prev, item.name],
                  );
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: '#F0F0F0',
                }}
              >
                <Text style={{ fontSize: 16, flex: 1 }}>{item.name}</Text>
                {languages.includes(item.name) && <Ionicons name="checkmark" size={20} color="#4A90E2" />}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Interests Modal */}
      <Modal visible={showInterestsModal} animationType="slide">
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 20,
              paddingVertical: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#E0E0E0',
            }}
          >
            <Text style={{ fontSize: 18, fontWeight: '600' }}>Select Interests</Text>
            <Pressable onPress={() => setShowInterestsModal(false)}>
              <Text style={{ fontSize: 16, color: '#4A90E2' }}>Done</Text>
            </Pressable>
          </View>
          <FlatList
            data={INTERESTS}
            keyExtractor={(item) => item}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  if (interests.includes(item)) {
                    setInterests(prev => prev.filter(i => i !== item));
                  } else if (interests.length < 5) {
                    setInterests(prev => [...prev, item]);
                  } else {
                    Alert.alert('Maximum Interests', 'You can select up to 5 interests');
                  }
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 16,
                  paddingHorizontal: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: '#F0F0F0',
                }}
              >
                <Text style={{ fontSize: 16, flex: 1 }}>{item}</Text>
                {interests.includes(item) && <Ionicons name="checkmark" size={20} color="#4A90E2" />}
              </Pressable>
            )}
          />
          <View style={{ padding: 20, backgroundColor: '#F5F5F5' }}>
            <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
              {interests.length}/5 interests selected
            </Text>
          </View>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
