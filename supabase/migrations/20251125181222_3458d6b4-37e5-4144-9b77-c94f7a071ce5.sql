-- Add media support to messages
ALTER TABLE public.messages ADD COLUMN media_url TEXT;
ALTER TABLE public.messages ADD COLUMN media_type TEXT;

-- Add media support to direct_approaches
ALTER TABLE public.direct_approaches ADD COLUMN media_url TEXT;
ALTER TABLE public.direct_approaches ADD COLUMN media_type TEXT;

-- Create storage bucket for message media
INSERT INTO storage.buckets (id, name, public)
VALUES ('message-media', 'message-media', false);

-- Create storage bucket for approach media
INSERT INTO storage.buckets (id, name, public)
VALUES ('approach-media', 'approach-media', false);

-- Message media storage policies
CREATE POLICY "Users can view media in their conversations"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'message-media' AND
  auth.uid() IN (
    SELECT sender_id FROM messages WHERE media_url LIKE '%' || name || '%'
    UNION
    SELECT receiver_id FROM messages WHERE media_url LIKE '%' || name || '%'
  )
);

CREATE POLICY "Users can upload message media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'message-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their message media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'message-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Approach media storage policies
CREATE POLICY "Users can view their approach media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'approach-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can upload approach media"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'approach-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Users can delete their approach media"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'approach-media' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

-- Allow admins to view approach media
CREATE POLICY "Admins can view all approach media"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'approach-media' AND
  has_role(auth.uid(), 'admin'::app_role)
);