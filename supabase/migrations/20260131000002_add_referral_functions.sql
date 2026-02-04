-- Add helper function for incrementing active referral count
-- Used when a referee makes their first qualifying contribution

CREATE OR REPLACE FUNCTION increment_active_referral_count(user_id UUID)
RETURNS VOID AS $$
BEGIN
  UPDATE profiles
  SET active_referral_count = active_referral_count + 1
  WHERE profiles.user_id = increment_active_referral_count.user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_active_referral_count(UUID) TO authenticated;
