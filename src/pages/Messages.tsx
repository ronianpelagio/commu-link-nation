import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardHeader } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Send, 
  UserPlus, 
  Image as ImageIcon, 
  Video as VideoIcon, 
  MessageCircle,
  Check,
  CheckCheck,
  Clock
} from 'lucide-react';
import { VideoCallDialog } from '@/components/VideoCallDialog';
import { format } from 'date-fns';

interface Friend {
  id: string;
  friend_id: string;
  profiles: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

interface Message {
  id: string;
  content: string;
  sender_id: string;
  receiver_id: string;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
  delivered_at: string | null;
  // Local state for sending animation
  isSending?: boolean;
}

const Messages = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [friends, setFriends] = useState<Friend[]>([]);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [videoCallOpen, setVideoCallOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) fetchFriends();
  }, [user]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const fetchFriends = async () => {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        id, friend_id,
        profiles!friendships_friend_id_fkey (id, full_name, avatar_url)
      `)
      .eq('user_id', user?.id)
      .eq('status', 'accepted');

    if (error) toast({ title: 'Error', description: error.message, variant: 'destructive' });
    else setFriends(data || []);
  };

  const fetchMessages = async () => {
    if (!selectedFriend || !user) return;

    const { data, error } = await supabase
      .from('messages')
      .select('*')
      .or(`and(sender_id.eq.${user.id},receiver_id.eq.${selectedFriend.profiles.id}),and(sender_id.eq.${selectedFriend.profiles.id},receiver_id.eq.${user.id})`)
      .order('created_at', { ascending: true });

    if (error) console.error(error);
    else setMessages(data || []);
  };

  // Real-time: New messages + Delivery updates
  useEffect(() => {
    if (!selectedFriend || !user) return;

    fetchMessages();

    const channel = supabase
      .channel(`chat:${[user.id, selectedFriend.profiles.id].sort().join('-')}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          const newMsg = payload.new as Message;
          const isFromFriend = newMsg.sender_id === selectedFriend.profiles.id;
          const isToMe = newMsg.receiver_id === user.id;

          if ((isFromFriend && isToMe) || newMsg.sender_id === user.id) {
            setMessages(prev => [...prev, newMsg]);
          }
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'messages',
          filter: `receiver_id=eq.${user.id}`,
        },
        (payload) => {
          const updated = payload.new as Message;
          setMessages(prev =>
            prev.map(msg =>
              msg.id === updated.id ? { ...msg, delivered_at: updated.delivered_at } : msg
            )
          );
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [selectedFriend, user]);

  // Mark messages as delivered when user views chat
  useEffect(() => {
    if (!selectedFriend || !user) return;

    const markDelivered = async () => {
      const { data } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('sender_id', selectedFriend.profiles.id)
        .is('delivered_at', null);

      if (data && data.length > 0) {
        const ids = data.map(m => m.id);
        await supabase
          .from('messages')
          .update({ delivered_at: new Date().toISOString() })
          .in('id', ids);
      }
    };

    markDelivered();
  }, [selectedFriend, user]);

  const uploadMedia = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      const ext = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${ext}`;
      const path = `${user?.id}/${fileName}`;

      const { error } = await supabase.storage.from('message-media').upload(path, file);
      if (error) throw error;

      const { data } = supabase.storage.from('message-media').getPublicUrl(path);
      return data.publicUrl;
    } catch (err: any) {
      toast({ title: 'Upload failed', description: err.message, variant: 'destructive' });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!newMessage.trim() && !mediaFile) || !selectedFriend) return;

    const tempId = Date.now().toString();
    const tempMessage: Message = {
      id: tempId,
      sender_id: user!.id,
      receiver_id: selectedFriend.profiles.id,
      content: newMessage.trim() || null,
      media_url: null,
      media_type: null,
      created_at: new Date().toISOString(),
      delivered_at: null,
      isSending: true,
    };

    // Optimistically add message
    setMessages(prev => [...prev, tempMessage]);
    setNewMessage('');
    setMediaFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (mediaFile) {
        mediaUrl = await uploadMedia(mediaFile);
        if (!mediaUrl) throw new Error('Upload failed');
        mediaType = mediaFile.type.startsWith('image/') ? 'image' : 'video';
      }

      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: user?.id,
          receiver_id: selectedFriend.profiles.id,
          content: newMessage.trim() || null,
          media_url: mediaUrl,
          media_type: mediaType,
        })
        .select()
        .single();

      if (error) throw error;

      // Remove temp message and add real one (prevents duplicates)
      setMessages(prev => [...prev.filter(m => m.id !== tempId), data]);
    } catch (err: any) {
      toast({ title: 'Failed to send', description: err.message, variant: 'destructive' });
      setMessages(prev => prev.filter(m => m.id !== tempId));
    }
  };

  const getMessageStatus = (msg: Message) => {
    if (msg.isSending) {
      return <Clock className="h-3.5 w-3.5 animate-spin" />;
    }
    if (!msg.delivered_at) {
      return <Check className="h-3.5 w-3.5" />;
    }
    return <CheckCheck className="h-4 w-4" />;
  };

  const formatTime = (date: string) => {
    return format(new Date(date), 'h:mm a');
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin h-10 w-10 border-4 border-[#2ec2b3] rounded-full border-t-transparent"></div></div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      <header className="bg-white/95 backdrop-blur-md border-b sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <h1 className="text-2xl sm:text-3xl font-bold text-[#2ec2b3] flex items-center gap-2 sm:gap-3">
              <MessageCircle className="h-6 w-6 sm:h-8 sm:w-8" /> Messages
            </h1>
          </div>
          <Button onClick={() => navigate('/friends')} className="bg-[#2ec2b3] hover:bg-[#28a399] text-sm sm:text-base">
            <UserPlus className="h-4 w-4 sm:h-5 sm:w-5 mr-2" /> Manage Friends
          </Button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        <div className="grid lg:grid-cols-4 gap-4 sm:gap-6 h-[calc(100vh-140px)] sm:h-[calc(100vh-160px)]">
          {/* Friends List */}
          <Card className="lg:col-span-1 bg-white/90 rounded-2xl shadow-lg flex flex-col overflow-hidden">
            <CardHeader className="bg-gradient-to-r from-[#2ec2b3]/10 to-cyan-50">
              <h3 className="font-semibold text-[#2ec2b3]">Chats</h3>
            </CardHeader>
            <ScrollArea className="flex-1">
              <div className="p-3 space-y-2">
                {friends.map(friend => (
                  <button
                    key={friend.id}
                    onClick={() => setSelectedFriend(friend)}
                    className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-left ${
                      selectedFriend?.id === friend.id ? 'bg-[#2ec2b3] text-white' : 'hover:bg-teal-50'
                    }`}
                  >
                    <Avatar>
                      <AvatarImage src={friend.profiles.avatar_url || ''} />
                      <AvatarFallback>{friend.profiles.full_name[0]}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{friend.profiles.full_name}</span>
                  </button>
                ))}
              </div>
            </ScrollArea>
          </Card>

          {/* Chat */}
          <Card className="lg:col-span-3 bg-white/95 rounded-2xl shadow-xl flex flex-col overflow-hidden">
            {selectedFriend ? (
              <>
                <VideoCallDialog
                  open={videoCallOpen}
                  onOpenChange={setVideoCallOpen}
                  friendName={selectedFriend.profiles.full_name}
                />
                <div className="border-b p-3 sm:p-5 flex items-center justify-between bg-gradient-to-r from-[#2ec2b3]/5">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <Avatar className="h-10 w-10 sm:h-12 sm:w-12">
                      <AvatarImage src={selectedFriend.profiles.avatar_url || ''} />
                      <AvatarFallback className="bg-[#2ec2b3] text-white">
                        {selectedFriend.profiles.full_name[0]}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-sm sm:text-base">{selectedFriend.profiles.full_name}</p>
                      <Badge className="bg-green-100 text-green-700 text-xs">Online</Badge>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setVideoCallOpen(true)}
                    className="flex items-center gap-2"
                  >
                    <VideoIcon className="h-4 w-4" />
                    <span className="hidden sm:inline">Call</span>
                  </Button>
                </div>

                <ScrollArea className="flex-1 p-3 sm:p-6">
                  <div className="space-y-3 sm:space-y-4">
                    {messages.map((msg, idx) => (
                      <div key={`${msg.id}-${idx}`} className={`flex ${msg.sender_id === user?.id ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[85%] sm:max-w-xs lg:max-w-md rounded-2xl p-3 sm:p-4 shadow-md relative ${
                          msg.sender_id === user?.id ? 'bg-[#2ec2b3] text-white' : 'bg-gray-100 text-gray-800'
                        }`}>
                          {msg.media_url && (
                            <div className="mb-3 rounded-xl overflow-hidden">
                              {msg.media_type === 'image' ? (
                                <img src={msg.media_url} className="rounded-xl max-w-full" />
                              ) : (
                                <video src={msg.media_url} controls className="rounded-xl max-w-full" />
                              )}
                            </div>
                          )}
                          {msg.content && <p className="break-words">{msg.content}</p>}
                          <div className="flex items-center gap-2 mt-1 text-xs opacity-70">
                            <span>{formatTime(msg.created_at)}</span>
                            {msg.sender_id === user?.id && (
                              <span className="flex items-center">
                                {getMessageStatus(msg)}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                    <div ref={messagesEndRef} />
                  </div>
                </ScrollArea>

                <div className="border-t bg-gray-50 p-4">
                  {mediaFile && (
                    <div className="mb-3 bg-white p-3 rounded-xl flex items-center gap-3 text-sm">
                      {mediaFile.type.startsWith('image/') ? <ImageIcon className="h-5 w-5 text-[#2ec2b3]" /> : <VideoIcon className="h-5 w-5 text-[#2ec2b3]" />}
                      <span className="flex-1 truncate">{mediaFile.name}</span>
                      <Button size="sm" variant="ghost" onClick={() => { setMediaFile(null); fileInputRef.current && (fileInputRef.current.value = ''); }}>
                        ×
                      </Button>
                    </div>
                  )}

                  <form onSubmit={handleSendMessage} className="flex gap-3">
                    <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={e => e.target.files?.[0] && setMediaFile(e.target.files[0])} className="hidden" />
                  <Button size="sm" variant="outline" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    <ImageIcon className="h-5 w-5" />
                  </Button>
                    <Input
                      value={newMessage}
                      onChange={e => setNewMessage(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1"
                      disabled={isUploading}
                    />
                    <Button type="submit" disabled={!newMessage.trim() && !mediaFile} className="bg-[#2ec2b3] hover:bg-[#28a399]">
                      <Send className="h-5 w-5" />
                    </Button>
                  </form>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                <div className="text-center">
                  <MessageCircle className="h-20 w-20 mx-auto mb-4 opacity-30" />
                  <p className="text-lg">Select a chat to start messaging</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Messages;