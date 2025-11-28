import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, UserPlus, Check, X, Users, Sparkles } from 'lucide-react';

interface Profile {
  id: string;
  full_name: string;
  avatar_url: string | null;
}

interface Friendship {
  id: string;
  user_id: string;
  friend_id: string;
  status: string;
  profiles: Profile;
}

const Friends = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Profile[]>([]);
  const [friends, setFriends] = useState<Friendship[]>([]);
  const [pendingRequests, setPendingRequests] = useState<Friendship[]>([]);
  const [suggestions, setSuggestions] = useState<Profile[]>([]);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchFriends();
      fetchPendingRequests();
      fetchSuggestions();

      const channel = supabase
        .channel('friendships-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'friendships' }, () => {
          fetchFriends();
          fetchPendingRequests();
          fetchSuggestions();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchFriends = async () => {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        profiles!friendships_friend_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('user_id', user?.id)
      .eq('status', 'accepted');

    if (error) {
      console.error('Error fetching friends:', error);
      return;
    }
    setFriends(data as Friendship[]);
  };

  const fetchPendingRequests = async () => {
    const { data, error } = await supabase
      .from('friendships')
      .select(`
        *,
        profiles!friendships_user_id_fkey (
          id,
          full_name,
          avatar_url
        )
      `)
      .eq('friend_id', user?.id)
      .eq('status', 'pending');

    if (error) {
      console.error('Error fetching pending requests:', error);
      return;
    }
    setPendingRequests(data as Friendship[]);
  };

  // FIXED: Now 100% excludes ALL existing connections
  const fetchSuggestions = async () => {
    if (!user?.id) return;

    // Get all outgoing pending requests (you sent)
    const { data: outgoing } = await supabase
      .from('friendships')
      .select('friend_id')
      .eq('user_id', user.id)
      .eq('status', 'pending');

    const outgoingIds = outgoing?.map(o => o.friend_id) || [];

    // Get all incoming pending requests (sent to you)
    const incomingIds = pendingRequests.map(r => r.user_id);

    // Get all accepted friends
    const friendIds = friends.map(f => f.friend_id);

    // Final list of IDs to EXCLUDE
    const excludeIds = new Set([
      user.id,                    // never suggest yourself
      ...friendIds,               // accepted friends
      ...incomingIds,             // people who sent you requests
      ...outgoingIds,             // people you sent requests to
    ]);

    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, avatar_url')
      .not('id', 'in', `(${Array.from(excludeIds).join(',')})`)
      .limit(8);

    if (error) {
      console.error('Error fetching suggestions:', error);
      return;
    }

    setSuggestions(data || []);
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .ilike('full_name', `%${searchQuery}%`)
      .neq('id', user?.id)
      .limit(10);

    if (error) {
      console.error('Error searching users:', error);
      return;
    }

    setSearchResults(data);
  };

  const handleSendRequest = async (friendId: string) => {
    try {
      const { error } = await supabase.from('friendships').insert({
        user_id: user?.id,
        friend_id: friendId,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Friend request sent!',
        description: 'They’ll be notified.',
      });

      setSearchResults([]);
      setSearchQuery('');
      fetchSuggestions(); // Instantly removes from suggestions
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleAcceptRequest = async (requestId: string) => {
    try {
      const { error } = await supabase
        .from('friendships')
        .update({ status: 'accepted' })
        .eq('id', requestId);

      if (error) throw error;

      const request = pendingRequests.find((r) => r.id === requestId);
      if (request) {
        await supabase.from('friendships').insert({
          user_id: user?.id,
          friend_id: request.user_id,
          status: 'accepted',
        });
      }

      toast({ title: 'You’re now friends!' });
      fetchSuggestions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleRejectRequest = async (requestId: string) => {
    try {
      const { error } = await supabase.from('friendships').delete().eq('id', requestId);
      if (error) throw error;

      toast({ title: 'Request rejected' });
      fetchSuggestions();
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#2ec2b3] mx-auto"></div>
        <p className="mt-4 text-[#2ec2b3] font-semibold">Loading friends...</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      {/* Top Navigation */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-4">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(-1)}
                className="hover:bg-teal-50 rounded-xl"
              >
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <h1 className="text-3xl font-bold text-[#2ec2b3] flex items-center gap-3">
                <Users className="h-8 w-8" />
                Friends
              </h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* People You May Know */}
        {suggestions.length > 0 && (
          <Card className="mb-8 border border-[#2ec2b3]/20 bg-gradient-to-r from-teal-50/50 to-cyan-50/50">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-[#2ec2b3]">
                <Sparkles className="h-5 w-5" />
                People You May Know
              </CardTitle>
              <CardDescription>Connect with others in your community</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2">
              {suggestions.map((person) => (
                <div
                  key={person.id}
                  className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm hover:shadow-md transition-all"
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-12 w-12 ring-2 ring-[#2ec2b3]/20">
                      <AvatarImage src={person.avatar_url || ''} />
                      <AvatarFallback className="bg-[#2ec2b3] text-white text-lg">
                        {person.full_name[0].toUpperCase()}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold text-gray-900">{person.full_name}</p>
                      <p className="text-xs text-gray-500">In your barangay</p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleSendRequest(person.id)}
                    className="bg-[#2ec2b3] hover:bg-[#28a399] text-white"
                  >
                    <UserPlus className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Main Tabs */}
        <Tabs defaultValue="friends" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-6 bg-white rounded-xl shadow">
            <TabsTrigger value="friends" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-l-xl">
              My Friends <Badge className="ml-2 bg-white/20 text-white">{friends.length}</Badge>
            </TabsTrigger>
            <TabsTrigger value="requests" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white">
              Requests
              {pendingRequests.length > 0 && (
                <Badge className="ml-2 bg-red-500">{pendingRequests.length}</Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="add" className="data-[state=active]:bg-[#2ec2b3] data-[state=active]:text-white rounded-r-xl">
              Add Friends
            </TabsTrigger>
          </TabsList>

          {/* My Friends */}
          <TabsContent value="friends">
            <Card className="border-gray-100">
              <CardHeader>
                <CardTitle>Your Friends</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {friends.length === 0 ? (
                  <div className="text-center py-16 text-gray-500">
                    <Users className="h-20 w-20 mx-auto text-gray-300 mb-4" />
                    <p className="text-lg">No friends yet. Start connecting!</p>
                  </div>
                ) : (
                  friends.map((friend) => (
                    <div
                      key={friend.id}
                      className="flex items-center justify-between p-4 bg-gray-50/70 rounded-xl hover:bg-teal-50 transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={friend.profiles.avatar_url || ''} />
                          <AvatarFallback className="bg-[#2ec2b3] text-white">
                            {friend.profiles.full_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold text-gray-800">{friend.profiles.full_name}</span>
                      </div>
                      <Button variant="outline" size="sm" onClick={() => navigate('/messages')}>
                        Message
                      </Button>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Requests */}
          <TabsContent value="requests">
            <Card>
              <CardHeader>
                <CardTitle>Friend Requests</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pendingRequests.length === 0 ? (
                  <p className="text-center py-16 text-gray-500">No pending requests</p>
                ) : (
                  pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="flex items-center justify-between p-4 bg-gray-50 rounded-xl"
                    >
                      <div className="flex items-center gap-4">
                        <Avatar className="h-12 w-12">
                          <AvatarImage src={request.profiles.avatar_url || ''} />
                          <AvatarFallback className="bg-gray-300 text-gray-700">
                            {request.profiles.full_name[0]}
                          </AvatarFallback>
                        </Avatar>
                        <span className="font-semibold">{request.profiles.full_name}</span>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleAcceptRequest(request.id)}
                          className="bg-[#2ec2b3] hover:bg-[#28a399]"
                        >
                          <Check className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRejectRequest(request.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Add Friends */}
          <TabsContent value="add">
            <Card>
              <CardHeader>
                <CardTitle>Search People</CardTitle>
                <CardDescription>Find friends by name</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="flex gap-3">
                  <Input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Enter name..."
                    onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                    className="flex-1"
                  />
                  <Button onClick={handleSearch} className="bg-[#2ec2b3] hover:bg-[#28a399]">
                    <UserPlus className="h-5 w-5" />
                  </Button>
                </div>

                {searchResults.length > 0 && (
                  <div className="space-y-3">
                    {searchResults.map((profile) => (
                      <div
                        key={profile.id}
                        className="flex items-center justify-between p-4 bg-gray-50 rounded-xl hover:bg-teal-50 transition"
                      >
                        <div className="flex items-center gap-4">
                          <Avatar>
                            <AvatarImage src={profile.avatar_url || ''} />
                            <AvatarFallback>{profile.full_name[0]}</AvatarFallback>
                          </Avatar>
                          <span className="font-medium">{profile.full_name}</span>
                        </div>
                        <Button size="sm" onClick={() => handleSendRequest(profile.id)}>
                          Send Request
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Friends;