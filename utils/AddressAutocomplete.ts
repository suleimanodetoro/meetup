const API_BASE_URL = 'https://api.mapbox.com/search/searchbox/v1';
const SESSION_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface SearchOptions {
  types?: string[];
  proximity?: string;
  country?: string[];
  language?: string;
}

async function request(path: string, sessionToken: string, params = new URLSearchParams()) {
  // Only an independent UUID belongs here. In particular, never send a user's
  // Supabase bearer token to Mapbox as a search billing identifier.
  if (!SESSION_TOKEN_PATTERN.test(sessionToken)) {
    throw new Error('Mapbox search requires an independent UUID session token.');
  }

  const accessToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  if (!accessToken) throw new Error('Missing Mapbox access token.');

  params.append('session_token', sessionToken);
  params.append('access_token', accessToken);
  const response = await fetch(`${API_BASE_URL}/${path}?${params.toString()}`);
  if (!response.ok) {
    throw new Error(`Mapbox search failed (${response.status}).`);
  }
  return response.json();
}

/** Fetch suggestions using an independent UUID shared with the matching retrieve call. */
export const getSuggestions = async (
  input: string,
  sessionToken: string,
  options?: SearchOptions
) => {
  const params = new URLSearchParams({ q: input });
  if (options?.types?.length) params.append('types', options.types.join(','));
  if (options?.proximity) params.append('proximity', options.proximity);
  if (options?.country?.length) params.append('country', options.country.join(','));
  if (options?.language) params.append('language', options.language);
  return request('suggest', sessionToken, params);
};

/** Retrieve a suggestion using the same UUID, then start a new search session. */
export const retrieveDetails = async (id: string, sessionToken: string) =>
  request(`retrieve/${encodeURIComponent(id)}`, sessionToken);
