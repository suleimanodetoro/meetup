// utils/AddressAutocomplete.ts
const API_BASE_URL = "https://api.mapbox.com/search/searchbox/v1";
const access_token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

// Ensure access token is present
if (!access_token) {
  throw new Error("Missing Mapbox access token.");
}

interface SearchOptions {
  types?: string[];  // e.g., ['place', 'locality', 'poi', 'address']
  proximity?: string;  // e.g., "lng,lat"
  country?: string[];  // e.g., ['US', 'CA']
  language?: string;  // e.g., 'en'
}

/**
 * Get search suggestions from Mapbox Search Box API.
 * @param input - User's typed input
 * @param session_token - Unique session token (UUID)
 * @param options - Optional search parameters
 */
export const getSuggestions = async (
  input: string, 
  session_token: string,
  options?: SearchOptions
) => {
  // Build query parameters
  let url = `${API_BASE_URL}/suggest?q=${encodeURIComponent(input)}&session_token=${session_token}&access_token=${access_token}`;
  
  // Add types parameter for filtering (most important for your use case)
  if (options?.types && options.types.length > 0) {
    url += `&types=${options.types.join(',')}`;
  }
  
  // Add proximity for geographic biasing
  if (options?.proximity) {
    url += `&proximity=${options.proximity}`;
  }
  
  // Add country filtering
  if (options?.country && options.country.length > 0) {
    url += `&country=${options.country.join(',')}`;
  }
  
  // Add language
  if (options?.language) {
    url += `&language=${options.language}`;
  }

  const response = await fetch(url);
  const json = await response.json();
  console.log("Suggestions response:", json);
  return json;
};

/**
 * Retrieve full place details using a mapbox_id from a suggestion.
 * @param id - Mapbox feature ID
 * @param session_token - Same session token used with `getSuggestions`
 */
export const retrieveDetails = async (id: string, session_token: string) => {
  const response = await fetch(
    `${API_BASE_URL}/retrieve/${id}?session_token=${session_token}&access_token=${access_token}`
  );

  const json = await response.json();
  console.log("Retrieve response:", json);
  return json;
};