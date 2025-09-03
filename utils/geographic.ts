// utils/geographic.ts

// Move these objects here:
export const COUNTRIES = [
  { name: 'Afghanistan', code: 'AF', flag: '🇦🇫' },
  { name: 'Albania', code: 'AL', flag: '🇦🇱' },
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
  { name: 'Hong Kong', code: 'HK', flag: '🇭🇰' },
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
// ============= POPULAR DESTINATIONS =============
export const POPULAR_DESTINATIONS = [
  { city: 'London', country: 'United Kingdom', code: 'GB', flag: '🇬🇧' },
  { city: 'Paris', country: 'France', code: 'FR', flag: '🇫🇷' },
  { city: 'Tokyo', country: 'Japan', code: 'JP', flag: '🇯🇵' },
  { city: 'New York', country: 'United States', code: 'US', flag: '🇺🇸' },
  { city: 'Barcelona', country: 'Spain', code: 'ES', flag: '🇪🇸' },
  { city: 'Amsterdam', country: 'Netherlands', code: 'NL', flag: '🇳🇱' },
  { city: 'Dubai', country: 'United Arab Emirates', code: 'AE', flag: '🇦🇪' },
  { city: 'Singapore', country: 'Singapore', code: 'SG', flag: '🇸🇬' },
  { city: 'Bangkok', country: 'Thailand', code: 'TH', flag: '🇹🇭' },
  { city: 'Rome', country: 'Italy', code: 'IT', flag: '🇮🇹' },
  { city: 'Sydney', country: 'Australia', code: 'AU', flag: '🇦🇺' },
  { city: 'Istanbul', country: 'Turkey', code: 'TR', flag: '🇹🇷' },
  { city: 'Los Angeles', country: 'United States', code: 'US', flag: '🇺🇸' },
  { city: 'Berlin', country: 'Germany', code: 'DE', flag: '🇩🇪' },
  { city: 'Madrid', country: 'Spain', code: 'ES', flag: '🇪🇸' },
  { city: 'Seoul', country: 'South Korea', code: 'KR', flag: '🇰🇷' },
  { city: 'Mumbai', country: 'India', code: 'IN', flag: '🇮🇳' },
  { city: 'Cairo', country: 'Egypt', code: 'EG', flag: '🇪🇬' },
  { city: 'Rio de Janeiro', country: 'Brazil', code: 'BR', flag: '🇧🇷' },
  { city: 'Cape Town', country: 'South Africa', code: 'ZA', flag: '🇿🇦' },
  { city: 'Toronto', country: 'Canada', code: 'CA', flag: '🇨🇦' },
  { city: 'Mexico City', country: 'Mexico', code: 'MX', flag: '🇲🇽' },
  { city: 'Buenos Aires', country: 'Argentina', code: 'AR', flag: '🇦🇷' },
  { city: 'Moscow', country: 'Russia', code: 'RU', flag: '🇷🇺' },
  { city: 'Hong Kong', country: 'China', code: 'HK', flag: '🇭🇰' },
  { city: 'Lisbon', country: 'Portugal', code: 'PT', flag: '🇵🇹' },
  { city: 'Prague', country: 'Czech Republic', code: 'CZ', flag: '🇨🇿' },
  { city: 'Vienna', country: 'Austria', code: 'AT', flag: '🇦🇹' },
  { city: 'Athens', country: 'Greece', code: 'GR', flag: '🇬🇷' },
  { city: 'Venice', country: 'Italy', code: 'IT', flag: '🇮🇹' },
] as const;
// ============= TYPE DEFINITIONS =============
export type Country = {
  name: string;
  code: string;
  flag: string;
};

export type Destination = {
  city: string;
  country: string;
  code: string;
  flag: string;
};

export type CountryCode = string;

// ============= COUNTRY HELPERS =============

/**
 * Get country flag emoji by country code
 * @param code - ISO country code (e.g., 'US', 'GB', 'FR')
 * @returns Flag emoji or default flag if not found
 */
export function getCountryFlag(code: string | null | undefined): string {
  if (!code) return '🏳️';
  
  const country = COUNTRIES.find(c => c.code === code.toUpperCase());
  return country?.flag || '🏳️';
}

/**
 * Get country info by country code
 * @param code - ISO country code
 * @returns Country object with name, code, and flag
 */
export function getCountryByCode(code: string | null | undefined): Country | null {
  if (!code) return null;
  
  return COUNTRIES.find(c => c.code === code.toUpperCase()) || null;
}

/**
 * Get country info by country name
 * @param name - Country name
 * @returns Country object with name, code, and flag
 */
export function getCountryByName(name: string | null | undefined): Country | null {
  if (!name) return null;
  
  return COUNTRIES.find(c => 
    c.name.toLowerCase() === name.toLowerCase()
  ) || null;
}

/**
 * Search countries by query (matches name or code)
 * @param query - Search query
 * @returns Array of matching countries
 */
export function searchCountries(query: string): Country[] {
  if (!query) return COUNTRIES;
  
  const q = query.toLowerCase();
  return COUNTRIES.filter(c => 
    c.name.toLowerCase().includes(q) || 
    c.code.toLowerCase().includes(q)
  );
}

/**
 * Get country flag by name (convenience function)
 * @param name - Country name
 * @returns Flag emoji or default flag if not found
 */
export function getCountryFlagByName(name: string | null | undefined): string {
  const country = getCountryByName(name);
  return country?.flag || '🏳️';
}

/**
 * Sort countries alphabetically by name
 * @returns Sorted array of countries
 */
export function getSortedCountries(): Country[] {
  return [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));
}

