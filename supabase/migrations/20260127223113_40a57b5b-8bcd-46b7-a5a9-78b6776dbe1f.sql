-- Create a public bucket for demo screenshots
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'demo-screenshots', 
  'demo-screenshots', 
  true,
  5242880, -- 5MB limit
  ARRAY['image/png', 'image/jpeg', 'image/webp']
);

-- Allow anyone to view demo screenshots
CREATE POLICY "Demo screenshots are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'demo-screenshots');