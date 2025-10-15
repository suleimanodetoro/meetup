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

/**
 * Get city coordinates using Mapbox Geocoding API
 * @param city - City name
 * @param countryCode - Optional country code for more accurate results
 * @returns Promise with lat/lng coordinates
 */
export async function getCityCoordinates(
  city: string, 
  countryCode?: string
): Promise<{ lat: number; lng: number }> {
  if (!city) {
    throw new Error('City name is required');
  }

  try {
    // Build search query - add country if provided for better accuracy
    const searchQuery = countryCode 
      ? `${city}, ${countryCode}`
      : city;

    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery)}.json?access_token=${process.env.EXPO_PUBLIC_MAPBOX_TOKEN}&types=place&limit=1`;

    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Mapbox API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (data.features && data.features.length > 0) {
      const [lng, lat] = data.features[0].center;
      return { lat, lng };
    }
    
    throw new Error(`No coordinates found for city: ${city}`);
  } catch (error) {
    console.error('Geocoding error for city:', city, error);
    throw error;
  }
}

/**
 * Synchronous version - ONLY for backward compatibility
 * Returns a default and fetches real coordinates in background
 * Use the async version above wherever possible
 */
export function getCityCoordinatesSync(city: string, countryCode?: string): { lat: number; lng: number } {
  console.warn('Using sync version - coordinates may be inaccurate. Use async getCityCoordinates() instead');
  
  // Return a default, but trigger background fetch
  getCityCoordinates(city, countryCode).catch(err => 
    console.error('Background geocoding failed:', err)
  );
  
  // Default to center of Europe as temporary placeholder
  return { lat: 50.0, lng: 10.0 };
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