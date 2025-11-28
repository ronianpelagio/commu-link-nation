import { useState, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface Notification {
  id: string;
  type: 'message' | 'post_like' | 'post_comment';
  content: string;
  created_at: string;
  read: boolean;
  sender_name?: string;
  link?: string;
}

export function NotificationBell() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return;

    fetchNotifications();

    // Listen for new messages
    const messagesChannel = supabase
      .channel('new-messages')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        async (payload) => {
          const message = payload.new;
          const { data: senderData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', message.sender_id)
            .single();

          const notification: Notification = {
            id: message.id,
            type: 'message',
            content: message.content || 'Sent you a message',
            created_at: message.created_at,
            read: false,
            sender_name: senderData?.full_name || 'Someone',
            link: '/messages',
          };

          setNotifications(prev => [notification, ...prev]);
          setUnreadCount(prev => prev + 1);
        }
      )
      .subscribe();

    // Listen for new post comments
    const commentsChannel = supabase
      .channel('new-comments')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_comments',
        },
        async (payload) => {
          const comment = payload.new;
          
          // Check if this is a comment on user's post
          const { data: postData } = await supabase
            .from('posts')
            .select('user_id')
            .eq('id', comment.post_id)
            .single();

          if (postData?.user_id === user.id && comment.user_id !== user.id) {
            const { data: commenterData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', comment.user_id)
              .single();

            const notification: Notification = {
              id: comment.id,
              type: 'post_comment',
              content: comment.content,
              created_at: comment.created_at,
              read: false,
              sender_name: commenterData?.full_name || 'Someone',
              link: '/dashboard',
            };

            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    // Listen for new post likes
    const likesChannel = supabase
      .channel('new-likes')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'post_likes',
        },
        async (payload) => {
          const like = payload.new;
          
          // Check if this is a like on user's post
          const { data: postData } = await supabase
            .from('posts')
            .select('user_id, content')
            .eq('id', like.post_id)
            .single();

          if (postData?.user_id === user.id && like.user_id !== user.id) {
            const { data: likerData } = await supabase
              .from('profiles')
              .select('full_name')
              .eq('id', like.user_id)
              .single();

            const notification: Notification = {
              id: like.id,
              type: 'post_like',
              content: 'liked your post',
              created_at: like.created_at,
              read: false,
              sender_name: likerData?.full_name || 'Someone',
              link: '/dashboard',
            };

            setNotifications(prev => [notification, ...prev]);
            setUnreadCount(prev => prev + 1);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(messagesChannel);
      supabase.removeChannel(commentsChannel);
      supabase.removeChannel(likesChannel);
    };
  }, [user]);

  const fetchNotifications = async () => {
    if (!user) return;

    // Fetch unread messages
    const { data: messages } = await supabase
      .from('messages')
      .select('*, profiles!messages_sender_id_fkey(full_name)')
      .eq('receiver_id', user.id)
      .eq('read', false)
      .order('created_at', { ascending: false })
      .limit(10);

    const messageNotifications: Notification[] = (messages || []).map(msg => ({
      id: msg.id,
      type: 'message' as const,
      content: msg.content || 'Sent you a message',
      created_at: msg.created_at,
      read: false,
      sender_name: (msg.profiles as any)?.full_name || 'Someone',
      link: '/messages',
    }));

    setNotifications(messageNotifications);
    setUnreadCount(messageNotifications.length);
  };

  const markAsRead = async (notificationId: string) => {
    setNotifications(prev =>
      prev.map(n => (n.id === notificationId ? { ...n, read: true } : n))
    );
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const handleNotificationClick = (notification: Notification) => {
    markAsRead(notification.id);
    if (notification.link) {
      navigate(notification.link);
      setOpen(false);
    }
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 bg-red-600 text-white text-xs">
              {unreadCount > 9 ? '9+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 sm:w-96" align="end">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-lg">Notifications</h3>
          {unreadCount > 0 && (
            <Badge variant="secondary">{unreadCount} new</Badge>
          )}
        </div>
        <ScrollArea className="h-[400px]">
          {notifications.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-2 opacity-30" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map(notification => (
                <button
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  className={`w-full text-left p-3 rounded-lg hover:bg-accent transition-colors ${
                    !notification.read ? 'bg-blue-50' : ''
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className="flex-1">
                      <p className="font-medium text-sm">
                        {notification.sender_name}
                      </p>
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {notification.content}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {formatDistanceToNow(new Date(notification.created_at), { addSuffix: true })}
                      </p>
                    </div>
                    {!notification.read && (
                      <div className="w-2 h-2 bg-blue-600 rounded-full mt-2" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}