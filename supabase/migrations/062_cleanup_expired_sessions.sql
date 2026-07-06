-- 1. Update the cron cleanup function to also catch members who reached 0 sessions
CREATE OR REPLACE FUNCTION public.cleanup_expired_subscriptions()
RETURNS void AS $$
BEGIN
  UPDATE public.members
  SET
    package_id = null,
    package_name = 'None',
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

-- 2. Run the cleanup immediately to fix any currently stuck members (like Amr Ibrahim)
SELECT public.cleanup_expired_subscriptions();
