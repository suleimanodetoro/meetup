import { useCallback, useEffect, useRef, useState } from 'react';
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
  match_score: number;
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
  match_score: number;
}

export interface CityOverview {
  city: string;
  country: string | null;
  country_code: string | null;
  user_count: number;
  plan_count: number;
}

export interface CityWindow {
  from?: string | null; // YYYY-MM-DD
  to?: string | null;   // YYYY-MM-DD
}

const PAGE_SIZE = 20;

/**
 * Drives the city-detail screen. Backed by three RPCs:
 *   - get_city_meta_window: header counts + city/country
 *   - get_city_users_ranked: paginated users
 *   - get_city_plans_ranked: paginated plans
 *
 * Both lists rank by date overlap with the supplied window. When
 * `window.from` / `window.to` are omitted the RPC defaults to a
 * "today → today + 90 days" window. Both lists also include items
 * up to 14 days in the past, ranked lowest, so the screen surfaces
 * recent-history activity in a city without bringing back all-time
 * archives.
 */
export function useCityOverview(
  cityName: string | undefined,
  window: CityWindow = {},
) {
  const [overview, setOverview] = useState<CityOverview | null>(null);
  const [users, setUsers] = useState<CityUser[]>([]);
  const [plans, setPlans] = useState<CityPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [usersLoadingMore, setUsersLoadingMore] = useState(false);
  const [plansLoadingMore, setPlansLoadingMore] = useState(false);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [plansHasMore, setPlansHasMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Guard against out-of-order responses when the window changes mid-fetch.
  const requestId = useRef(0);

  const windowFrom = window.from ?? undefined;
  const windowTo = window.to ?? undefined;

  const loadInitial = useCallback(async () => {
    if (!cityName) {
      setLoading(false);
      return;
    }
    const myId = ++requestId.current;
    setLoading(true);
    setError(null);

    const args: {
      city_name: string;
      window_from?: string;
      window_to?: string;
    } = { city_name: cityName };
    if (windowFrom) args.window_from = windowFrom;
    if (windowTo) args.window_to = windowTo;

    try {
      const [metaRes, usersRes, plansRes] = await Promise.all([
        supabase.rpc('get_city_meta_window', args).single(),
        supabase.rpc('get_city_users_ranked', {
          ...args,
          page_limit: PAGE_SIZE,
          page_offset: 0,
        }),
        supabase.rpc('get_city_plans_ranked', {
          ...args,
          page_limit: PAGE_SIZE,
          page_offset: 0,
        }),
      ]);

      if (myId !== requestId.current) return; // stale

      if (metaRes.error) throw metaRes.error;
      if (usersRes.error) throw usersRes.error;
      if (plansRes.error) throw plansRes.error;

      const meta = metaRes.data as unknown as {
        city: string;
        country: string | null;
        country_code: string | null;
        user_count: number;
        plan_count: number;
      } | null;

      if (!meta) {
        setOverview(null);
        setUsers([]);
        setPlans([]);
        setUsersHasMore(false);
        setPlansHasMore(false);
        return;
      }

      const userCount = Number(meta.user_count) || 0;
      const planCount = Number(meta.plan_count) || 0;
      const userRows = (usersRes.data ?? []) as unknown as CityUser[];
      const planRows = (plansRes.data ?? []) as unknown as CityPlan[];

      setOverview({
        city: meta.city,
        country: meta.country,
        country_code: meta.country_code,
        user_count: userCount,
        plan_count: planCount,
      });
      setUsers(userRows);
      setPlans(planRows);
      setUsersHasMore(userRows.length < userCount);
      setPlansHasMore(planRows.length < planCount);
    } catch (err) {
      if (myId !== requestId.current) return;
      const message =
        err instanceof Error ? err.message : 'Failed to load city details';
      console.error('useCityOverview error:', err);
      setError(message);
    } finally {
      if (myId === requestId.current) setLoading(false);
    }
  }, [cityName, windowFrom, windowTo]);

  const loadMoreUsers = useCallback(async () => {
    if (!cityName || usersLoadingMore || !usersHasMore) return;
    setUsersLoadingMore(true);
    try {
      const args: {
        city_name: string;
        window_from?: string;
        window_to?: string;
        page_limit: number;
        page_offset: number;
      } = {
        city_name: cityName,
        page_limit: PAGE_SIZE,
        page_offset: users.length,
      };
      if (windowFrom) args.window_from = windowFrom;
      if (windowTo) args.window_to = windowTo;
      const { data, error: rpcError } = await supabase.rpc(
        'get_city_users_ranked',
        args,
      );
      if (rpcError) throw rpcError;
      const rows = (data ?? []) as unknown as CityUser[];
      setUsers((prev) => [...prev, ...rows]);
      setUsersHasMore(
        rows.length === PAGE_SIZE && users.length + rows.length < (overview?.user_count ?? 0),
      );
    } catch (err) {
      console.error('loadMoreUsers error:', err);
    } finally {
      setUsersLoadingMore(false);
    }
  }, [cityName, windowFrom, windowTo, users.length, overview?.user_count, usersLoadingMore, usersHasMore]);

  const loadMorePlans = useCallback(async () => {
    if (!cityName || plansLoadingMore || !plansHasMore) return;
    setPlansLoadingMore(true);
    try {
      const args: {
        city_name: string;
        window_from?: string;
        window_to?: string;
        page_limit: number;
        page_offset: number;
      } = {
        city_name: cityName,
        page_limit: PAGE_SIZE,
        page_offset: plans.length,
      };
      if (windowFrom) args.window_from = windowFrom;
      if (windowTo) args.window_to = windowTo;
      const { data, error: rpcError } = await supabase.rpc(
        'get_city_plans_ranked',
        args,
      );
      if (rpcError) throw rpcError;
      const rows = (data ?? []) as unknown as CityPlan[];
      setPlans((prev) => [...prev, ...rows]);
      setPlansHasMore(
        rows.length === PAGE_SIZE && plans.length + rows.length < (overview?.plan_count ?? 0),
      );
    } catch (err) {
      console.error('loadMorePlans error:', err);
    } finally {
      setPlansLoadingMore(false);
    }
  }, [cityName, windowFrom, windowTo, plans.length, overview?.plan_count, plansLoadingMore, plansHasMore]);

  useEffect(() => {
    loadInitial();
  }, [loadInitial]);

  return {
    overview,
    users,
    plans,
    loading,
    error,
    refetch: loadInitial,
    loadMoreUsers,
    loadMorePlans,
    usersHasMore,
    plansHasMore,
    usersLoadingMore,
    plansLoadingMore,
  };
}
