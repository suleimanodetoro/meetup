// components/TrendingCityCard.tsx
import React from 'react';
import { View, Text, Pressable, ImageBackground } from 'react-native';
import { Link } from 'expo-router';

type TrendingCityCardProps = {
  city: {
    city: string;
    country: string;
    plan_count: number;
    image_url: string; // Assuming the RPC returns an image URL
  };
};

const TrendingCityCard = ({ city }: TrendingCityCardProps) => {
  return (
    <Link href={`/city/${city.city}`} asChild>
      <Pressable style={{ width: 180, height: 220, marginRight: 16 }}>
        <ImageBackground
          source={{ uri: city.image_url || 'https://placehold.co/180x220/e91e63/white?text=City' }}
          style={{ flex: 1, justifyContent: 'flex-end' }}
          imageStyle={{ borderRadius: 12 }}>
          <View
            style={{
              backgroundColor: 'rgba(0,0,0,0.4)',
              padding: 12,
              borderBottomLeftRadius: 12,
              borderBottomRightRadius: 12,
            }}>
            <Text style={{ color: 'white', fontWeight: 'bold', fontSize: 18 }}>{city.city}</Text>
            <Text style={{ color: 'white', fontSize: 12 }}>{city.plan_count} plans</Text>
          </View>
        </ImageBackground>
      </Pressable>
    </Link>
  );
};

export default TrendingCityCard;
