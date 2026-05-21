// app/(auth)/onboarding-nationality.tsx
import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  Pressable,
  SafeAreaView,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { COUNTRIES } from '~/utils/countryFlags';

type Country = (typeof COUNTRIES)[number];

export default function OnboardingNationalityScreen() {
  const params = useLocalSearchParams();
  const [selectedCountry, setSelectedCountry] = useState<Country | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [modalVisible, setModalVisible] = useState(false);

  const filteredCountries = useMemo(() => {
    if (!searchQuery) {
      return COUNTRIES;
    }
    return COUNTRIES.filter(country =>
      country.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery]);

  const handleContinue = () => {
    if (selectedCountry) {
      router.push({
        pathname: '/onboarding-gender',
        params: {
          ...params,
          nationality: selectedCountry.code,
          nationalityName: selectedCountry.name,
        },
      });
    }
  };
  
  const CountryItem = ({ item }: { item: Country }) => (
    <Pressable
      style={styles.countryItem}
      onPress={() => {
        setSelectedCountry(item);
        setModalVisible(false);
        setSearchQuery('');
      }}>
      <View style={styles.flagCircle}>
        <Text style={styles.flagText}>{item.flag}</Text>
      </View>
      <Text style={styles.countryName}>{item.name}</Text>
    </Pressable>
  );

  return (
    <>
      <LinearGradient colors={['#E3F2FD', '#BBDEFB', '#90CAF9']} style={styles.gradient}>
        <SafeAreaView style={styles.flexOne}>
          <View style={styles.flexOne}>
            {/* Header */}
            <View style={styles.header}>
              <Pressable onPress={() => router.back()} style={styles.backButton}>
                <Text style={styles.backArrow}>←</Text>
              </Pressable>
              <View style={{flex: 1, alignItems: 'flex-end'}}>
                  <Text style={styles.mapEmoji}>🗺️</Text>
              </View>
            </View>

            <View style={styles.contentContainer}>
              {/* Title */}
              <Text style={styles.title}>Where are you from?</Text>
              <Text style={styles.subtitle}>
                Helps us connect you with people around the world 👋
              </Text>
              
              <View style={{height: 30}} />

              {/* Country Selector Button */}
              <Text style={styles.label}>Your country</Text>
              <Pressable style={styles.nationalityButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.searchIcon}>🔍</Text>
                {selectedCountry ? (
                  <View style={{flexDirection: 'row', alignItems: 'center', gap: 8}}>
                    <Text style={{fontSize: 24}}>{selectedCountry.flag}</Text>
                    <Text style={styles.selectedText}>{selectedCountry.name}</Text>
                  </View>
                ) : (
                  <Text style={styles.placeholderText}>Select your country</Text>
                )}
              </Pressable>
            </View>
          </View>

          {/* Continue Button */}
          <View style={styles.buttonContainer}>
            <Pressable
              onPress={handleContinue}
              disabled={!selectedCountry}
              style={[
                styles.continueButton,
                !selectedCountry && styles.continueButtonDisabled
              ]}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Country Search Modal */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}>
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Pressable onPress={() => setModalVisible(false)} style={styles.modalCloseButton}>
              <Text style={styles.modalCloseText}>✕</Text>
            </Pressable>
            <Text style={styles.modalTitle}>Select Country</Text>
            <View style={{width: 40}} />
          </View>

          <View style={styles.searchContainer}>
            <Text style={styles.searchIconModal}>🔍</Text>
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Search countries..."
              placeholderTextColor="#999"
              style={styles.searchInput}
              autoFocus
            />
          </View>

          <FlatList
            data={filteredCountries}
            keyExtractor={item => item.code}
            renderItem={({ item }) => <CountryItem item={item} />}
            showsVerticalScrollIndicator={false}
          />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  flexOne: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  backButton: {
    padding: 10,
  },
  backArrow: {
    fontSize: 30,
  },
  mapEmoji: {
    fontSize: 50,
  },
  contentContainer: {
    flex: 1,
    paddingHorizontal: 30,
    paddingTop: 30,
  },
  title: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  nationalityButton: {
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
  },
  searchIcon: {
    fontSize: 20,
  },
  selectedText: {
    fontSize: 18,
    color: '#333',
  },
  placeholderText: {
    fontSize: 18,
    color: '#999',
  },
  buttonContainer: {
    paddingHorizontal: 30,
    paddingBottom: 30,
  },
  continueButton: {
    backgroundColor: '#007AFF',
    paddingVertical: 18,
    borderRadius: 30,
    alignItems: 'center',
  },
  continueButtonDisabled: {
    backgroundColor: '#ccc',
  },
  continueButtonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalCloseButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: {
    fontSize: 24,
    color: '#666',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    marginHorizontal: 20,
    marginVertical: 15,
    paddingHorizontal: 15,
    borderRadius: 12,
  },
  searchIconModal: {
    fontSize: 18,
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  flagCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F5F5F5',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  flagText: {
    fontSize: 24,
  },
  countryName: {
    fontSize: 17,
    fontWeight: '500',
  },
});