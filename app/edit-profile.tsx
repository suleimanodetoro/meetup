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
import DatePicker from 'react-native-date-picker';
import { supabase } from '~/utils/supabase';
import { decode } from 'base64-arraybuffer';
import { COUNTRIES } from '~/utils/countryFlags';
import { useAuth } from './contexts/AuthProvider';
import { pickAndEncodeImage } from '~/utils/pickAndEncodeImage';

const INTERESTS = [
  'Music & Concerts',
  'Gaming',
  'Dance Nights',
  'Group Fitness',
  'Yoga & Mindfulness',
  'Foodie Adventures',
  'Coffee & Chill',
  'Arts & Culture',
  'Film & Cinema',
  'Photography',
  'Hiking & Outdoors',
  'Travel',
  'Volunteering',
  'Tech & Startups',
  'Board Games',
  'Language Exchange',
  'Book Club',
  'Creative Writing',
  'Adventure',
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

  // Basic Info
  const [fullName, setFullName] = useState('');
  const [bio, setBio] = useState('');
  const [dob, setDob] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);

  // Location (stored as nationality in DB)
  const [country, setCountry] = useState<Country | null>(null);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Gender & Preferences
  const [gender, setGender] =
    useState<'male' | 'female' | 'non-binary' | 'prefer-not-to-say' | null>(null);
  const [genderPreference, setGenderPreference] =
    useState<'everyone' | 'guys' | 'girls'>('everyone');

  // Languages
  const [languages, setLanguages] = useState<string[]>([]);
  const [showLanguagesModal, setShowLanguagesModal] = useState(false);

  // Interests
  const [interests, setInterests] = useState<string[]>([]);
  const [showInterestsModal, setShowInterestsModal] = useState(false);

  // ────────────────────────────────────────────────────────────────────────────────
  // Load profile (schema-correct)
  // ────────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      setLoading(true);
      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(`
            id,
            full_name,
            bio,
            avatar_url,
            birth_date,
            languages,
            gender,
            nationality,
            nationality_code,
            interests,
            gender_preference
          `)
          .eq('id', session.user.id)
          .single();

        if (error) throw error;

        if (profile) {
          setFullName(profile.full_name ?? '');
          setBio(profile.bio ?? '');
          setMainImage(profile.avatar_url ?? null);

          // birth_date -> dob
          if (profile.birth_date) setDob(new Date(profile.birth_date));

          // nationality_code/name -> Country object
          const byCode = profile.nationality_code
            ? COUNTRIES.find((c) => c.code === profile.nationality_code)
            : null;
          const byName =
            !byCode && profile.nationality
              ? COUNTRIES.find((c) => c.name === profile.nationality)
              : null;
          setCountry(byCode ?? byName ?? null);

          // gender / gender_preference
          if (profile.gender) setGender(profile.gender);
          if (profile.gender_preference) {
            const gp = profile.gender_preference as 'everyone' | 'guys' | 'girls';
            setGenderPreference(gp);
          }

          // languages / interests (jsonb arrays)
          if (Array.isArray(profile.languages)) setLanguages(profile.languages as string[]);
          if (Array.isArray(profile.interests)) setInterests(profile.interests as string[]);
        }
      } catch (err) {
        console.error(err);
        Alert.alert('Error', 'Failed to load your profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user?.id]);

  // ────────────────────────────────────────────────────────────────────────────────
  // Image picking (storage upload only; DB save happens in saveProfile)
  // ────────────────────────────────────────────────────────────────────────────────
  const pickImage = async (position: 'main' | 'second' | 'third') => {
    try {
      const picked = await pickAndEncodeImage([1, 1], 2000, 0.5);
      if (!picked) return;

      const fileName = `${session?.user.id}-${position}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(picked.base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(fileName);
      const publicUrl = publicData.publicUrl;

      if (position === 'main') setMainImage(publicUrl);
      if (position === 'second') setSecondImage(publicUrl); // preview only
      if (position === 'third') setThirdImage(publicUrl);   // preview only
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // ────────────────────────────────────────────────────────────────────────────────
  // Save (schema-correct payload)
  // ────────────────────────────────────────────────────────────────────────────────
  const saveProfile = async () => {
    if (!session?.user?.id) return;
    try {
      setSaving(true);

      const payload: {
        updated_at: string;
        full_name: string | null;
        bio: string | null;
        avatar_url: string | null;
        birth_date: string | null; // YYYY-MM-DD
        languages: string[];
        gender: string | null;
        nationality: string | null;
        nationality_code: string | null;
        interests: string[];
        gender_preference: string | null;
      } = {
        updated_at: new Date().toISOString(),
        full_name: fullName || null,
        bio: bio || null,
        avatar_url: mainImage || null,
        birth_date: dob ? new Date(dob).toISOString().slice(0, 10) : null,
        languages,
        gender: gender ?? null,
        nationality: country?.name ?? null,
        nationality_code: country?.code ?? null,
        interests,
        gender_preference: genderPreference ?? null,
      };

      const { error } = await supabase
        .from('profiles')
        .update(payload)
        .eq('id', session.user.id);

      if (error) throw error;

      Alert.alert('Saved', 'Your profile has been updated.');
      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator />
      </SafeAreaView>
    );
  }

  const filteredCountries = COUNTRIES.filter((c) => {
    if (!countrySearch) return true;
    return (
      c.name.toLowerCase().includes(countrySearch.toLowerCase()) ||
      c.code.toLowerCase().includes(countrySearch.toLowerCase())
    );
  });

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
      <ScrollView contentContainerStyle={{ padding: 20 }}>
        <Text style={{ fontSize: 24, fontWeight: '700', marginBottom: 16 }}>Edit profile</Text>

        {/* Photos */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Photos</Text>
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* Main */}
          <View style={{ width: 120, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F0F0F0' }}>
            {mainImage ? (
              <Image source={{ uri: mainImage }} style={{ width: '100%', height: '100%' }} />
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ fontSize: 30, color: '#999' }}>+</Text>
                <Text style={{ color: '#999', marginTop: 4 }}>Main Pic</Text>
              </View>
            )}
            <Pressable
              onPress={() => pickImage('main')}
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
              <Text style={{ fontSize: 18 }}>✎</Text>
            </Pressable>
          </View>

          {/* Second (preview only) */}
          <View style={{ width: 120, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F0F0F0' }}>
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
              <Text style={{ fontSize: 18 }}>✎</Text>
            </Pressable>
          </View>

          {/* Third (preview only) */}
          <View style={{ width: 120, height: 160, borderRadius: 12, overflow: 'hidden', backgroundColor: '#F0F0F0' }}>
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
              <Text style={{ fontSize: 18 }}>✎</Text>
            </Pressable>
          </View>
        </View>

        {/* Basic Info */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginVertical: 16 }}>Basic Info</Text>
        <View style={{ gap: 12 }}>
          <View>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Full name</Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              style={{
                borderWidth: 1,
                borderColor: '#E0E0E0',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 12,
              }}
            />
          </View>

          <View>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Bio</Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell us about yourself"
              multiline
              style={{
                borderWidth: 1,
                borderColor: '#E0E0E0',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 12,
                minHeight: 100,
                textAlignVertical: 'top',
              }}
            />
          </View>

          <View>
            <Text style={{ fontSize: 12, color: '#666', marginBottom: 6 }}>Date of birth</Text>
            <Pressable
              onPress={() => setShowDatePicker(true)}
              style={{
                borderWidth: 1,
                borderColor: '#E0E0E0',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 12,
              }}
            >
              <Text>{dob ? dob.toDateString() : 'Select date'}</Text>
            </Pressable>
          </View>
        </View>

        {/* Location (stored as nationality) */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginVertical: 16 }}>Location</Text>
        <Pressable
          onPress={() => setShowCountryModal(true)}
          style={{
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}
        >
          <Text>{country ? `${country.flag}  ${country.name}` : 'Choose country'}</Text>
        </Pressable>

        {/* Gender & Preferences */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginVertical: 16 }}>Preferences</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
          {['male', 'female', 'non-binary', 'prefer-not-to-say'].map((g) => (
            <Pressable
              key={g}
              onPress={() => setGender(g as any)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: gender === g ? '#4A90E2' : '#E0E0E0',
                backgroundColor: gender === g ? '#EAF3FF' : 'white',
              }}
            >
              <Text>{g}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, marginTop: 10 }}>
          {['everyone', 'guys', 'girls'].map((gp) => (
            <Pressable
              key={gp}
              onPress={() => setGenderPreference(gp as any)}
              style={{
                paddingHorizontal: 14,
                paddingVertical: 10,
                borderRadius: 999,
                borderWidth: 1,
                borderColor: genderPreference === gp ? '#4A90E2' : '#E0E0E0',
                backgroundColor: genderPreference === gp ? '#EAF3FF' : 'white',
              }}
            >
              <Text>{gp}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Languages */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginVertical: 16 }}>Languages</Text>
        <Pressable
          onPress={() => setShowLanguagesModal(true)}
          style={{
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}
        >
          <Text>{languages.length ? languages.join(', ') : 'Add languages'}</Text>
        </Pressable>

        {/* Interests */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginVertical: 16 }}>Interests</Text>
        <Pressable
          onPress={() => setShowInterestsModal(true)}
          style={{
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 10,
            paddingHorizontal: 12,
            paddingVertical: 12,
          }}
        >
          <Text>{interests.length ? `${interests.length} selected` : 'Choose interests'}</Text>
        </Pressable>

        <Pressable
          onPress={saveProfile}
          disabled={saving}
          style={{
            marginTop: 24,
            backgroundColor: 'black',
            paddingVertical: 14,
            borderRadius: 12,
            alignItems: 'center',
            opacity: saving ? 0.6 : 1,
          }}
        >
          <Text style={{ color: 'white', fontWeight: '700' }}>
            {saving ? 'Saving...' : 'Save changes'}
          </Text>
        </Pressable>
      </ScrollView>

      {/* Date Picker */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}
      >
        <SafeAreaView
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.35)',
          }}
        >
          <View style={{ backgroundColor: 'white', borderRadius: 16, padding: 20 }}>
            <DatePicker
              mode="date"
              date={dob || new Date(2000, 0, 1)}
              onDateChange={setDob as any}
              maximumDate={new Date()}
            />
            <Pressable
              onPress={() => setShowDatePicker(false)}
              style={{
                marginTop: 12,
                backgroundColor: '#111',
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
              }}
            >
              <Text style={{ color: 'white', fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Country Modal */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        onRequestClose={() => setShowCountryModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View style={{ padding: 16, borderBottomWidth: 1, borderBottomColor: '#F0F0F0' }}>
            <TextInput
              value={countrySearch}
              onChangeText={setCountrySearch}
              placeholder="Search country"
              style={{
                borderWidth: 1,
                borderColor: '#E0E0E0',
                borderRadius: 10,
                paddingHorizontal: 12,
                paddingVertical: 10,
              }}
            />
          </View>
          <FlatList
            data={filteredCountries}
            keyExtractor={(item) => item.code}
            renderItem={({ item }) => (
              <Pressable
                onPress={() => {
                  setCountry(item);
                  setShowCountryModal(false);
                }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingVertical: 14,
                  paddingHorizontal: 20,
                  borderBottomWidth: 1,
                  borderBottomColor: '#F0F0F0',
                }}
              >
                <Text style={{ fontSize: 18, marginRight: 12 }}>{item.flag}</Text>
                <Text style={{ fontSize: 16 }}>{item.name}</Text>
                <Text style={{ marginLeft: 'auto', color: '#999' }}>{item.code}</Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Languages Modal (example) */}
      <Modal
        visible={showLanguagesModal}
        animationType="slide"
        onRequestClose={() => setShowLanguagesModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>Languages</Text>
            <Text style={{ color: '#666', marginTop: 4 }}>Tap to toggle</Text>
          </View>
          <FlatList
            data={['en', 'es', 'fr', 'de', 'it', 'pt', 'zh', 'ja', 'ko']}
            keyExtractor={(x) => x}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  setLanguages((prev) =>
                    prev.includes(item)
                      ? prev.filter((x) => x !== item)
                      : [...prev, item]
                  )
                }
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
                {languages.includes(item) && <Text>✓</Text>}
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Interests Modal */}
      <Modal
        visible={showInterestsModal}
        animationType="slide"
        onRequestClose={() => setShowInterestsModal(false)}
      >
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View style={{ padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '700' }}>Interests</Text>
            <Text style={{ color: '#666', marginTop: 4 }}>Pick up to 5</Text>
          </View>
          <FlatList
            data={INTERESTS}
            keyExtractor={(x) => x}
            renderItem={({ item }) => (
              <Pressable
                onPress={() =>
                  setInterests((prev) =>
                    prev.includes(item)
                      ? prev.filter((x) => x !== item)
                      : prev.length < 5
                      ? [...prev, item]
                      : prev
                  )
                }
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
                {interests.includes(item) && <Text>✓</Text>}
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
