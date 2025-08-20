// app/(tabs)/profile.tsx
import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  Pressable,
  Image,
  Animated,
  Dimensions,
  SafeAreaView,
  ActivityIndicator,
  StatusBar,
} from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { Canvas } from '@react-three/fiber/native';
import { supabase } from '~/utils/supabase';
import { useAuth } from '../contexts/AuthProvider';
import { Event, Visit, Profile } from '~/types/db';
import { getCountryFlag } from '~/utils/countryFlags';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const GLOBE_HEIGHT = SCREEN_HEIGHT * 0.45;
const SHEET_MIN_HEIGHT = SCREEN_HEIGHT * 0.6;

// Simple Globe Component using Three.js
function Globe() {
  const meshRef = useRef<any>();
  return (
    <mesh ref={meshRef} rotation={[0.3, 0, 0]}>
      <sphereGeometry args={[2, 32, 32]} />
      <meshStandardMaterial color="#4A90E2" wireframe />
    </mesh>
  );
}

// Visit Hero Card Component
function VisitHeroCard({ visit, onPress }: { visit: Visit & { daysUntil: number }, onPress: () => void }) {
  return (
    <Pressable 
      onPress={onPress}  // ← ADD THIS!
      style={{
        width: '100%',
        height: 200,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: '#E3F2FD',
      }}
    >
      <LinearGradient
        colors={['#56CCF2', '#2F80ED']}
        style={{ flex: 1, padding: 16, justifyContent: 'space-between' }}
      >
        {/* Top row */}
        <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.9)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
          }}>
            <Text style={{ fontSize: 16 }}>{getCountryFlag(visit.country_code)}</Text>
          </View>
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.9)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
            <Ionicons name="time-outline" size={16} color="#666" />
            <Text style={{ fontSize: 14, color: '#333', fontWeight: '600' }}>
              {visit.daysUntil} {visit.daysUntil === 1 ? 'day' : 'days'} until
            </Text>
          </View>
        </View>

        {/* Bottom content */}
        <View>
          <Text style={{
            fontSize: 32,
            fontWeight: 'bold',
            color: 'white',
            marginBottom: 4,
          }}>
            {visit.city}
          </Text>
          <Text style={{
            fontSize: 16,
            color: 'rgba(255,255,255,0.9)',
          }}>
            {new Date(visit.start_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {new Date(visit.end_date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </Text>

          {/* Others going chip */}
          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 12,
            alignSelf: 'flex-start',
            backgroundColor: 'rgba(255,255,255,0.9)',
            paddingRight: 12,
            paddingVertical: 4,
            borderRadius: 20,
          }}>
            <View style={{ flexDirection: 'row', marginRight: 8 }}>
              {[1, 2, 3].map((i) => (
                <View
                  key={i}
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 14,
                    backgroundColor: '#E0E0E0',
                    borderWidth: 2,
                    borderColor: 'white',
                    marginLeft: i === 1 ? 0 : -10,
                  }}
                />
              ))}
            </View>
            <Text style={{ fontSize: 14, color: '#333', fontWeight: '600' }}>
              100+ Others
            </Text>
          </View>
        </View>
      </LinearGradient>
    </Pressable>
  );
}

