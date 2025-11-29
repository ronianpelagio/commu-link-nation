import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Heart, MessageCircle, MoreVertical } from 'lucide-react';
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

type Like = { id: string; user_id: string };
type CommentType = { id: string; content: string; profiles: { full_name: string; avatar_url?: string | null } };

export function PostCard({ post, currentUserId }: PostCardProps) {
  const { toast } = useToast();
  const [likes, setLikes] = useState<Like[]>([]);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [showComments, setShowComments] = useState(false);
  const [hasLiked, setHasLiked] = useState(false);

  const fetchLikes = useCallback(async () => {
    const { data } = await supabase.from('post_likes').select('*').eq('post_id', post.id);
    if (data) {
      // map to Like[] shape if needed
      setLikes(data as Like[]);
      setHasLiked((data as Like[]).some((like) => like.user_id === currentUserId));
    }
  }, [post.id, currentUserId]);

  const fetchComments = useCallback(async () => {
    const { data } = await supabase
      .from('post_comments')
      .select(`
        id,
        content,
        profiles!post_comments_user_id_fkey(full_name, avatar_url)
      `)
      .eq('post_id', post.id)
      .order('created_at', { ascending: true });

    if (data) setComments(data as any as CommentType[]);
  }, [post.id]);

  useEffect(() => {
    fetchLikes();
    fetchComments();
  }, [fetchLikes, fetchComments]);

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
    <Card className="shadow-soft rounded-xl overflow-hidden">
      <CardHeader className="p-3 sm:p-4">
        <div className="flex items-start justify-between w-full">
          <div className="flex items-center gap-2 sm:gap-3">
            <Avatar className="h-9 w-9 sm:h-10 sm:w-10">
              <AvatarImage src={post.profiles.avatar_url || ''} />
              <AvatarFallback className="text-sm">{post.profiles.full_name[0]}</AvatarFallback>
            </Avatar>
            <div>
              <p className="font-semibold text-sm sm:text-base">{post.profiles.full_name}</p>
              <p className="text-[10px] sm:text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
              </p>
            </div>
          </div>

          <button aria-label="More options" className="p-1.5 sm:p-2 rounded-full hover:bg-slate-100 text-muted-foreground">
            <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </CardHeader>

      <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-4 pt-0 sm:pt-0">
        <p className="text-sm leading-relaxed">{post.content}</p>

        {post.image_url && (
          post.media_type?.startsWith('video/') ? (
            <video src={post.image_url} controls className="w-full rounded-lg" />
          ) : (
            <img src={post.image_url} alt="Post" className="w-full rounded-lg" />
          )
        )}

        <div className="flex items-center justify-between pt-2 sm:pt-3 border-t">
          <div className="flex items-center gap-3 sm:gap-4">
            <button
              onClick={handleLike}
              className={`inline-flex items-center gap-1.5 text-sm ${hasLiked ? 'text-red-500' : 'text-muted-foreground'}`}
            >
              <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${hasLiked ? 'fill-current' : ''}`} />
              <span className="font-medium text-xs sm:text-sm">{likes.length}</span>
            </button>

            <button
              onClick={() => setShowComments(!showComments)}
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
            >
              <MessageCircle className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="font-medium text-xs sm:text-sm">{comments.length}</span>
            </button>
          </div>

          <button
            onClick={() => setShowComments(true)}
            className="bg-cyan-50 text-cyan-700 px-2.5 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium"
          >
            Comment
          </button>
        </div>

        {showComments && (
          <div className="space-y-2 sm:space-y-3 pt-2 sm:pt-3 border-t">
            {comments.map((comment) => (
              <div key={comment.id} className="flex gap-2">
                <Avatar className="h-7 w-7 sm:h-8 sm:w-8 flex-shrink-0">
                  <AvatarImage src={comment.profiles.avatar_url || ''} />
                  <AvatarFallback className="text-xs">{comment.profiles.full_name[0]}</AvatarFallback>
                </Avatar>
                <div className="flex-1 bg-secondary rounded-lg p-2">
                  <p className="text-xs sm:text-sm font-semibold">{comment.profiles.full_name}</p>
                  <p className="text-xs sm:text-sm">{comment.content}</p>
                </div>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
                placeholder="Write a comment..."
                className="text-sm h-9"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleComment();
                  }
                }}
              />
              <Button onClick={handleComment} size="sm" className="h-9">Post</Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
