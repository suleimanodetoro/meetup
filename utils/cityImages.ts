// utils/cityImages.ts
// ============================================
// Utilities for getting city images
// ============================================

// Map of popular cities to specific Pexels image IDs for consistent, quality images
const CITY_IMAGE_MAP: Record<string, string> = {
  // Europe
  'london': 'https://images.pexels.com/photos/460672/pexels-photo-460672.jpeg',
  'paris': 'https://images.pexels.com/photos/338515/pexels-photo-338515.jpeg',
  'rome': 'https://images.pexels.com/photos/2064827/pexels-photo-2064827.jpeg',
  'barcelona': 'https://images.pexels.com/photos/1388030/pexels-photo-1388030.jpeg',
  'amsterdam': 'https://images.pexels.com/photos/2031706/pexels-photo-2031706.jpeg',
  'berlin': 'https://images.pexels.com/photos/1932514/pexels-photo-1932514.jpeg',
  'athens': 'https://images.pexels.com/photos/772689/pexels-photo-772689.jpeg',
  'lisbon': 'https://images.pexels.com/photos/2811856/pexels-photo-2811856.jpeg',
  'prague': 'https://images.pexels.com/photos/161935/prague-czech-republic-city-161935.jpeg',
  'vienna': 'https://images.pexels.com/photos/3182532/pexels-photo-3182532.jpeg',
  
  // Asia
  'tokyo': 'https://images.pexels.com/photos/2187456/pexels-photo-2187456.jpeg',
  'kyoto': 'https://images.pexels.com/photos/161401/fushimi-inari-taisha-shrine-kyoto-japan-temple-161401.jpeg',
  'bangkok': 'https://images.pexels.com/photos/1031659/pexels-photo-1031659.jpeg',
  'singapore': 'https://images.pexels.com/photos/290595/pexels-photo-290595.jpeg',
  'dubai': 'https://images.pexels.com/photos/1707310/pexels-photo-1707310.jpeg',
  'hong kong': 'https://images.pexels.com/photos/2090645/pexels-photo-2090645.jpeg',
  'seoul': 'https://images.pexels.com/photos/237211/pexels-photo-237211.jpeg',
  'shanghai': 'https://images.pexels.com/photos/683419/pexels-photo-683419.jpeg',
  'beijing': 'https://images.pexels.com/photos/2412603/pexels-photo-2412603.jpeg',
  'mumbai': 'https://images.pexels.com/photos/2104882/pexels-photo-2104882.jpeg',
  
  // Americas
  'new york': 'https://images.pexels.com/photos/290386/pexels-photo-290386.jpeg',
  'los angeles': 'https://images.pexels.com/photos/2695679/pexels-photo-2695679.jpeg',
  'san francisco': 'https://images.pexels.com/photos/208745/pexels-photo-208745.jpeg',
  'miami': 'https://images.pexels.com/photos/3024993/pexels-photo-3024993.jpeg',
  'toronto': 'https://images.pexels.com/photos/374870/pexels-photo-374870.jpeg',
  'vancouver': 'https://images.pexels.com/photos/2422588/pexels-photo-2422588.jpeg',
  'mexico city': 'https://images.pexels.com/photos/3182550/pexels-photo-3182550.jpeg',
  'buenos aires': 'https://images.pexels.com/photos/2983037/pexels-photo-2983037.jpeg',
  'rio de janeiro': 'https://images.pexels.com/photos/351283/pexels-photo-351283.jpeg',
  'sao paulo': 'https://images.pexels.com/photos/97906/pexels-photo-97906.jpeg',
  
  // Oceania
  'sydney': 'https://images.pexels.com/photos/995764/pexels-photo-995764.jpeg',
  'melbourne': 'https://images.pexels.com/photos/2121120/pexels-photo-2121120.jpeg',
  'auckland': 'https://images.pexels.com/photos/2259917/pexels-photo-2259917.jpeg',
  
  // Africa & Middle East
  'cairo': 'https://images.pexels.com/photos/3290075/pexels-photo-3290075.jpeg',
  'cape town': 'https://images.pexels.com/photos/259447/pexels-photo-259447.jpeg',
  'marrakech': 'https://images.pexels.com/photos/3889891/pexels-photo-3889891.jpeg',
  'istanbul': 'https://images.pexels.com/photos/2041830/pexels-photo-2041830.jpeg',
  'tel aviv': 'https://images.pexels.com/photos/3199399/pexels-photo-3199399.jpeg',
};

// Generic travel images for fallback (from Pexels)
const FALLBACK_TRAVEL_IMAGES = [
  'https://images.pexels.com/photos/346885/pexels-photo-346885.jpeg', // Beach
  'https://images.pexels.com/photos/1285625/pexels-photo-1285625.jpeg', // Mountain city
  'https://images.pexels.com/photos/466685/pexels-photo-466685.jpeg', // City skyline
  'https://images.pexels.com/photos/1486222/pexels-photo-1486222.jpeg', // European street
  'https://images.pexels.com/photos/2350351/pexels-photo-2350351.jpeg', // Asian temple
  'https://images.pexels.com/photos/1796715/pexels-photo-1796715.jpeg', // Desert city
  'https://images.pexels.com/photos/208701/pexels-photo-208701.jpeg', // Coastal city
  'https://images.pexels.com/photos/2193300/pexels-photo-2193300.jpeg', // Modern city
];

/**
 * Get a consistent image URL for a city
 * @param city - City name (can include spaces, special characters)
 * @returns A Pexels image URL with quality parameters
 */
export function getCityImageUrl(city: string): string {
  // Normalize city name for lookup
  const normalizedCity = city.toLowerCase().trim();
  
  // Check if we have a specific image for this city
  if (CITY_IMAGE_MAP[normalizedCity]) {
    // Add Pexels parameters for optimization
    const url = CITY_IMAGE_MAP[normalizedCity];
    // Add parameters: auto=compress for optimization, fit=crop for consistent sizing
    return `${url}?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2`;
  }
  
  // For unknown cities, use a consistent fallback based on city name hash
  // This ensures the same city always gets the same image
  const hash = normalizedCity.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + ((acc << 5) - acc);
  }, 0);
  const imageIndex = Math.abs(hash) % FALLBACK_TRAVEL_IMAGES.length;
  const fallbackUrl = FALLBACK_TRAVEL_IMAGES[imageIndex];
  
  return `${fallbackUrl}?auto=compress&cs=tinysrgb&w=800&h=600&dpr=2`;
}

/**
 * Alternative: Use Lorem Picsum for placeholder images
 * This always works but images are generic
 */
export function getPlaceholderImageUrl(seed: string): string {
  // Use city name as seed for consistent images
  const seedNumber = seed.split('').reduce((acc, char) => {
    return char.charCodeAt(0) + acc;
  }, 0);
  
  // Lorem Picsum provides random images with optional seed
  return `https://picsum.photos/seed/${seedNumber}/800/600`;
}
