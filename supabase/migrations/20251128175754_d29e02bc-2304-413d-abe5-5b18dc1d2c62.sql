-- Add delivered_at column to messages table
ALTER TABLE public.messages ADD COLUMN delivered_at TIMESTAMP WITH TIME ZONE;

-- Add foreign key from post_comments to profiles
ALTER TABLE public.post_comments 
ADD CONSTRAINT post_comments_user_id_fkey 
FOREIGN KEY (user_id) 
REFERENCES public.profiles(id) 
ON DELETE CASCADE;

-- Add policy for users to delete their own tasks
CREATE POLICY "Users can delete their own tasks"
ON public.tasks
FOR DELETE
USING (auth.uid() = creator_id);