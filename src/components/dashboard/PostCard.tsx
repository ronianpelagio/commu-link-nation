import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Heart, MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface Post {
  id: string;
  content: string;
  created_at: string;
  image_url: string | null;
  media_type: string | null;
  profiles: {
    full_name: string;
    avatar_url: string | null;
  };
}

interface PostCardProps {
  post: Post;
  currentUserId: string;
}

export function PostCard({ post, currentUserId }: PostCardProps) {
  const { toast } = useToast();
  const [likes, setLikes] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);

  useEffect(() => {
    fetchLikes();
    fetchComments();
  }, [post.id]);

  const fetchLikes = async () => {
    const { data } = await supabase
      .from('post_likes')
      .select('*')
      .eq('post_id', post.id);
    
    if (data) {
      setLikes(data);
      setHasLiked(data.some(like => like.user_id === currentUserId));
    }
  };

  const fetchComments = async () => {
    const { data } = await supabase
      .from('post_comments')
      .select('*, profiles(full_name, avatar_url)')
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });
    
    if (data) setComments(data);
  };

  const handleLike = async () => {
    if (hasLiked) {
      const { error } = await supabase
        .from('post_likes')
        .delete()
        .eq('post_id', post.id)
        .eq('user_id', currentUserId);
      
      if (!error) {
        setHasLiked(false);
        fetchLikes();
      }
    } else {
      const { error } = await supabase
        .from('post_likes')
        .insert({ post_id: post.id, user_id: currentUserId });
      
      if (!error) {
        setHasLiked(true);
        fetchLikes();
      } else {
        toast({
          title: 'Error',
          description: error.message,
          variant: 'destructive',
        });
      }
    }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;

    const { error } = await supabase
      .from('post_comments')
      .insert({
        post_id: post.id,
        user_id: currentUserId,
        content: newComment.trim(),
      });

    if (error) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } else {
      setNewComment('');
      fetchComments();
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-3">
          <Avatar>
            <AvatarImage src={post.profiles.avatar_url || ''} />
            <AvatarFallback>{post.profiles.full_name[0]}</AvatarFallback>
          </Avatar>
          <div>
            <p className="font-semibold">{post.profiles.full_name}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <p>{post.content}</p>
        {post.image_url && (
          post.media_type?.startsWith('video/') ? (
            <video src={post.image_url} controls className="w-full rounded-lg" />
          ) : (
            <img src={post.image_url} alt="Post" className="w-full rounded-lg" />
          )
        )}
        
        <div className="flex items-center gap-4 pt-2 border-t">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleLike}
            className={hasLiked ? 'text-red-500' : ''}
          >
            <Heart className={`h-4 w-4 mr-1 ${hasLiked ? 'fill-current' : ''}`} />
            {likes.length}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowComments(!showComments)}
          >
            <MessageCircle className="h-4 w-4 mr-1" />
            {comments.length}
          </Button>
        </div>

        {showComments && (
          <div className="space-y-3 pt-3 border-t">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={comment.profiles.avatar_url || ''} />
                  <AvatarFallback>{comment.profiles.full_name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 bg-secondary rounded-lg p-2">
                  <p className="text-sm font-semibold">{comment.profiles.full_name}</p>
                  <p className="text-sm">{comment.content}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleComment();
                  }
                }}
              />
              <Button onClick={handleComment}>Post</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
