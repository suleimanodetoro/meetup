// hooks/useVisitDetails.ts
import { useState, useEffect } from 'react';
import { supabase } from '~/utils/supabase';
import { useAuth } from '~/app/contexts/AuthProvider';

interface VisitDetails {
  id: number;
  city: string;
  country: string;
  country_code: string;
  start_date: string;
  end_date: string;
  user_count: number;
  plan_count: number;
}

interface VisitUser {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  bio?: string;
  nationality_code?: string;
  is_verified: boolean;
  visit_start: string;
  visit_end: string;
  overlap_days: number;
}

interface VisitPlan {
  event_id: number;
  title: string;
  description?: string;
  image_uri?: string;
  date: string;
  location_name?: string;
  cost?: number;
  attendee_count: number;
  host_name?: string;
  host_avatar?: string;
}

export function useVisitDetails(visitId: string) {
  const { session } = useAuth();
  const [visit, setVisit] = useState<VisitDetails | null>(null);
  const [users, setUsers] = useState<VisitUser[]>([]);
  const [plans, setPlans] = useState<VisitPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchVisitDetails = async () => {
    if (!visitId || !session?.user?.id) return;

    try {
      setLoading(true);
      setError(null);

      // Fetch visit details
      const { data: visitData, error: visitError } = await supabase
        .rpc('get_visit_details', { visit_id_param: parseInt(visitId) })
        .single();

      if (visitError) throw visitError;
      setVisit(visitData);

      // Fetch users visiting the same city
      const { data: usersData, error: usersError } = await supabase
        .rpc('get_visit_users', {
          visit_id_param: parseInt(visitId),
          limit_param: undefined, // Get all users, we'll handle blur on client
        });

      if (usersError) throw usersError;
      setUsers(usersData || []);

      // Fetch plans in the city during visit
      const { data: plansData, error: plansError } = await supabase
        .rpc('get_visit_plans', { visit_id_param: parseInt(visitId) });

      if (plansError) throw plansError;
      setPlans(plansData || []);

    } catch (err: any) {
      console.error('Error fetching visit details:', err);
      setError(err.message || 'Failed to load visit details');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchVisitDetails();
  }, [visitId, session]);

  return {
    visit,
    users,
    plans,
    loading,
    error,
    refetch: fetchVisitDetails,
  };
}