// ============= DESTINATION HELPERS =============

/**
 * Search destinations by city or country name
 * @param query - Search query
 * @returns Array of matching destinations
 */
export function searchDestinations(query: string): Destination[] {
  if (!query) return POPULAR_DESTINATIONS;
  
  const q = query.toLowerCase();
  return POPULAR_DESTINATIONS.filter(dest => 
    dest.city.toLowerCase().includes(q) || 
    dest.country.toLowerCase().includes(q)
  );
}

/**
 * Get destinations by country code
 * @param countryCode - ISO country code
 * @returns Array of destinations in that country
 */
export function getDestinationsByCountry(countryCode: string): Destination[] {
  if (!countryCode) return [];
  
  return POPULAR_DESTINATIONS.filter(dest => 
    dest.code === countryCode.toUpperCase()
  );
}

/**
 * Get destination by city name
 * @param cityName - City name
 * @returns Destination object or null
 */
export function getDestinationByCity(cityName: string): Destination | null {
  if (!cityName) return null;
  
  return POPULAR_DESTINATIONS.find(dest => 
    dest.city.toLowerCase() === cityName.toLowerCase()
  ) || null;
}

/**
 * Get unique countries from destinations
 * @returns Array of unique countries that have popular destinations
 */
export function getDestinationCountries(): Country[] {
  const uniqueCodes = [...new Set(POPULAR_DESTINATIONS.map(d => d.code))];
  return uniqueCodes
    .map(code => getCountryByCode(code))
    .filter((c): c is Country => c !== null);
}


/**
 * Sort destinations alphabetically by city name
 * @returns Sorted array of destinations
 */
export function getSortedDestinations(): Destination[] {
  return [...POPULAR_DESTINATIONS].sort((a, b) => a.city.localeCompare(b.city));
}

/**
 * Sort destinations by country, then by city
 * @returns Sorted array of destinations grouped by country
 */
export function getDestinationsGroupedByCountry(): Destination[] {
  return [...POPULAR_DESTINATIONS].sort((a, b) => {
    const countryCompare = a.country.localeCompare(b.country);
    if (countryCompare !== 0) return countryCompare;
    return a.city.localeCompare(b.city);
  });
}

/**
 * Get random destinations
 * @param count - Number of random destinations to return
 * @returns Array of random destinations
 */
