-- 070_storage_pictures.sql

-- Create the pictures bucket and make it public
INSERT INTO storage.buckets (id, name, public)
VALUES ('pictures', 'pictures', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing policy if it exists to prevent errors
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public Access" ON storage.objects;
EXCEPTION
    WHEN undefined_object THEN NULL;
END $$;

-- Create policy to allow all operations on the pictures bucket for authenticated and anonymous users
CREATE POLICY "Public Access" 
ON storage.objects 
FOR ALL 
USING (bucket_id = 'pictures');