// Plan Card Component
function PlanCard({ plan }: { plan: Event & { isJoined: boolean } }) {
  return (
    <Pressable style={{
      width: 280,
      marginRight: 16,
    }}>
      <View style={{
        height: 180,
        borderRadius: 16,
        backgroundColor: '#E0E0E0',
        marginBottom: 12,
        overflow: 'hidden',
      }}>
        <LinearGradient
          colors={['#667eea', '#764ba2']}
          style={{ flex: 1 }}
        />
        {plan.isJoined && (
          <View style={{
            position: 'absolute',
            top: 12,
            right: 12,
            backgroundColor: 'rgba(255,255,255,0.9)',
            paddingHorizontal: 12,
            paddingVertical: 6,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 4,
          }}>
            <Ionicons name="checkmark-circle" size={16} color="#4CAF50" />
            <Text style={{ fontSize: 14, fontWeight: '600', color: '#333' }}>Joined</Text>
          </View>
        )}
      </View>

      <Text style={{
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 8,
      }} numberOfLines={2}>
        {plan.title}
      </Text>

      <View style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}>
        <View style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 6,
        }}>
          <Text style={{ fontSize: 16 }}>{getCountryFlag(plan.country_code)}</Text>
          <Text style={{ fontSize: 14, color: '#666' }}>{plan.country || plan.city}</Text>
        </View>

        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
          <View style={{ flexDirection: 'row', marginRight: 6 }}>
            {[1, 2, 3].map((i) => (
              <View
                key={i}
                style={{
                  width: 24,
                  height: 24,
                  borderRadius: 12,
                  backgroundColor: '#E0E0E0',
                  borderWidth: 1.5,
                  borderColor: 'white',
                  marginLeft: i === 1 ? 0 : -8,
                }}
              />
            ))}
          </View>
          <Text style={{ fontSize: 13, color: '#666', fontWeight: '600' }}>212+</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { session } = useAuth();
  const scrollY = useRef(new Animated.Value(0)).current;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [upcomingVisits, setUpcomingVisits] = useState<any[]>([]);
  const [joinedPlans, setJoinedPlans] = useState<any[]>([]);
  const [stats, setStats] = useState({ plans: 0, visits: 0, visited: 1 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProfileData();
  }, [session]);

  const fetchProfileData = async () => {
  if (!session?.user?.id) return;

  try {
    setLoading(true);

    // Fetch profile data
    const { data: profileData } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', session.user.id)
      .single();
    if (profileData) setProfile(profileData);

    // DEBUGGING: Check user ID and all visits
    console.log('=== DEBUGGING VISITS ===');
    console.log('Current user ID from session:', session.user.id);
    console.log('Session object:', session);

    // First, let's see ALL visits in the database (for debugging)
    const { data: allVisitsInDB, error: allVisitsError } = await supabase
      .from('visits')
      .select('*')
      .order('created_at', { ascending: false });

    console.log('ALL visits in database:', allVisitsInDB);
    console.log('Error fetching all visits:', allVisitsError);

    // Now check visits for current user specifically
    const { data: userVisits, error: userVisitsError } = await supabase
      .from('visits')
      .select('*')
      .eq('user_id', session.user.id)
      .order('start_date', { ascending: true });

    console.log('User-specific visits:', userVisits);
    console.log('User visits error:', userVisitsError);

    // Check if user exists in any visits
    const userExists = allVisitsInDB?.some(visit => visit.user_id === session.user.id);
    console.log('Does current user exist in ANY visits?', userExists);

    // Show which user IDs exist in database
    const uniqueUserIds = [...new Set(allVisitsInDB?.map(v => v.user_id) || [])];
    console.log('User IDs that have visits in DB:', uniqueUserIds);

    // Apply date filter for upcoming visits
    const today = new Date().toISOString().split('T')[0];
    const upcomingUserVisits = userVisits?.filter(v => v.start_date >= today) || [];

    console.log('Today date:', today);
    console.log('Upcoming visits for user:', upcomingUserVisits);

    if (upcomingUserVisits) {
      const visitsWithDays = upcomingUserVisits.map(v => ({
        ...v,
        daysUntil: Math.ceil((new Date(v.start_date).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
      }));
      setUpcomingVisits(visitsWithDays);
      setStats(prev => ({ ...prev, visits: upcomingUserVisits.length }));
    }

    console.log('=== END DEBUGGING ===');

    // Rest of your existing code...
    const { data: attendance } = await supabase
      .from('attendance')
      .select('event_id')
      .eq('user_id', session.user.id);
    
    if (attendance && attendance.length > 0) {
      const eventIds = attendance.map(a => a.event_id);
      const { data: events } = await supabase
        .from('events')
        .select('*')
        .in('id', eventIds)
        .order('date', { ascending: true });
      if (events) setJoinedPlans(events);
    }
  } catch (error) {
    console.error('Error fetching profile data:', error);
  } finally {
    setLoading(false);
  }
};

  // Animations
  const globeOpacity = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const sheetTranslateY = scrollY.interpolate({
    inputRange: [0, 200],
    outputRange: [0, -GLOBE_HEIGHT + 80],
    extrapolate: 'clamp',
  });
  const headerOpacity = scrollY.interpolate({
    inputRange: [150, 200],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const inverseHeaderOpacity = scrollY.interpolate({
    inputRange: [0, 150],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  if (loading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#0A1929' }}>
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <ActivityIndicator size="large" color="#4A90E2" />
        </View>
      </SafeAreaView>
    );
  }

  const isVerified = profile?.onboarding_completed && profile?.avatar_url;

  return (
    <View style={{ flex: 1, backgroundColor: '#0A1929' }}>
      <StatusBar barStyle="light-content" />

      {/* Globe Background (kept visually the same) */}
      <Animated.View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: GLOBE_HEIGHT,
        opacity: globeOpacity,
        // no zIndex bump here, so the globe itself won't float above the sheet
      }}>
        <Canvas>
          <ambientLight intensity={0.5} />
          <pointLight position={[10, 10, 10]} />
          <Globe />
        </Canvas>

        {/* Brand pill only (buttons moved to overlay for reliable taps) */}
        <View style={{
          position: 'absolute',
          top: 60,
          left: 20,
          right: 20,
          flexDirection: 'row',
          justifyContent: 'space-between',
        }}>
          <View style={{
            backgroundColor: 'rgba(255,255,255,0.9)',
            paddingHorizontal: 16,
            paddingVertical: 8,
            borderRadius: 20,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
            <View style={{
              width: 24,
              height: 24,
              borderRadius: 12,
              backgroundColor: '#87CEEB',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 12 }}>🌍</Text>
            </View>
            <Text style={{ fontSize: 16, fontWeight: '600' }}>Thirdspace</Text>
          </View>
        </View>
      </Animated.View>

      {/* 🔝 Top-right Controls Overlay (above sheet, fades out as header fades in) */}
      <Animated.View
        pointerEvents="box-none"
        style={{
          position: 'absolute',
          top: 60,
          right: 20,
          zIndex: 30,        // ensures taps always reach these
          opacity: inverseHeaderOpacity,
        }}
      >
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <Pressable style={{
            width: 44,
            height: 44,
            borderRadius: 22,
            backgroundColor: 'rgba(255,255,255,0.9)',
            justifyContent: 'center',
            alignItems: 'center',
            position: 'relative',
          }}>
            <Ionicons name="notifications-outline" size={24} color="#333" />
            <View style={{
              position: 'absolute',
              top: 8,
              right: 8,
              width: 12,
              height: 12,
              borderRadius: 6,
              backgroundColor: '#FF3B30',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Text style={{ color: 'white', fontSize: 8, fontWeight: 'bold' }}>1</Text>
            </View>
          </Pressable>

          <Pressable
            onPress={() => router.push('/settings')}
            hitSlop={12}
            style={{
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(255,255,255,0.9)',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Ionicons name="settings-outline" size={24} color="#333" />
          </Pressable>
        </View>
      </Animated.View>

      {/* Full Profile Header (visible when scrolled) */}
      <Animated.View style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        backgroundColor: 'white',
        paddingTop: 60,
        paddingBottom: 20,
        paddingHorizontal: 20,
        opacity: headerOpacity,
        zIndex: 20,
      }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View style={{
              width: 60,
              height: 60,
              borderRadius: 30,
              backgroundColor: '#4A90E2',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              {profile?.avatar_url ? (
                <Image
                  source={{ uri: profile.avatar_url }}
                  style={{ width: 60, height: 60, borderRadius: 30 }}
                />
              ) : (
                <Text style={{ fontSize: 24, color: 'white' }}>
                  {profile?.full_name?.[0] || 'T'}
                </Text>
              )}
            </View>

            <Text style={{ fontSize: 20, fontWeight: 'bold' }}>
              {profile?.full_name || 'Traveler'}
            </Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <Pressable style={{
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: '#F5F5F5',
              justifyContent: 'center',
              alignItems: 'center',
            }}>
              <Ionicons name="notifications-outline" size={20} color="#333" />
            </Pressable>

            <Pressable
              onPress={() => router.push('/settings')}
              hitSlop={12}
              style={{
                width: 40,
                height: 40,
                borderRadius: 20,
                backgroundColor: '#F5F5F5',
                justifyContent: 'center',
                alignItems: 'center',
              }}>
              <Ionicons name="settings-outline" size={20} color="#333" />
            </Pressable>
          </View>
        </View>
      </Animated.View>

      {/* Content Sheet */}
      <Animated.ScrollView
        onScroll={Animated.event(
          [{ nativeEvent: { contentOffset: { y: scrollY } } }],
          { useNativeDriver: true }
        )}
        scrollEventThrottle={16}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingTop: GLOBE_HEIGHT - 100 }}
      >
        <Animated.View style={{
          backgroundColor: 'white',
          minHeight: SCREEN_HEIGHT,
          borderTopLeftRadius: 30,
          borderTopRightRadius: 30,
          paddingTop: 60,
          transform: [{ translateY: sheetTranslateY }],
          // no zIndex here; the overlay controls sit above via zIndex:30
        }}>
          {/* Avatar overlapping sheet edge (Globe state) */}
          <View style={{
            position: 'absolute',
            top: -50,
            left: 30,
            width: 100,
            height: 100,
            borderRadius: 50,
            backgroundColor: '#4A90E2',
            borderWidth: 4,
            borderColor: 'white',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                style={{ width: 92, height: 92, borderRadius: 46 }}
              />
            ) : (
              <Text style={{ fontSize: 36, color: 'white' }}>
                {profile?.full_name?.[0] || 'T'}
              </Text>
            )}
          </View>

          {/* Stats row (Globe state - inline) */}
          <View style={{
            flexDirection: 'row',
            justifyContent: 'flex-end',
            paddingRight: 30,
            marginBottom: 20,
          }}>
            <View style={{ flexDirection: 'row', gap: 30 }}>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.plans}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>Plans</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.visits}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>Trips</Text>
              </View>
              <View style={{ alignItems: 'center' }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{stats.visited}</Text>
                <Text style={{ fontSize: 12, color: '#666' }}>Visited</Text>
              </View>
            </View>
          </View>

          {/* Identity row */}
          <View style={{ paddingHorizontal: 30, marginBottom: 10 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>
                  {profile?.full_name || 'Traveler'}
                </Text>

                {isVerified ? (
                  <View style={{
                    backgroundColor: '#E8F5E9',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <Ionicons name="checkmark-circle" size={14} color="#4CAF50" />
                    <Text style={{ fontSize: 12, color: '#4CAF50', fontWeight: '600' }}>Verified</Text>
                  </View>
                ) : (
                  <View style={{
                    backgroundColor: '#FFEBEE',
                    paddingHorizontal: 10,
                    paddingVertical: 4,
                    borderRadius: 12,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 4,
                  }}>
                    <Ionicons name="close-circle" size={14} color="#F44336" />
                    <Text style={{ fontSize: 12, color: '#F44336', fontWeight: '600' }}>Not Verified</Text>
                  </View>
                )}
              </View>

              <Pressable onPress={() => router.push('/edit-profile')}>
                <Text style={{ fontSize: 16, color: '#4A90E2' }}>Edit Profile ›</Text>
              </Pressable>
            </View>

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 }}>
              <Text style={{ fontSize: 20 }}>{getCountryFlag(profile?.nationality_code || 'NG')}</Text>
              <Text style={{ fontSize: 16, color: '#666' }}>
                {profile?.nationality || 'Nigeria'}
              </Text>
            </View>
          </View>

          {/* Boxed Stats */}
          <View style={{
            flexDirection: 'row',
            paddingHorizontal: 30,
            gap: 12,
            marginTop: 30,
            marginBottom: 40,
          }}>
            {[
              { label: 'Plans', value: stats.plans },
              { label: 'Trips', value: stats.visits },
              { label: 'Visited', value: stats.visited },
            ].map((stat, index) => (
              <View
                key={index}
                style={{
                  flex: 1,
                  borderWidth: 1,
                  borderColor: '#E0E0E0',
                  borderRadius: 16,
                  paddingVertical: 20,
                  alignItems: 'center',
                }}
              >
                <Text style={{ fontSize: 24, fontWeight: 'bold' }}>{stat.value}</Text>
                <Text style={{ fontSize: 13, color: '#666', marginTop: 4 }}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Upcoming Trips Section */}
          <View style={{ marginBottom: 40 }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 30,
              marginBottom: 20,
            }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold' }}>Upcoming Trips</Text>
              <Pressable>
                <Text style={{ fontSize: 16, color: '#4A90E2' }}>See all ›</Text>
              </Pressable>
            </View>

            {upcomingVisits.length > 0 ? (
  <View style={{ paddingHorizontal: 30 }}>
    <VisitHeroCard
      visit={upcomingVisits[0]}
      onPress={() =>
        router.push({
          pathname: '/visit/[id]',
          params: { id: String(upcomingVisits[0].id) }, // ensure it's a string
        })
      }
    />
  </View>
) : (
              <View style={{ alignItems: 'center', paddingVertical: 40, paddingHorizontal: 30 }}>
                <Text style={{ fontSize: 60, marginBottom: 20 }}>🌍</Text>
                <Text style={{ fontSize: 18, color: '#333', marginBottom: 20, textAlign: 'center' }}>
                  You don't have any upcoming trips yet
                </Text>
                <Pressable
                  onPress={() => router.push('/add-trip')}
                  style={{
                    backgroundColor: '#4A90E2',
                    paddingVertical: 16,
                    paddingHorizontal: 40,
                    borderRadius: 30,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 8,
                  }}
                >
                  <Text style={{ color: 'white', fontSize: 16, fontWeight: '600' }}>+ Add New Trip</Text>
                </Pressable>
              </View>
            )}
          </View>

          {/* Plans You Joined Section */}
          <View style={{ marginBottom: 40 }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 30,
              marginBottom: 20,
            }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold' }}>Plans you Joined</Text>
              <Pressable>
                <Text style={{ fontSize: 16, color: '#4A90E2' }}>See all ›</Text>
              </Pressable>
            </View>

            {joinedPlans.length > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={{ paddingHorizontal: 30 }}
              >
                {joinedPlans.map((plan) => (
                  <PlanCard key={plan.id} plan={plan} />
                ))}
              </ScrollView>
            ) : (
              <View style={{
                marginHorizontal: 30,
                backgroundColor: '#F5F5F5',
                borderRadius: 16,
                padding: 30,
                alignItems: 'center',
              }}>
                <Text style={{ fontSize: 50, marginBottom: 12 }}>🌍</Text>
                <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>No Plans Yet</Text>
                <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
                  You haven't joined any plans
                </Text>
              </View>
            )}
          </View>

          {/* My Friends Section */}
          <View style={{ marginBottom: 100 }}>
            <View style={{
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingHorizontal: 30,
              marginBottom: 20,
            }}>
              <Text style={{ fontSize: 22, fontWeight: 'bold' }}>My Friends</Text>
              <Pressable>
                <Text style={{ fontSize: 16, color: '#4A90E2' }}>See all ›</Text>
              </Pressable>
            </View>

            <View style={{
              marginHorizontal: 30,
              backgroundColor: '#F5F5F5',
              borderRadius: 16,
              padding: 30,
              alignItems: 'center',
            }}>
              <Text style={{ fontSize: 50, marginBottom: 12 }}>🌍</Text>
              <Text style={{ fontSize: 18, fontWeight: '600', marginBottom: 8 }}>No Friends Yet</Text>
              <Text style={{ fontSize: 14, color: '#666', textAlign: 'center' }}>
                Find friends from your visits and plans
              </Text>
            </View>
          </View>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}
