-- Add media_type to posts if not exists
ALTER TABLE posts ADD COLUMN IF NOT EXISTS media_type text;

-- Create post_comments table
CREATE TABLE IF NOT EXISTS post_comments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE post_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view comments" ON post_comments
  FOR SELECT USING (true);

CREATE POLICY "Users can create comments" ON post_comments
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own comments" ON post_comments
  FOR DELETE USING (auth.uid() = user_id);

-- Create post_likes table
CREATE TABLE IF NOT EXISTS post_likes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id uuid REFERENCES posts(id) ON DELETE CASCADE NOT NULL,
  user_id uuid NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(post_id, user_id)
);

ALTER TABLE post_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view likes" ON post_likes
  FOR SELECT USING (true);

CREATE POLICY "Users can create likes" ON post_likes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes" ON post_likes
  FOR DELETE USING (auth.uid() = user_id);

-- Create approach_messages table for conversations
CREATE TABLE IF NOT EXISTS approach_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  approach_id uuid REFERENCES direct_approaches(id) ON DELETE CASCADE NOT NULL,
  sender_id uuid NOT NULL,
  content text NOT NULL,
  created_at timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE approach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view messages for their approaches" ON approach_messages
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM direct_approaches 
      WHERE id = approach_id 
      AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

CREATE POLICY "Users and admins can create messages" ON approach_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (
      SELECT 1 FROM direct_approaches 
      WHERE id = approach_id 
      AND (user_id = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
    )
  );

-- Add skills to profiles
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS skills text[];

-- Create task_ratings table
CREATE TABLE IF NOT EXISTS task_ratings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id uuid REFERENCES tasks(id) ON DELETE CASCADE NOT NULL,
  rated_user_id uuid NOT NULL,
  rater_id uuid NOT NULL,
  rating integer NOT NULL CHECK (rating >= 1 AND rating <= 5),
  comment text,
  created_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(task_id, rater_id)
);

ALTER TABLE task_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view ratings" ON task_ratings
  FOR SELECT USING (true);

CREATE POLICY "Task creators can create ratings" ON task_ratings
  FOR INSERT WITH CHECK (
    auth.uid() = rater_id AND
    EXISTS (
      SELECT 1 FROM tasks 
      WHERE id = task_id 
      AND creator_id = auth.uid()
      AND status = 'completed'
    )
  );

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE post_comments;
ALTER PUBLICATION supabase_realtime ADD TABLE post_likes;
ALTER PUBLICATION supabase_realtime ADD TABLE approach_messages;