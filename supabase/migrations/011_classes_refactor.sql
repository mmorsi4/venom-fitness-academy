-- ============================================================
-- 011_classes_refactor.sql
-- Refactor sports, gym_sessions -> classes, update members/coaches
-- ============================================================

-- 1. Create sports table
CREATE TABLE IF NOT EXISTS public.sports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Create classes table
CREATE TABLE IF NOT EXISTS public.classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  sport_id uuid REFERENCES public.sports(id) ON DELETE CASCADE,
  coach_id uuid REFERENCES public.coaches(id) ON DELETE SET NULL,
  schedules jsonb NOT NULL DEFAULT '[]'::jsonb,
  capacity int NOT NULL DEFAULT 20,
  attendance_count int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Modify members table
ALTER TABLE public.members DROP COLUMN IF EXISTS sport;
ALTER TABLE public.members ADD COLUMN IF NOT EXISTS class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL;

-- 4. Modify coaches table
ALTER TABLE public.coaches DROP COLUMN IF EXISTS sport;

-- 5. Drop old gym_sessions
DROP TABLE IF EXISTS public.gym_sessions;

-- 6. Grants
GRANT ALL ON TABLE public.sports TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.classes TO anon, authenticated, service_role;
