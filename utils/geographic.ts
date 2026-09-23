import { COUNTRIES, getCountryByCode, getCountryByName, getCountryFlag } from './countryFlags';
import type { Country } from './countryFlags';

export { COUNTRIES, getCountryByCode, getCountryByName, getCountryFlag } from './countryFlags';
export type { Country, CountryCode } from './countryFlags';

/**
 * Search countries by query (matches name or code)
 * @param query - Search query
 * @returns Array of matching countries
 */
export function searchCountries(query: string): Country[] {
  if (!query) return COUNTRIES;

  const q = query.toLowerCase();
  return COUNTRIES.filter(
    (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
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

/**
 * Check if a country code is valid
 * @param code - Country code to validate
 * @returns Boolean indicating if code exists
 */
export function isValidCountryCode(code: string): boolean {
  return COUNTRIES.some((c) => c.code === code.toUpperCase());
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
    const searchQuery = countryCode ? `${city}, ${countryCode}` : city;

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
