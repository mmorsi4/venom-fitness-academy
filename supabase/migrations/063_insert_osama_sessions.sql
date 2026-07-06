DO $$
DECLARE
  v_coach_id uuid;
BEGIN
  -- Find Osama
  SELECT id INTO v_coach_id FROM public.coaches WHERE name ILIKE '%osama%' LIMIT 1;
  
  IF v_coach_id IS NULL THEN
    RAISE EXCEPTION 'Coach Osama not found';
  END IF;

  -- Insert two sessions for July 4th
  INSERT INTO public.coach_check_ins (coach_id, check_in_date, session_type, created_at)
  VALUES 
    (v_coach_id, '2026-07-04', 'group', '2026-07-04 10:00:00+00'),
    (v_coach_id, '2026-07-04', 'group', '2026-07-04 12:00:00+00');

END;
$$;
