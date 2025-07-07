const API_BASE_URL = "https://api.mapbox.com/search/searchbox/v1";
const access_token = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;

// Ensure access token is present
if (!access_token) {
  throw new Error("Missing Mapbox access token.");
}

/**
 * Get search suggestions from Mapbox Search Box API.
 * @param input - User's typed input
 * @param session_token - Unique session token (UUID)
 */
export const getSuggestions = async (input: string, session_token: string) => {
  // TODO: When user location is available, add proximity like:
  // const proximity = "-73.9857,40.7484"; // longitude,latitude
  // `&proximity=${proximity}`

  const response = await fetch(
    `${API_BASE_URL}/suggest?q=${encodeURIComponent(input)}&session_token=${session_token}&access_token=${access_token}`
  );

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
