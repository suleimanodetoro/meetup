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
import { LANGUAGES, MEETING_PREFERENCES } from '~/utils/constants';
import { useAuth } from '~/contexts/AuthProvider';
import { pickAndEncodeImage } from '~/utils/pickAndEncodeImage';
import { Ionicons } from '@expo/vector-icons';
import InterestsSelector from '~/components/InterestsSelector';

type Country = {
  name: string;
  code: string;
  flag: string;
};

// Helper functions to convert username to URL and vice versa
const socialHelpers = {
  instagram: {
    toUrl: (input: string) => {
      if (!input.trim()) return '';
      if (input.startsWith('https://')) return input;
      const username = input.startsWith('@') ? input.slice(1) : input;
      return `https://instagram.com/${username}`;
    },
    fromUrl: (url: string) => {
      if (!url) return '';
      const match = url.match(/instagram\.com\/([a-zA-Z0-9._]+)/);
      return match ? match[1] : url;
    },
    validate: (input: string) => {
      if (!input.trim()) return true;
      // Accept username (with or without @) or full URL
      const usernamePattern = /^@?[a-zA-Z0-9._]+$/;
      const urlPattern = /^https:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9._]+\/?$/;
      return usernamePattern.test(input) || urlPattern.test(input);
    },
  },
  tiktok: {
    toUrl: (input: string) => {
      if (!input.trim()) return '';
      if (input.startsWith('https://')) return input;
      const username = input.startsWith('@') ? input.slice(1) : input;
      return `https://tiktok.com/@${username}`;
    },
    fromUrl: (url: string) => {
      if (!url) return '';
      const match = url.match(/tiktok\.com\/@([a-zA-Z0-9._]+)/);
      return match ? match[1] : url;
    },
    validate: (input: string) => {
      if (!input.trim()) return true;
      const usernamePattern = /^@?[a-zA-Z0-9._]+$/;
      const urlPattern = /^https:\/\/(www\.)?tiktok\.com\/@[a-zA-Z0-9._]+\/?$/;
      return usernamePattern.test(input) || urlPattern.test(input);
    },
  },
  youtube: {
    toUrl: (input: string) => {
      if (!input.trim()) return '';
      if (input.startsWith('https://')) return input;
      const username = input.startsWith('@') ? input : `@${input}`;
      return `https://youtube.com/${username}`;
    },
    fromUrl: (url: string) => {
      if (!url) return '';
      const match = url.match(/youtube\.com\/(c\/|channel\/|@)([a-zA-Z0-9_-]+)/);
      return match ? match[2] : url;
    },
    validate: (input: string) => {
      if (!input.trim()) return true;
      const usernamePattern = /^@?[a-zA-Z0-9_-]+$/;
      const urlPattern = /^https:\/\/(www\.)?youtube\.com\/(c\/|channel\/|@)[a-zA-Z0-9_-]+\/?$/;
      return usernamePattern.test(input) || urlPattern.test(input);
    },
  },
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

  // Nationality / origin. Current location is managed separately by onboarding
  // and the map location flow (`profiles.location*`).
  const [country, setCountry] = useState<Country | null>(null);
  const [showCountryModal, setShowCountryModal] = useState(false);
  const [countrySearch, setCountrySearch] = useState('');

  // Gender & Preferences. The values mirror onboarding-gender's options
  // (male / female / other) — using a wider union here silently dropped
  // any onboarding-written 'other' into a state with no rendered option.
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null);
  const [genderPreference, setGenderPreference] = useState<'everyone' | 'guys' | 'girls'>(
    'everyone'
  );

  // Meeting Preference
  const [meetingPreference, setMeetingPreference] = useState<string | null>(null);

  // Social Media - store as username/handle, convert to URL on save
  const [instagramInput, setInstagramInput] = useState('');
  const [tiktokInput, setTiktokInput] = useState('');
  const [youtubeInput, setYoutubeInput] = useState('');
  const [socialErrors, setSocialErrors] = useState({
    instagram: '',
    tiktok: '',
    youtube: '',
  });

  // Languages
  const [languages, setLanguages] = useState<string[]>([]);
  const [showLanguagesModal, setShowLanguagesModal] = useState(false);

  // Interests
  const [interests, setInterests] = useState<string[]>([]);
  const [showInterestsModal, setShowInterestsModal] = useState(false);

  // Handle social media input change with validation
  const handleSocialChange = (platform: 'instagram' | 'tiktok' | 'youtube', value: string) => {
    const setters = {
      instagram: setInstagramInput,
      tiktok: setTiktokInput,
      youtube: setYoutubeInput,
    };

    setters[platform](value);

    // Validate if not empty
    if (value.trim() && !socialHelpers[platform].validate(value)) {
      setSocialErrors((prev) => ({
        ...prev,
        [platform]: `Invalid ${platform.charAt(0).toUpperCase() + platform.slice(1)} username or URL`,
      }));
    } else {
      setSocialErrors((prev) => ({
        ...prev,
        [platform]: '',
      }));
    }
  };

  // Handle interest toggle
  const handleToggleInterest = (interestId: string) => {
    setInterests((prev) =>
      prev.includes(interestId) ? prev.filter((id) => id !== interestId) : [...prev, interestId]
    );
  };

  // Load profile (schema-correct)
  useEffect(() => {
    (async () => {
      if (!session?.user?.id) return;
      setLoading(true);

      try {
        const { data: profile, error } = await supabase
          .from('profiles')
          .select(
            `
          id,
          full_name,
          bio,
          avatar_url,
          avatar_url_2,
          avatar_url_3,
          birth_date,
          languages,
          gender,
          nationality,
          nationality_code,
          interests,
          gender_preference,
          meeting_preference,
          instagram_url,
          tiktok_url,
          youtube_url
        `
          )
          .eq('id', session.user.id)
          .single();

        if (error) {
          console.error('Profile query error:', error);
          throw error;
        }

        if (profile) {
          setFullName(profile.full_name ?? '');
          setBio(profile.bio ?? '');
          setMainImage(profile.avatar_url ?? null);
          setSecondImage(profile.avatar_url_2 ?? null);
          setThirdImage(profile.avatar_url_3 ?? null);

          // birth_date -> dob. `birth_date` is a postgres DATE (YYYY-MM-DD);
          // appending a local time avoids the UTC-midnight-drift-into-prev-day
          // bug in negative-UTC timezones.
          if (profile.birth_date) {
            const dobDate = new Date(`${profile.birth_date}T00:00:00`);
            if (!isNaN(dobDate.getTime())) setDob(dobDate);
          }

          // nationality_code/name -> Country object
          const byCode = profile.nationality_code
            ? COUNTRIES.find((c) => c.code === profile.nationality_code)
            : null;
          const byName =
            !byCode && profile.nationality
              ? COUNTRIES.find((c) => c.name === profile.nationality)
              : null;
          const foundCountry = byCode ?? byName ?? null;
          setCountry(foundCountry);

          // gender / gender_preference. Normalize any legacy values to the
          // onboarding-aligned set; everything else falls through to 'other'.
          if (profile.gender) {
            const normalised: 'male' | 'female' | 'other' =
              profile.gender === 'male' || profile.gender === 'female' ? profile.gender : 'other';
            setGender(normalised);
          }
          if (profile.gender_preference) {
            const gp = profile.gender_preference as 'everyone' | 'guys' | 'girls';
            setGenderPreference(gp);
          }

          // Meeting preference
          if (profile.meeting_preference) {
            setMeetingPreference(profile.meeting_preference);
          }

          // languages / interests (jsonb arrays)
          if (Array.isArray(profile.languages)) {
            setLanguages(profile.languages as string[]);
          }
          if (Array.isArray(profile.interests)) {
            setInterests(profile.interests as string[]);
          }

          // Extract username/handle from URLs for display
          setInstagramInput(
            profile.instagram_url ? socialHelpers.instagram.fromUrl(profile.instagram_url) : ''
          );
          setTiktokInput(
            profile.tiktok_url ? socialHelpers.tiktok.fromUrl(profile.tiktok_url) : ''
          );
          setYoutubeInput(
            profile.youtube_url ? socialHelpers.youtube.fromUrl(profile.youtube_url) : ''
          );
        }
      } catch (err) {
        console.error('Failed to load profile:', err);
        Alert.alert('Error', 'Failed to load your profile.');
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.user?.id]);

  // Image picking (storage upload only; DB save happens in saveProfile)
  const pickImage = async (position: 'main' | 'second' | 'third') => {
    const userId = session?.user?.id;
    if (!userId) return;
    try {
      const picked = await pickAndEncodeImage([1, 1], 1024, 0.5);
      if (!picked) return;

      // Per-user folder so the owner-scoped storage policy matches ((foldername)[1] = uid).
      const fileName = `${userId}/${position}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(fileName, decode(picked.base64), {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: publicData } = supabase.storage.from('avatars').getPublicUrl(fileName);
      const publicUrl = publicData.publicUrl;

      if (position === 'main') setMainImage(publicUrl);
      if (position === 'second') setSecondImage(publicUrl);
      if (position === 'third') setThirdImage(publicUrl);
    } catch (err) {
      console.error('Error picking image:', err);
      Alert.alert('Error', 'Failed to pick image');
    }
  };

  // Save (schema-correct payload)
  const saveProfile = async () => {
    if (!session?.user?.id) return;

    // Validate all social inputs before saving
    const hasErrors = Object.values(socialErrors).some((error) => error !== '');
    if (hasErrors) {
      Alert.alert(
        'Invalid Input',
        'Please fix the invalid social media usernames/URLs before saving.'
      );
      return;
    }

    try {
      setSaving(true);

      // Base payload with ALL avatar URLs
      const basePayload: any = {
        updated_at: new Date().toISOString(),
        full_name: fullName || null,
        bio: bio || null,
        avatar_url: mainImage || null,
        avatar_url_2: secondImage || null,
        avatar_url_3: thirdImage || null,
        birth_date: dob ? new Date(dob).toISOString().slice(0, 10) : null,
        languages,
        gender: gender ?? null,
        nationality: country?.name ?? null,
        nationality_code: country?.code ?? null,
        interests,
        gender_preference: genderPreference ?? null,
        meeting_preference: meetingPreference ?? null,
      };

      // Try to save base fields first
      const { error: baseError } = await supabase
        .from('profiles')
        .update(basePayload)
        .eq('id', session.user.id);

      if (baseError) {
        console.error('Base save error:', baseError);
        throw baseError;
      }

      // Save social URLs as part of the same update path. We always include
      // them — passing null when cleared lets the user actually unset a
      // previously-saved handle.
      const socialPayload = {
        instagram_url: socialHelpers.instagram.toUrl(instagramInput) || null,
        tiktok_url: socialHelpers.tiktok.toUrl(tiktokInput) || null,
        youtube_url: socialHelpers.youtube.toUrl(youtubeInput) || null,
      };
      const { error: socialError } = await supabase
        .from('profiles')
        .update(socialPayload)
        .eq('id', session.user.id);
      if (socialError) throw socialError;
      Alert.alert('Saved', 'Your profile has been updated.');
      router.back();
    } catch (err) {
      console.error('Save failed:', err);
      Alert.alert('Error', 'Failed to save profile.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: 'white',
        }}>
        <ActivityIndicator size="large" />
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
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 16,
          paddingVertical: 12,
          borderBottomWidth: 1,
          borderBottomColor: '#F0F0F0',
        }}>
        <Pressable onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color="#000" />
        </Pressable>
        <Text style={{ fontSize: 20, fontWeight: '700' }}>Edit Profile</Text>
        <Pressable
          onPress={saveProfile}
          disabled={saving}
          style={{
            backgroundColor: '#007AFF',
            paddingHorizontal: 20,
            paddingVertical: 8,
            borderRadius: 20,
            opacity: saving ? 0.6 : 1,
          }}>
          <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>
            {saving ? 'Saving...' : 'Update'}
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20 }}>
        {/* Profile Pictures */}
        <Text style={{ fontSize: 18, fontWeight: '700', marginBottom: 12 }}>Profile Pictures</Text>

        {/* Main Picture */}
        <Pressable
          onPress={() => pickImage('main')}
          style={{
            height: 280,
            borderRadius: 16,
            overflow: 'hidden',
            backgroundColor: '#4A90E2',
            marginBottom: 12,
            position: 'relative',
          }}>
          {mainImage ? (
            <Image
              source={{ uri: mainImage }}
              style={{ width: '100%', height: '100%' }}
              resizeMode="cover"
            />
          ) : (
            <View style={{ flex: 1, backgroundColor: '#4A90E2' }} />
          )}
          <View
            style={{
              position: 'absolute',
              bottom: 16,
              left: 16,
              backgroundColor: 'rgba(0,0,0,0.3)',
              paddingHorizontal: 12,
              paddingVertical: 6,
              borderRadius: 12,
            }}>
            <Text style={{ color: 'white', fontWeight: '600', fontSize: 15 }}>Main Picture</Text>
          </View>
          <View
            style={{
              position: 'absolute',
              bottom: 16,
              right: 16,
              backgroundColor: 'rgba(255,255,255,0.9)',
              width: 40,
              height: 40,
              borderRadius: 20,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="camera" size={20} color="#000" />
          </View>
        </Pressable>

        {/* Second and Third Pictures */}
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
          <Pressable
            onPress={() => pickImage('second')}
            style={{
              flex: 1,
              height: 160,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: '#E0E0E0',
              position: 'relative',
            }}>
            {secondImage ? (
              <Image
                source={{ uri: secondImage }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#E0E0E0',
                }}>
                <Ionicons name="add" size={40} color="#999" />
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                backgroundColor: 'rgba(0,0,0,0.5)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}>
              <Text style={{ color: 'white', fontWeight: '500', fontSize: 12 }}>2nd Pic</Text>
            </View>
            <View
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                backgroundColor: 'rgba(255,255,255,0.9)',
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="camera" size={16} color="#000" />
            </View>
          </Pressable>

          <Pressable
            onPress={() => pickImage('third')}
            style={{
              flex: 1,
              height: 160,
              borderRadius: 12,
              overflow: 'hidden',
              backgroundColor: '#E0E0E0',
              position: 'relative',
            }}>
            {thirdImage ? (
              <Image
                source={{ uri: thirdImage }}
                style={{ width: '100%', height: '100%' }}
                resizeMode="cover"
              />
            ) : (
              <View
                style={{
                  flex: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: '#E0E0E0',
                }}>
                <Ionicons name="add" size={40} color="#999" />
              </View>
            )}
            <View
              style={{
                position: 'absolute',
                bottom: 8,
                left: 8,
                backgroundColor: 'rgba(0,0,0,0.5)',
                paddingHorizontal: 8,
                paddingVertical: 4,
                borderRadius: 8,
              }}>
              <Text style={{ color: 'white', fontWeight: '500', fontSize: 12 }}>3rd Pic</Text>
            </View>
            <View
              style={{
                position: 'absolute',
                bottom: 8,
                right: 8,
                backgroundColor: 'rgba(255,255,255,0.9)',
                width: 32,
                height: 32,
                borderRadius: 16,
                alignItems: 'center',
                justifyContent: 'center',
              }}>
              <Ionicons name="camera" size={16} color="#000" />
            </View>
          </Pressable>
        </View>

        {/* First Name */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>First Name</Text>
        <TextInput
          value={fullName}
          onChangeText={setFullName}
          placeholder="Traveler"
          style={{
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 15,
            marginBottom: 20,
            backgroundColor: '#F9F9F9',
          }}
        />

        {/* Introduction/Bio */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Introduction</Text>
        <TextInput
          value={bio}
          onChangeText={setBio}
          placeholder="Write something..."
          multiline
          numberOfLines={4}
          textAlignVertical="top"
          style={{
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 15,
            marginBottom: 20,
            minHeight: 100,
            backgroundColor: '#F9F9F9',
          }}
        />

        {/* Date of Birth */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Date of Birth</Text>
        <Pressable
          onPress={() => setShowDatePicker(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            marginBottom: 20,
            backgroundColor: '#F9F9F9',
          }}>
          <Text style={{ fontSize: 15, color: dob ? '#000' : '#999' }}>
            {dob
              ? dob.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })
              : 'Select date'}
          </Text>
          <Ionicons name="calendar-outline" size={20} color="#666" />
        </Pressable>

        {/* Gender */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Gender</Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          {(['male', 'female', 'other'] as const).map((opt) => (
            <Pressable
              key={opt}
              onPress={() => setGender(opt)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: gender === opt ? '#007AFF' : '#E0E0E0',
                backgroundColor: gender === opt ? '#EAF3FF' : 'white',
              }}>
              <Text style={{ fontSize: 18, marginRight: 6 }}>
                {opt === 'male' ? '👨' : opt === 'female' ? '👩' : '✨'}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: gender === opt ? '600' : '400',
                  color: gender === opt ? '#007AFF' : '#666',
                }}>
                {opt.charAt(0).toUpperCase() + opt.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Gender Preference */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Gender Preference</Text>
        <Text style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
          You&apos;ll only receive messages from this gender
        </Text>
        <View style={{ flexDirection: 'row', gap: 12, marginBottom: 20 }}>
          {['everyone', 'guys', 'girls'].map((pref) => (
            <Pressable
              key={pref}
              onPress={() => setGenderPreference(pref as any)}
              style={{
                flex: 1,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                paddingVertical: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: genderPreference === pref ? '#007AFF' : '#E0E0E0',
                backgroundColor: genderPreference === pref ? '#EAF3FF' : 'white',
              }}>
              <Text style={{ fontSize: 18, marginRight: 6 }}>
                {pref === 'everyone' ? '👥' : pref === 'guys' ? '👨' : '👩'}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: genderPreference === pref ? '600' : '400',
                  color: genderPreference === pref ? '#007AFF' : '#666',
                }}>
                {pref.charAt(0).toUpperCase() + pref.slice(1)}
              </Text>
            </Pressable>
          ))}
        </View>

        {/* Meeting Preference */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Meeting Preference</Text>
        <Text style={{ fontSize: 13, color: '#666', marginBottom: 12 }}>
          How do you prefer to meet people?
        </Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 20 }}>
          {MEETING_PREFERENCES.map((pref) => (
            <Pressable
              key={pref.id}
              onPress={() => setMeetingPreference(pref.id)}
              style={{
                backgroundColor: meetingPreference === pref.id ? '#007AFF' : 'white',
                paddingHorizontal: 16,
                paddingVertical: 12,
                borderRadius: 20,
                marginRight: 12,
                borderWidth: 1,
                borderColor: meetingPreference === pref.id ? '#007AFF' : '#E0E0E0',
                flexDirection: 'row',
                alignItems: 'center',
              }}>
              <Text style={{ fontSize: 18, marginRight: 8 }}>{pref.emoji}</Text>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: meetingPreference === pref.id ? '600' : '400',
                  color: meetingPreference === pref.id ? 'white' : '#666',
                }}>
                {pref.label}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* Social Media Links */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 12 }}>Social Media</Text>

        {/* Instagram */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="logo-instagram" size={20} color="#E4405F" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '500' }}>Instagram</Text>
          </View>
          <TextInput
            value={instagramInput}
            onChangeText={(text) => handleSocialChange('instagram', text)}
            placeholder="Profile link or @username"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              borderWidth: 1,
              borderColor: socialErrors.instagram ? '#FF3B30' : '#E0E0E0',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 14,
              backgroundColor: '#F9F9F9',
            }}
          />
          {socialErrors.instagram ? (
            <Text style={{ color: '#FF3B30', fontSize: 12, marginTop: 4, marginLeft: 4 }}>
              {socialErrors.instagram}
            </Text>
          ) : null}
        </View>

        {/* TikTok */}
        <View style={{ marginBottom: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="logo-tiktok" size={20} color="#000" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '500' }}>TikTok</Text>
          </View>
          <TextInput
            value={tiktokInput}
            onChangeText={(text) => handleSocialChange('tiktok', text)}
            placeholder="Profile link or @username"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              borderWidth: 1,
              borderColor: socialErrors.tiktok ? '#FF3B30' : '#E0E0E0',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 14,
              backgroundColor: '#F9F9F9',
            }}
          />
          {socialErrors.tiktok ? (
            <Text style={{ color: '#FF3B30', fontSize: 12, marginTop: 4, marginLeft: 4 }}>
              {socialErrors.tiktok}
            </Text>
          ) : null}
        </View>

        {/* YouTube */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
            <Ionicons name="logo-youtube" size={20} color="#FF0000" style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 15, fontWeight: '500' }}>YouTube</Text>
          </View>
          <TextInput
            value={youtubeInput}
            onChangeText={(text) => handleSocialChange('youtube', text)}
            placeholder="Channel link or @channelname"
            autoCapitalize="none"
            autoCorrect={false}
            style={{
              borderWidth: 1,
              borderColor: socialErrors.youtube ? '#FF3B30' : '#E0E0E0',
              borderRadius: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              fontSize: 14,
              backgroundColor: '#F9F9F9',
            }}
          />
          {socialErrors.youtube ? (
            <Text style={{ color: '#FF3B30', fontSize: 12, marginTop: 4, marginLeft: 4 }}>
              {socialErrors.youtube}
            </Text>
          ) : null}
        </View>

        {/* Nationality */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Nationality</Text>
        <Pressable
          onPress={() => setShowCountryModal(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            marginBottom: 20,
            backgroundColor: '#F9F9F9',
          }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            {country && <Text style={{ fontSize: 24, marginRight: 10 }}>{country.flag}</Text>}
            <Text style={{ fontSize: 15, color: country ? '#000' : '#999' }}>
              {country?.name || 'Select country'}
            </Text>
          </View>
          <Ionicons name="chevron-down" size={20} color="#666" />
        </Pressable>

        {/* Languages */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Languages</Text>
        <Pressable
          onPress={() => setShowLanguagesModal(true)}
          style={{
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            marginBottom: 20,
            backgroundColor: '#F9F9F9',
          }}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {languages.length > 0 ? (
              languages.map((code) => {
                const lang = LANGUAGES.find((l) => l.code === code);
                return (
                  <View
                    key={code}
                    style={{
                      backgroundColor: '#007AFF',
                      paddingHorizontal: 12,
                      paddingVertical: 6,
                      borderRadius: 16,
                    }}>
                    <Text style={{ color: 'white', fontSize: 13, fontWeight: '500' }}>
                      {lang ? lang.name : code}
                    </Text>
                  </View>
                );
              })
            ) : (
              <Text style={{ color: '#999', fontSize: 15 }}>Add languages</Text>
            )}
          </View>
        </Pressable>

        {/* Interests */}
        <Text style={{ fontSize: 16, fontWeight: '600', marginBottom: 8 }}>Interests</Text>
        <Pressable
          onPress={() => setShowInterestsModal(true)}
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            borderWidth: 1,
            borderColor: '#E0E0E0',
            borderRadius: 12,
            paddingHorizontal: 16,
            paddingVertical: 14,
            marginBottom: 32,
            backgroundColor: '#F9F9F9',
          }}>
          <Text style={{ fontSize: 15, color: interests.length > 0 ? '#000' : '#999' }}>
            {interests.length > 0 ? `${interests.length} selected` : 'Tap here to add interests'}
          </Text>
          <View
            style={{
              backgroundColor: '#007AFF',
              width: 24,
              height: 24,
              borderRadius: 12,
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Ionicons name="add" size={18} color="white" />
          </View>
        </Pressable>
      </ScrollView>

      {/* Date Picker Modal */}
      <Modal
        visible={showDatePicker}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDatePicker(false)}>
        <SafeAreaView
          style={{
            flex: 1,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.35)',
          }}>
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
                backgroundColor: '#007AFF',
                borderRadius: 10,
                paddingVertical: 12,
                alignItems: 'center',
              }}>
              <Text style={{ color: 'white', fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </Modal>

      {/* Country Modal */}
      <Modal
        visible={showCountryModal}
        animationType="slide"
        onRequestClose={() => setShowCountryModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#F0F0F0',
            }}>
            <Pressable onPress={() => setShowCountryModal(false)}>
              <Ionicons name="close" size={28} color="#000" />
            </Pressable>
            <Text style={{ fontSize: 20, fontWeight: '700', marginLeft: 16 }}>Select Country</Text>
          </View>
          <TextInput
            value={countrySearch}
            onChangeText={setCountrySearch}
            placeholder="Search countries..."
            style={{
              marginHorizontal: 16,
              marginVertical: 12,
              paddingHorizontal: 16,
              paddingVertical: 12,
              borderRadius: 10,
              backgroundColor: '#F0F0F0',
              fontSize: 15,
            }}
          />
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
                  paddingHorizontal: 16,
                  paddingVertical: 14,
                  borderBottomWidth: 1,
                  borderBottomColor: '#F0F0F0',
                }}>
                <Text style={{ fontSize: 28, marginRight: 12 }}>{item.flag}</Text>
                <Text style={{ fontSize: 16 }}>{item.name}</Text>
              </Pressable>
            )}
          />
        </SafeAreaView>
      </Modal>

      {/* Languages Modal */}
      <Modal
        visible={showLanguagesModal}
        animationType="slide"
        onRequestClose={() => setShowLanguagesModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#F0F0F0',
            }}>
            <Pressable onPress={() => setShowLanguagesModal(false)}>
              <Ionicons name="close" size={28} color="#000" />
            </Pressable>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>Languages</Text>
            <Pressable onPress={() => setShowLanguagesModal(false)}>
              <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={{ padding: 16 }}>
            {LANGUAGES.map((lang) => {
              const selected = languages.includes(lang.code);
              return (
                <Pressable
                  key={lang.code}
                  onPress={() => {
                    if (selected) {
                      setLanguages(languages.filter((c) => c !== lang.code));
                    } else {
                      setLanguages([...languages, lang.code]);
                    }
                  }}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    paddingVertical: 14,
                    borderBottomWidth: 1,
                    borderBottomColor: '#F0F0F0',
                  }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={{ fontSize: 24, marginRight: 10 }}>{lang.flag}</Text>
                    <Text style={{ fontSize: 16 }}>{lang.name}</Text>
                  </View>
                  {selected ? <Ionicons name="checkmark-circle" size={24} color="#007AFF" /> : null}
                </Pressable>
              );
            })}
          </ScrollView>
        </SafeAreaView>
      </Modal>

      {/* Interests Modal */}
      <Modal
        visible={showInterestsModal}
        animationType="slide"
        onRequestClose={() => setShowInterestsModal(false)}>
        <SafeAreaView style={{ flex: 1, backgroundColor: 'white' }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: 16,
              borderBottomWidth: 1,
              borderBottomColor: '#F0F0F0',
            }}>
            <Pressable onPress={() => setShowInterestsModal(false)}>
              <Ionicons name="close" size={28} color="#000" />
            </Pressable>
            <Text style={{ fontSize: 20, fontWeight: '700' }}>Interests</Text>
            <Pressable onPress={() => setShowInterestsModal(false)}>
              <Text style={{ color: '#007AFF', fontSize: 16, fontWeight: '600' }}>Done</Text>
            </Pressable>
          </View>

          <InterestsSelector
            selectedInterests={interests}
            onToggleInterest={handleToggleInterest}
            maxSelections={5}
          />
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}
