import { useEffect, useState } from 'react';
import { supabase } from '~/utils/supabase';

export interface CityUser {
  user_id: string;
  full_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  nationality_code: string | null;
  is_verified: boolean;
  visit_start: string;
  visit_end: string;
}

export interface CityPlan {
  event_id: number;
  title: string;
  description: string | null;
  image_uri: string | null;
  date: string;
  end_date: string | null;
  location_name: string | null;
  cost: number | null;
  cost_currency: string | null;
  attendee_count: number;
  host_name: string | null;
  host_avatar: string | null;
}

export interface CityOverview {
  city: string;
  country: string | null;
  country_code: string | null;
  user_count: number;
  plan_count: number;
}

/**
 * One round-trip to `get_city_overview(city_name)`. Returns the city's
 * metadata + counts and the user/plan arrays. No visit_id concept; the
 * screen always renders, even for cities with zero current visitors or
 * zero upcoming plans.
 */
export function useCityOverview(cityName: string | undefined) {
  const [overview, setOverview] = useState<CityOverview | null>(null);
  const [users, setUsers] = useState<CityUser[]>([]);
  const [plans, setPlans] = useState<CityPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchOverview = async () => {
    if (!cityName) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const { data, error: rpcError } = await supabase
        .rpc('get_city_overview', { city_name: cityName })
        .single();

      if (rpcError) throw rpcError;
      if (!data) {
        setOverview(null);
        setUsers([]);
        setPlans([]);
        return;
      }

      const row = data as unknown as {
        city: string;
        country: string | null;
        country_code: string | null;
        user_count: number;
        plan_count: number;
        users: CityUser[] | null;
        plans: CityPlan[] | null;
      };

      setOverview({
        city: row.city,
        country: row.country,
        country_code: row.country_code,
        user_count: Number(row.user_count) || 0,
        plan_count: Number(row.plan_count) || 0,
      });
      setUsers(row.users ?? []);
      setPlans(row.plans ?? []);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : 'Failed to load city details';
      console.error('useCityOverview error:', err);
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cityName]);

  return {
    overview,
    users,
    plans,
    loading,
    error,
    refetch: fetchOverview,
  };
}
