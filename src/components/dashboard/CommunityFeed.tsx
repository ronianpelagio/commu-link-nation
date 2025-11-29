import { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useToast } from '@/hooks/use-toast';
import { Plus, Image, Video } from 'lucide-react';
import { PostCard } from './PostCard';
interface Post {
  id: string;
  content: string;
  image_url: string | null;
  media_type: string | null;
  created_at: string;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}
const CommunityFeed = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [newPost, setNewPost] = useState('');
  const [isPosting, setIsPosting] = useState(false);
  const [showNewPost, setShowNewPost] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const {
    user
  } = useAuth();
  const {
    toast
  } = useToast();
  useEffect(() => {
    fetchPosts();
    const channel = supabase.channel('posts-changes').on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'posts'
    }, () => {
      fetchPosts();
    }).subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, []);
  const fetchPosts = async () => {
    const {
      data,
      error
    } = await supabase.from('posts').select(`
        *,
        profiles (
          full_name,
          avatar_url
        )
      `).eq('status', 'approved').order('created_at', {
      ascending: false
    });
    if (error) {
      console.error('Error fetching posts:', error);
      return;
    }
    setPosts(data as Post[]);
  };
  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const maxSize = 50 * 1024 * 1024;
      if (file.size > maxSize) {
        toast({
          title: 'Error',
          description: 'File size must be less than 50MB',
          variant: 'destructive'
        });
        return;
      }
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        toast({
          title: 'Error',
          description: 'Only images and videos are allowed',
          variant: 'destructive'
        });
        return;
      }
      setMediaFile(file);
    }
  };
  const uploadMedia = async () => {
    if (!mediaFile || !user) return null;
    const fileExt = mediaFile.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const {
      error: uploadError
    } = await supabase.storage.from('message-media').upload(fileName, mediaFile);
    if (uploadError) throw uploadError;
    const {
      data
    } = supabase.storage.from('message-media').getPublicUrl(fileName);
    return {
      url: data.publicUrl,
      type: mediaFile.type
    };
  };
  const handleCreatePost = async () => {
    if (!newPost.trim()) return;
    setIsPosting(true);
    try {
      let mediaUrl = null;
      let mediaType = null;
      if (mediaFile) {
        const media = await uploadMedia();
        if (media) {
          mediaUrl = media.url;
          mediaType = media.type;
        }
      }
      const {
        error
      } = await supabase.from('posts').insert({
        user_id: user?.id,
        content: newPost,
        status: 'pending',
        image_url: mediaUrl,
        media_type: mediaType
      });
      if (error) throw error;
      toast({
        title: 'Post submitted!',
        description: 'Your post is pending approval from barangay officials.'
      });
      setNewPost('');
      setMediaFile(null);
      setShowNewPost(false);
    } catch (err) {
      const error = err as Error;
      toast({
        title: 'Error',
        description: error?.message ?? 'An error occurred',
        variant: 'destructive'
      });
    } finally {
      setIsPosting(false);
    }
  };
  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-lg sm:text-2xl font-bold">News Feed</h2>
        <button 
          onClick={() => setShowNewPost(!showNewPost)} 
          className="inline-flex items-center gap-1.5 sm:gap-2 bg-cyan-600 hover:bg-cyan-700 text-white rounded-lg px-3 sm:px-4 py-2 shadow-md text-sm"
        >
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">{showNewPost ? 'Cancel' : 'New Post'}</span>
          <span className="sm:hidden">{showNewPost ? 'Cancel' : 'Post'}</span>
        </button>
      </div>

      {showNewPost && (
        <Card className="shadow-soft">
          <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6">
            <Textarea 
              placeholder="Share something with your community..." 
              value={newPost} 
              onChange={e => setNewPost(e.target.value)} 
              className="min-h-[80px] sm:min-h-[100px] rounded-lg text-sm" 
            />
            <div className="space-y-2">
              <Label className="text-xs sm:text-sm">Attach Media (optional)</Label>
              <div className="flex gap-2">
                <Input id="media" type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
                <Label htmlFor="media" className="cursor-pointer flex-1">
                  <Button type="button" variant="outline" className="w-full text-xs sm:text-sm" asChild>
                    <span>
                      {mediaFile?.type.startsWith('video/') ? <Video className="h-4 w-4 mr-1 sm:mr-2" /> : <Image className="h-4 w-4 mr-1 sm:mr-2" />}
                      <span className="truncate">{mediaFile ? mediaFile.name : 'Attach Media'}</span>
                    </span>
                  </Button>
                </Label>
                {mediaFile && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setMediaFile(null)}>
                    Clear
                  </Button>
                )}
              </div>
            </div>
            <Button 
              onClick={handleCreatePost} 
              disabled={isPosting || !newPost.trim()} 
              className="w-full bg-cyan-600 hover:bg-cyan-700 text-white text-sm"
            >
              {isPosting ? 'Posting...' : 'Post'}
            </Button>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Your post will be reviewed before appearing in the feed.
            </p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3 sm:space-y-4">
        {posts.length === 0 ? (
          <Card className="shadow-soft">
            <CardContent className="py-8 sm:py-12 text-center text-muted-foreground">
              <p className="text-sm">No posts yet. Be the first to share something!</p>
            </CardContent>
          </Card>
        ) : (
          posts.map(post => <PostCard key={post.id} post={post} currentUserId={user?.id || ''} />)
        )}
      </div>
    </div>
  );
};
export default CommunityFeed;