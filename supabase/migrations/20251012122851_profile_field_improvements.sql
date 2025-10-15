-- Migration: Add additional avatar URLs and social media URLs to profiles
-- Run this in Supabase SQL Editor

ALTER TABLE profiles
ADD COLUMN IF NOT EXISTS avatar_url_2 TEXT,
ADD COLUMN IF NOT EXISTS avatar_url_3 TEXT,
ADD COLUMN IF NOT EXISTS instagram_url TEXT,
ADD COLUMN IF NOT EXISTS twitter_url TEXT,
ADD COLUMN IF NOT EXISTS tiktok_url TEXT,
ADD COLUMN IF NOT EXISTS youtube_url TEXT;

COMMENT ON COLUMN profiles.avatar_url_2 IS 'URL for second profile picture';
COMMENT ON COLUMN profiles.avatar_url_3 IS 'URL for third profile picture';
COMMENT ON COLUMN profiles.instagram_url IS 'Instagram profile URL';
COMMENT ON COLUMN profiles.twitter_url IS 'Twitter/X profile URL';
COMMENT ON COLUMN profiles.tiktok_url IS 'TikTok profile URL';
COMMENT ON COLUMN profiles.youtube_url IS 'YouTube channel URL';