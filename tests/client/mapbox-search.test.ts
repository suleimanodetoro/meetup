import assert from 'node:assert/strict';
import { test } from 'node:test';
import { getSuggestions, retrieveDetails } from '../../utils/AddressAutocomplete.ts';

const SESSION_TOKEN = '9742a77d-36e3-452f-9c34-a8f8863738db';

test('Mapbox requests reject authentication tokens before sending a network request', async (t) => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('{}'));
  const bearerToken = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ1c2VyIn0.signature';

  await assert.rejects(getSuggestions('London', bearerToken), /independent UUID/);
  await assert.rejects(retrieveDetails('place-1', bearerToken), /independent UUID/);
  assert.equal(fetch.mock.callCount(), 0);
});

test('suggest and retrieve share an independent session ID and safely encode query values', async (t) => {
  const previousToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN = 'pk.mapbox-test';
  t.after(() => {
    if (previousToken === undefined) delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    else process.env.EXPO_PUBLIC_MAPBOX_TOKEN = previousToken;
  });
  const requests: URL[] = [];
  t.mock.method(globalThis, 'fetch', async (input: string) => {
    requests.push(new URL(input));
    return new Response(JSON.stringify({ suggestions: [] }));
  });

  await getSuggestions('Bath & Bristol?session_token=unexpected', SESSION_TOKEN, {
    types: ['place', 'locality'],
    country: ['GB'],
    language: 'en',
  });
  await retrieveDetails('place/id?query=value', SESSION_TOKEN);

  assert.equal(requests.length, 2);
  for (const url of requests) {
    assert.equal(url.origin, 'https://api.mapbox.com');
    assert.equal(url.searchParams.get('session_token'), SESSION_TOKEN);
    assert.equal(url.searchParams.get('access_token'), 'pk.mapbox-test');
  }
  assert.equal(requests[0].searchParams.get('q'), 'Bath & Bristol?session_token=unexpected');
  assert.equal(requests[0].searchParams.get('types'), 'place,locality');
  assert.equal(requests[0].searchParams.get('country'), 'GB');
  assert.equal(requests[0].searchParams.get('language'), 'en');
  assert.equal(requests[1].pathname, '/search/searchbox/v1/retrieve/place%2Fid%3Fquery%3Dvalue');
});

test('Mapbox HTTP errors reject instead of masquerading as empty search results', async (t) => {
  const previousToken = process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
  process.env.EXPO_PUBLIC_MAPBOX_TOKEN = 'pk.mapbox-test';
  t.after(() => {
    if (previousToken === undefined) delete process.env.EXPO_PUBLIC_MAPBOX_TOKEN;
    else process.env.EXPO_PUBLIC_MAPBOX_TOKEN = previousToken;
  });
  t.mock.method(globalThis, 'fetch', async () => new Response('{}', { status: 429 }));

  await assert.rejects(getSuggestions('London', SESSION_TOKEN), /Mapbox search failed \(429\)/);
  await assert.rejects(retrieveDetails('place-1', SESSION_TOKEN), /Mapbox search failed \(429\)/);
});
