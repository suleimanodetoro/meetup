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
  TouchableOpacity,
  Modal,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';

// Using a more comprehensive list of countries for better search results.
const COUNTRIES = [
    { name: 'Afghanistan', code: 'AF', flag: '🇦🇫' },
    { name: 'Albania', code: 'AL', flag: '�🇱' },
    { name: 'Algeria', code: 'DZ', flag: '🇩🇿' },
    { name: 'Andorra', code: 'AD', flag: '🇦🇩' },
    { name: 'Angola', code: 'AO', flag: '🇦🇴' },
    { name: 'Argentina', code: 'AR', flag: '🇦🇷' },
    { name: 'Armenia', code: 'AM', flag: '🇦🇲' },
    { name: 'Australia', code: 'AU', flag: '🇦🇺' },
    { name: 'Austria', code: 'AT', flag: '🇦🇹' },
    { name: 'Azerbaijan', code: 'AZ', flag: '🇦🇿' },
    { name: 'Bahamas', code: 'BS', flag: '🇧🇸' },
    { name: 'Bahrain', code: 'BH', flag: '🇧🇭' },
    { name: 'Bangladesh', code: 'BD', flag: '🇧🇩' },
    { name: 'Barbados', code: 'BB', flag: '🇧🇧' },
    { name: 'Belarus', code: 'BY', flag: '🇧🇾' },
    { name: 'Belgium', code: 'BE', flag: '🇧🇪' },
    { name: 'Belize', code: 'BZ', flag: '🇧🇿' },
    { name: 'Benin', code: 'BJ', flag: '🇧🇯' },
    { name: 'Bhutan', code: 'BT', flag: '🇧🇹' },
    { name: 'Bolivia', code: 'BO', flag: '🇧🇴' },
    { name: 'Bosnia and Herzegovina', code: 'BA', flag: '🇧🇦' },
    { name: 'Botswana', code: 'BW', flag: '🇧🇼' },
    { name: 'Brazil', code: 'BR', flag: '🇧🇷' },
    { name: 'Brunei', code: 'BN', flag: '🇧🇳' },
    { name: 'Bulgaria', code: 'BG', flag: '🇧🇬' },
    { name: 'Burkina Faso', code: 'BF', flag: '🇧🇫' },
    { name: 'Burundi', code: 'BI', flag: '🇧🇮' },
    { name: 'Cambodia', code: 'KH', flag: '🇰🇭' },
    { name: 'Cameroon', code: 'CM', flag: '🇨🇲' },
    { name: 'Canada', code: 'CA', flag: '🇨🇦' },
    { name: 'Cape Verde', code: 'CV', flag: '🇨🇻' },
    { name: 'Central African Republic', code: 'CF', flag: '🇨🇫' },
    { name: 'Chad', code: 'TD', flag: '🇹🇩' },
    { name: 'Chile', code: 'CL', flag: '🇨🇱' },
    { name: 'China', code: 'CN', flag: '🇨🇳' },
    { name: 'Colombia', code: 'CO', flag: '🇨🇴' },
    { name: 'Comoros', code: 'KM', flag: '🇰🇲' },
    { name: 'Congo', code: 'CG', flag: '🇨🇬' },
    { name: 'Costa Rica', code: 'CR', flag: '🇨🇷' },
    { name: 'Croatia', code: 'HR', flag: '🇭🇷' },
    { name: 'Cuba', code: 'CU', flag: '🇨🇺' },
    { name: 'Cyprus', code: 'CY', flag: '🇨🇾' },
    { name: 'Czech Republic', code: 'CZ', flag: '🇨🇿' },
    { name: 'Denmark', code: 'DK', flag: '🇩🇰' },
    { name: 'Djibouti', code: 'DJ', flag: '🇩🇯' },
    { name: 'Dominica', code: 'DM', flag: '🇩🇲' },
    { name: 'Dominican Republic', code: 'DO', flag: '🇩🇴' },
    { name: 'Ecuador', code: 'EC', flag: '🇪🇨' },
    { name: 'Egypt', code: 'EG', flag: '🇪🇬' },
    { name: 'El Salvador', code: 'SV', flag: '🇸🇻' },
    { name: 'Equatorial Guinea', code: 'GQ', flag: '🇬🇶' },
    { name: 'Estonia', code: 'EE', flag: '🇪🇪' },
    { name: 'Ethiopia', code: 'ET', flag: '🇪🇹' },
    { name: 'Fiji', code: 'FJ', flag: '🇫🇯' },
    { name: 'Finland', code: 'FI', flag: '🇫🇮' },
    { name: 'France', code: 'FR', flag: '🇫🇷' },
    { name: 'Gabon', code: 'GA', flag: '🇬🇦' },
    { name: 'Gambia', code: 'GM', flag: '🇬🇲' },
    { name: 'Georgia', code: 'GE', flag: '🇬🇪' },
    { name: 'Germany', code: 'DE', flag: '🇩🇪' },
    { name: 'Ghana', code: 'GH', flag: '🇬🇭' },
    { name: 'Greece', code: 'GR', flag: '🇬🇷' },
    { name: 'Guatemala', code: 'GT', flag: '🇬🇹' },
    { name: 'Guinea', code: 'GN', flag: '🇬🇳' },
    { name: 'Guyana', code: 'GY', flag: '🇬🇾' },
    { name: 'Haiti', code: 'HT', flag: '🇭🇹' },
    { name: 'Honduras', code: 'HN', flag: '🇭🇳' },
    { name: 'Hungary', code: 'HU', flag: '🇭🇺' },
    { name: 'Iceland', code: 'IS', flag: '🇮🇸' },
    { name: 'India', code: 'IN', flag: '🇮🇳' },
    { name: 'Indonesia', code: 'ID', flag: '🇮🇩' },
    { name: 'Iran', code: 'IR', flag: '🇮🇷' },
    { name: 'Iraq', code: 'IQ', flag: '🇮🇶' },
    { name: 'Ireland', code: 'IE', flag: '🇮🇪' },
    { name: 'Israel', code: 'IL', flag: '🇮🇱' },
    { name: 'Italy', code: 'IT', flag: '🇮🇹' },
    { name: 'Jamaica', code: 'JM', flag: '🇯🇲' },
    { name: 'Japan', code: 'JP', flag: '🇯🇵' },
    { name: 'Jordan', code: 'JO', flag: '🇯🇴' },
    { name: 'Kazakhstan', code: 'KZ', flag: '🇰🇿' },
    { name: 'Kenya', code: 'KE', flag: '🇰🇪' },
    { name: 'Kuwait', code: 'KW', flag: '🇰🇼' },
    { name: 'Laos', code: 'LA', flag: '🇱🇦' },
    { name: 'Latvia', code: 'LV', flag: '🇱🇻' },
    { name: 'Lebanon', code: 'LB', flag: '🇱🇧' },
    { name: 'Liberia', code: 'LR', flag: '🇱🇷' },
    { name: 'Libya', code: 'LY', flag: '🇱🇾' },
    { name: 'Lithuania', code: 'LT', flag: '🇱🇹' },
    { name: 'Luxembourg', code: 'LU', flag: '🇱🇺' },
    { name: 'Madagascar', code: 'MG', flag: '🇲🇬' },
    { name: 'Malaysia', code: 'MY', flag: '🇲🇾' },
    { name: 'Maldives', code: 'MV', flag: '🇲🇻' },
    { name: 'Mali', code: 'ML', flag: '🇲🇱' },
    { name: 'Malta', code: 'MT', flag: '🇲🇹' },
    { name: 'Mexico', code: 'MX', flag: '🇲🇽' },
    { name: 'Monaco', code: 'MC', flag: '🇲🇨' },
    { name: 'Mongolia', code: 'MN', flag: '🇲🇳' },
    { name: 'Montenegro', code: 'ME', flag: '🇲🇪' },
    { name: 'Morocco', code: 'MA', flag: '🇲🇦' },
    { name: 'Mozambique', code: 'MZ', flag: '🇲🇿' },
    { name: 'Myanmar', code: 'MM', flag: '🇲🇲' },
    { name: 'Namibia', code: 'NA', flag: '🇳🇦' },
    { name: 'Nepal', code: 'NP', flag: '🇳🇵' },
    { name: 'Netherlands', code: 'NL', flag: '🇳🇱' },
    { name: 'New Zealand', code: 'NZ', flag: '🇳🇿' },
    { name: 'Nicaragua', code: 'NI', flag: '🇳🇮' },
    { name: 'Niger', code: 'NE', flag: '🇳🇪' },
    { name: 'Nigeria', code: 'NG', flag: '🇳🇬' },
    { name: 'North Korea', code: 'KP', flag: '🇰🇵' },
    { name: 'North Macedonia', code: 'MK', flag: '🇲🇰' },
    { name: 'Norway', code: 'NO', flag: '🇳🇴' },
    { name: 'Oman', code: 'OM', flag: '🇴🇲' },
    { name: 'Pakistan', code: 'PK', flag: '🇵🇰' },
    { name: 'Panama', code: 'PA', flag: '🇵🇦' },
    { name: 'Paraguay', code: 'PY', flag: '🇵🇾' },
    { name: 'Peru', code: 'PE', flag: '🇵🇪' },
    { name: 'Philippines', code: 'PH', flag: '🇵🇭' },
    { name: 'Poland', code: 'PL', flag: '🇵🇱' },
    { name: 'Portugal', code: 'PT', flag: '🇵🇹' },
    { name: 'Qatar', code: 'QA', flag: '🇶🇦' },
    { name: 'Romania', code: 'RO', flag: '🇷🇴' },
    { name: 'Russia', code: 'RU', flag: '🇷🇺' },
    { name: 'Rwanda', code: 'RW', flag: '🇷🇼' },
    { name: 'Saudi Arabia', code: 'SA', flag: '🇸🇦' },
    { name: 'Senegal', code: 'SN', flag: '🇸🇳' },
    { name: 'Serbia', code: 'RS', flag: '🇷🇸' },
    { name: 'Singapore', code: 'SG', flag: '🇸🇬' },
    { name: 'Slovakia', code: 'SK', flag: '🇸🇰' },
    { name: 'Slovenia', code: 'SI', flag: '🇸🇮' },
    { name: 'Somalia', code: 'SO', flag: '🇸🇴' },
    { name: 'South Africa', code: 'ZA', flag: '🇿🇦' },
    { name: 'South Korea', code: 'KR', flag: '🇰🇷' },
    { name: 'Spain', code: 'ES', flag: '🇪🇸' },
    { name: 'Sri Lanka', code: 'LK', flag: '🇱🇰' },
    { name: 'Sudan', code: 'SD', flag: '🇸🇩' },
    { name: 'Sweden', code: 'SE', flag: '🇸🇪' },
    { name: 'Switzerland', code: 'CH', flag: '🇨🇭' },
    { name: 'Syria', code: 'SY', flag: '🇸🇾' },
    { name: 'Taiwan', code: 'TW', flag: '🇹🇼' },
    { name: 'Tanzania', code: 'TZ', flag: '🇹🇿' },
    { name: 'Thailand', code: 'TH', flag: '🇹🇭' },
    { name: 'Togo', code: 'TG', flag: '🇹🇬' },
    { name: 'Trinidad and Tobago', code: 'TT', flag: '🇹🇹' },
    { name: 'Tunisia', code: 'TN', flag: '🇹🇳' },
    { name: 'Turkey', code: 'TR', flag: '🇹🇷' },
    { name: 'Uganda', code: 'UG', flag: '🇺🇬' },
    { name: 'Ukraine', code: 'UA', flag: '🇺🇦' },
    { name: 'United Arab Emirates', code: 'AE', flag: '🇦🇪' },
    { name: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
    { name: 'United States', code: 'US', flag: '🇺🇸' },
    { name: 'Uruguay', code: 'UY', flag: '🇺🇾' },
    { name: 'Uzbekistan', code: 'UZ', flag: '🇺🇿' },
    { name: 'Venezuela', code: 'VE', flag: '🇻🇪' },
    { name: 'Vietnam', code: 'VN', flag: '🇻🇳' },
    { name: 'Yemen', code: 'YE', flag: '🇾🇪' },
    { name: 'Zambia', code: 'ZM', flag: '🇿🇲' },
    { name: 'Zimbabwe', code: 'ZW', flag: '🇿🇼' },
];


export default function OnboardingNationalityScreen() {
  const params = useLocalSearchParams();
  const [selectedCountry, setSelectedCountry] = useState(null);
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
        pathname: '/onboarding-gender', // Or your next screen
        params: {
          ...params,
          nationality: selectedCountry.code,
          nationalityName: selectedCountry.name,
        },
      });
    }
  };
  
  const CountryItem = ({ item }) => (
    <Pressable
      style={styles.countryItem}
      onPress={() => {
        setSelectedCountry(item);
        setModalVisible(false);
        setSearchQuery(''); // Clear search query after selection
      }}>
      <View style={styles.flagCircle}>
        <Text style={styles.flagText}>{item.flag}</Text>
      </View>
      <Text style={styles.countryName}>{item.name}</Text>
    </Pressable>
  );

  return (
    <>
      <LinearGradient colors={['#E0F2F1', '#B2DFDB']} style={styles.gradient}>
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
                Helps us connect you with other travelers 👋
              </Text>
              
              <View style={{height: 30}} />

              {/* Country Selector Button */}
              <Text style={styles.label}>Your nationality</Text>
              <Pressable style={styles.nationalityButton} onPress={() => setModalVisible(true)}>
                <Text style={styles.searchIcon}>🔍</Text>
                {selectedCountry ? (
                  <View style={styles.selectedCountryPill}>
                     <Text style={styles.flagTextSmall}>{selectedCountry.flag}</Text>
                     <Text style={styles.selectedCountryText}>{selectedCountry.name}</Text>
                     <TouchableOpacity onPress={() => setSelectedCountry(null)} style={styles.removeCountryButton}>
                        <Text style={styles.removeCountryText}>✕</Text>
                     </TouchableOpacity>
                  </View>
                ) : (
                  <Text style={styles.placeholderText}>Select your nationality</Text>
                )}
              </Pressable>
            </View>
          </View>
          
          {/* Footer with Continue Button */}
          <View style={styles.footer}>
            <Pressable
              onPress={handleContinue}
              disabled={!selectedCountry}
              style={({ pressed }) => [
                styles.continueButton,
                { backgroundColor: selectedCountry ? '#2979FF' : '#BDBDBD' },
                pressed && { opacity: 0.8 },
              ]}>
              <Text style={styles.continueButtonText}>Continue</Text>
            </Pressable>
          </View>
        </SafeAreaView>
      </LinearGradient>

      {/* Country Selection Modal */}
      <Modal
        animationType="slide"
        transparent={false}
        visible={modalVisible}
        onRequestClose={() => {
          setModalVisible(!modalVisible);
        }}
      >
        <SafeAreaView style={styles.modalContainer}>
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.flexOne}
            keyboardVerticalOffset={10}
          >
            {/* Modal Header */}
            <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Select your Nationality</Text>
                <Pressable onPress={() => setModalVisible(false)} style={styles.closeButton}>
                    <Text style={styles.closeButtonText}>Done</Text>
                </Pressable>
            </View>

            {/* Search Input inside Modal */}
            <View style={styles.inputContainer}>
              <Text style={styles.searchIcon}>🔍</Text>
              <TextInput
                style={styles.input}
                placeholder="Search for a country"
                placeholderTextColor="#9E9E9E"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus={true}
              />
              {searchQuery.length > 0 && (
                <TouchableOpacity onPress={() => setSearchQuery('')} style={styles.clearButton}>
                  <Text style={styles.clearButtonText}>✕</Text>
                </TouchableOpacity>
              )}
            </View>
            
            {/* List of Countries */}
            <FlatList
              style={styles.list}
              data={filteredCountries}
              renderItem={CountryItem}
              keyExtractor={item => item.code}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </KeyboardAvoidingView>
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  flexOne: {
    flex: 1,
  },
  gradient: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingTop: 10,
  },
  backButton: {
    padding: 10,
  },
  backArrow: {
    fontSize: 24,
    color: '#333',
  },
  mapEmoji: {
    fontSize: 50,
    marginRight: 10,
  },
  contentContainer: {
    paddingHorizontal: 25,
    flex: 1,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#212121',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#616161',
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#424242',
    marginBottom: 12,
  },
  nationalityButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    height: 50,
  },
  placeholderText: {
    fontSize: 16,
    color: '#9E9E9E',
  },
  selectedCountryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E3F2FD',
    borderRadius: 16,
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  flagTextSmall: {
    fontSize: 16,
    marginRight: 6,
  },
  selectedCountryText: {
    fontSize: 16,
    color: '#1E88E5',
    fontWeight: '500',
    marginRight: 6,
  },
  removeCountryButton: {
    padding: 2,
  },
  removeCountryText: {
    fontSize: 12,
    color: '#1E88E5',
    fontWeight: 'bold',
  },
  footer: {
    padding: 20,
    paddingBottom: 30, // Extra padding for home bar
    backgroundColor: 'transparent',
  },
  continueButton: {
    paddingVertical: 15,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    elevation: 5,
  },
  continueButtonText: {
    fontSize: 18,
    color: '#FFFFFF',
    fontWeight: 'bold',
  },
  // Modal Styles
  modalContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  closeButton: {
    padding: 5,
  },
  closeButtonText: {
    fontSize: 17,
    color: '#2979FF',
    fontWeight: '600',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    margin: 20,
  },
  searchIcon: {
    fontSize: 18,
    marginRight: 10,
    color: '#757575',
  },
  input: {
    flex: 1,
    height: 50,
    fontSize: 16,
    color: '#212121',
  },
  clearButton: {
    padding: 5,
    marginLeft: 5,
  },
  clearButtonText: {
    fontSize: 14,
    color: '#757575',
  },
  list: {
    flex: 1,
    paddingHorizontal: 20,
  },
  countryItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  flagCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#EEEEEE',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 15,
  },
  flagText: {
    fontSize: 22,
  },
  countryName: {
    fontSize: 17,
    color: '#212121',
  },
  separator: {
    height: 1,
    backgroundColor: '#EEEEEE',
  },
});
