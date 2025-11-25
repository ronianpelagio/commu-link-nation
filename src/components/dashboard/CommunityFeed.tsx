import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content: string;
  image_url: string | null;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

const CommunityFeed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    fetchPosts();
    
    // Subscribe to new posts
    const channel = supabase
      .channel('posts-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'posts',
        },
        () => {
          fetchPosts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        image_url,
        created_at,
        profiles (
          full_name
        )
      `)
      .eq('status', 'approved')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching posts:', error);
      return;
    }

    setPosts(data as Post[]);
  };

  const handleCreatePost = async () => {
    if (!newPost.trim()) return;

    setIsPosting(true);
    try {
      const { error } = await supabase
        .from('posts')
        .insert({
          user_id: user?.id,
          content: newPost,
          status: 'pending',
        });

      if (error) throw error;

      toast({
        title: 'Post submitted!',
        description: 'Your post is pending approval from barangay officials.',
      });
      setNewPost('');
      setShowNewPost(false);
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Create Post Card */}
      <Card className="shadow-soft">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Community Feed</CardTitle>
            <Button
              onClick={() => setShowNewPost(!showNewPost)}
              size="sm"
              variant={showNewPost ? 'secondary' : 'default'}
            >
              <Plus className="h-4 w-4 mr-2" />
              {showNewPost ? 'Cancel' : 'New Post'}
            </Button>
          </div>
        </CardHeader>
        {showNewPost && (
          <CardContent className="space-y-4">
            <Textarea
              placeholder="Share something with your community..."
              value={newPost}
              onChange={(e) => setNewPost(e.target.value)}
              className="min-h-[100px]"
            />
            <Button
              onClick={handleCreatePost}
              disabled={isPosting || !newPost.trim()}
              className="w-full"
            >
              <Send className="h-4 w-4 mr-2" />
              {isPosting ? 'Posting...' : 'Post'}
            </Button>
            <p className="text-sm text-muted-foreground">
              Your post will be reviewed by barangay officials before appearing in the feed.
            </p>
          </CardContent>
        )}
      </Card>

      {/* Posts Feed */}
      <div className="space-y-4">
        {posts.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="py-12 text-center text-muted-foreground">
              <p>No posts yet. Be the first to share something!</p>
            </CardContent>
          </Card>
        ) : (
          posts.map((post) => (
            <Card key={post.id} className="shadow-soft hover:shadow-medium transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{post.profiles.full_name}</CardTitle>
                  <CardDescription>
                    {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                  </CardDescription>
                </div>
              </CardHeader>
              <CardContent>
                <p className="whitespace-pre-wrap">{post.content}</p>
                {post.image_url && (
                  <img
                    src={post.image_url}
                    alt="Post image"
                    className="mt-4 rounded-lg w-full object-cover max-h-96"
                  />
                )}
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default CommunityFeed;