export function getRandomDestinations(count: number = 5): Destination[] {
  const shuffled = [...POPULAR_DESTINATIONS].sort(() => 0.5 - Math.random());
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Check if a country code is valid
 * @param code - Country code to validate
 * @returns Boolean indicating if code exists
 */
export function isValidCountryCode(code: string): boolean {
  return COUNTRIES.some(c => c.code === code.toUpperCase());
}

/**
 * Check if a city is in popular destinations
 * @param cityName - City name to check
 * @returns Boolean indicating if city is popular
 */
export function isPopularDestination(cityName: string): boolean {
  return POPULAR_DESTINATIONS.some(d => 
    d.city.toLowerCase() === cityName.toLowerCase()
  );
}

// ============= FORMATTING HELPERS =============

/**
 * Format location with flag
 * @param city - City name
 * @param countryCode - Country code
 * @returns Formatted string like "🇬🇧 London, United Kingdom"
 */
export function formatLocation(city: string, countryCode: string): string {
  const flag = getCountryFlag(countryCode);
  const country = getCountryByCode(countryCode);
  
  if (country) {
    return `${flag} ${city}, ${country.name}`;
  }
  return `${flag} ${city}`;
}

/**
 * Format location short (city only with flag)
 * @param city - City name
 * @param countryCode - Country code
 * @returns Formatted string like "🇬🇧 London"
 */
export function formatLocationShort(city: string, countryCode: string): string {
  const flag = getCountryFlag(countryCode);
  return `${flag} ${city}`;
}

/**
 * Get display name for country with flag
 * @param countryCode - Country code
 * @returns Formatted string like "🇬🇧 United Kingdom"
 */
export function formatCountryWithFlag(countryCode: string): string {
  const country = getCountryByCode(countryCode);
  if (!country) return countryCode;
  
  return `${country.flag} ${country.name}`;
}
export function getCityCoordinates(city: string): { lat: number; lng: number } {
  // This is a simplified version - you should use a proper geocoding service
  // or expand this list based on your popular cities
  const cityCoordinates: Record<string, { lat: number; lng: number }> = {
    // Europe
    'London': { lat: 51.5074, lng: -0.1278 },
    'Paris': { lat: 48.8566, lng: 2.3522 },
    'Barcelona': { lat: 41.3851, lng: 2.1734 },
    'Madrid': { lat: 40.4168, lng: -3.7038 },
    'Rome': { lat: 41.9028, lng: 12.4964 },
    'Berlin': { lat: 52.5200, lng: 13.4050 },
    'Amsterdam': { lat: 52.3676, lng: 4.9041 },
    'Prague': { lat: 50.0755, lng: 14.4378 },
    'Vienna': { lat: 48.2082, lng: 16.3738 },
    'Lisbon': { lat: 38.7223, lng: -9.1393 },
    'Dublin': { lat: 53.3498, lng: -6.2603 },
    'Copenhagen': { lat: 55.6761, lng: 12.5683 },
    'Stockholm': { lat: 59.3293, lng: 18.0686 },
    'Athens': { lat: 37.9838, lng: 23.7275 },
    'Budapest': { lat: 47.4979, lng: 19.0402 },
    'Warsaw': { lat: 52.2297, lng: 21.0122 },
    
    // Spain specific
    'Malaga': { lat: 36.7213, lng: -4.4214 },
    'Valencia': { lat: 39.4699, lng: -0.3763 },
    'Seville': { lat: 37.3891, lng: -5.9845 },
    'Ibiza': { lat: 38.9067, lng: 1.4206 },
    'Mallorca': { lat: 39.5696, lng: 2.6502 },
    'Bilbao': { lat: 43.2630, lng: -2.9350 },
    
    // Americas
    'New York': { lat: 40.7128, lng: -74.0060 },
    'Los Angeles': { lat: 34.0522, lng: -118.2437 },
    'San Francisco': { lat: 37.7749, lng: -122.4194 },
    'Chicago': { lat: 41.8781, lng: -87.6298 },
    'Miami': { lat: 25.7617, lng: -80.1918 },
    'Toronto': { lat: 43.6532, lng: -79.3832 },
    'Vancouver': { lat: 49.2827, lng: -123.1207 },
    'Montreal': { lat: 45.5017, lng: -73.5673 },
    'Mexico City': { lat: 19.4326, lng: -99.1332 },
    'Buenos Aires': { lat: -34.6037, lng: -58.3816 },
    'Rio de Janeiro': { lat: -22.9068, lng: -43.1729 },
    'São Paulo': { lat: -23.5505, lng: -46.6333 },
    'Lima': { lat: -12.0464, lng: -77.0428 },
    
    // Asia
    'Tokyo': { lat: 35.6762, lng: 139.6503 },
    'Seoul': { lat: 37.5665, lng: 126.9780 },
    'Beijing': { lat: 39.9042, lng: 116.4074 },
    'Shanghai': { lat: 31.2304, lng: 121.4737 },
    'Hong Kong': { lat: 22.3193, lng: 114.1694 },
    'Singapore': { lat: 1.3521, lng: 103.8198 },
    'Bangkok': { lat: 13.7563, lng: 100.5018 },
    'Bali': { lat: -8.3405, lng: 115.0920 },
    'Dubai': { lat: 25.2048, lng: 55.2708 },
    'Istanbul': { lat: 41.0082, lng: 28.9784 },
    'Mumbai': { lat: 19.0760, lng: 72.8777 },
    'Delhi': { lat: 28.7041, lng: 77.1025 },
    
    // Oceania
    'Sydney': { lat: -33.8688, lng: 151.2093 },
    'Melbourne': { lat: -37.8136, lng: 144.9631 },
    'Auckland': { lat: -36.8485, lng: 174.7633 },
    'Brisbane': { lat: -27.4698, lng: 153.0251 },
    'Perth': { lat: -31.9505, lng: 115.8605 },
    
    // Africa
    'Cape Town': { lat: -33.9249, lng: 18.4241 },
    'Johannesburg': { lat: -26.2041, lng: 28.0473 },
    'Cairo': { lat: 30.0444, lng: 31.2357 },
    'Marrakech': { lat: 31.6295, lng: -7.9811 },
    'Lagos': { lat: 6.5244, lng: 3.3792 },
    'Nairobi': { lat: -1.2921, lng: 36.8219 },
  };
  
  // Try exact match first
  if (cityCoordinates[city]) {
    return cityCoordinates[city];
  }
  
  // Try case-insensitive match
  const lowerCity = city.toLowerCase();
  for (const [key, coords] of Object.entries(cityCoordinates)) {
    if (key.toLowerCase() === lowerCity) {
      return coords;
    }
  }
  
  // Default fallback (center of Europe - reasonable for travel app)
  console.warn(`Coordinates not found for city: ${city}, using default`);
  return { lat: 48.8566, lng: 2.3522 }; // Paris as default
}

// ============= VALIDATION HELPERS =============

/**
 * Validate location data
 * @param location - Object with city, country, and/or country_code
 * @returns Object with validation results
 */
export function validateLocation(location: {
  city?: string;
  country?: string;
  country_code?: string;
}): {
  isValid: boolean;
  errors: string[];
  normalized: {
    city: string;
    country: string;
    country_code: string;
    flag: string;
  } | null;
} {
  const errors: string[] = [];
  
  if (!location.city) {
    errors.push('City is required');
  }
  
  if (!location.country_code) {
    errors.push('Country code is required');
  } else if (!isValidCountryCode(location.country_code)) {
    errors.push('Invalid country code');
  }
  
  if (errors.length > 0) {
    return { isValid: false, errors, normalized: null };
  }
  
  const country = getCountryByCode(location.country_code!);
  
  return {
    isValid: true,
    errors: [],
    normalized: {
      city: location.city!,
      country: country?.name || location.country || '',
      country_code: location.country_code!.toUpperCase(),
      flag: getCountryFlag(location.country_code!),
    },
  };
}