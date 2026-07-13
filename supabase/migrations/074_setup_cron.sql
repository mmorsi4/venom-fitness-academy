-- Run this in the Supabase SQL Editor to set up the cron job
-- This will run the cleanup and activation of subscriptions every hour
-- It requires the pg_cron extension to be enabled

-- 1. Enable pg_cron (if not already enabled, though usually it is on Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Schedule the cleanup job to run every hour at minute 0
SELECT cron.schedule(
    'cleanup-expired-subscriptions',
    '0 * * * *',
    $$
    SELECT cleanup_expired_subscriptions();
    SELECT activate_pending_subscriptions();
    $$
);

-- Note: To view scheduled jobs, run:
-- SELECT * FROM cron.job;
-- To unschedule:
-- SELECT cron.unschedule('cleanup-expired-subscriptions');
