-- Migration: Fix update_follow_counts trigger to use explicit schema path
-- This fixes the "relation 'profiles' does not exist" error when 
-- the trigger is invoked via PostgREST service role client

CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    -- Increment follower count for the user being followed
    UPDATE public.profiles 
    SET follower_count = follower_count + 1 
    WHERE user_id = NEW.following_id;
    
    -- Increment following count for the follower
    UPDATE public.profiles 
    SET following_count = following_count + 1 
    WHERE user_id = NEW.follower_id;
    
  ELSIF TG_OP = 'DELETE' THEN
    -- Decrement follower count for the user being unfollowed
    UPDATE public.profiles 
    SET follower_count = GREATEST(0, follower_count - 1)
    WHERE user_id = OLD.following_id;
    
    -- Decrement following count for the unfollower
    UPDATE public.profiles 
    SET following_count = GREATEST(0, following_count - 1)
    WHERE user_id = OLD.follower_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql
SET search_path = public;
