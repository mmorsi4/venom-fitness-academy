-- Update the cron cleanup function to retain package_id and package_name so they remain visible for reference
CREATE OR REPLACE FUNCTION public.cleanup_expired_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE public.members
  SET
    sessions_remaining = 0,
    freeze_days_remaining = 0,
    invitations_remaining = 0,
    inbody_sessions_remaining = 0,
    status = 'expired'
  WHERE 
    (expires_at < now() OR (sessions_remaining <= 0 AND sessions_remaining != 999)) 
    AND status != 'expired' 
    AND id != -1; -- exclude clinic visitors
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Run it immediately to apply the fix
SELECT public.cleanup_expired_subscriptions();
