import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Check, X, Send, ClipboardList } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface PendingPost {
  id: string;
  content: string;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

interface DirectApproach {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_response: string | null;
  created_at: string;
  profiles: {
    full_name: string;
  };
}

const AdminDashboard = () => {
  const { user, isAdmin, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [pendingPosts, setPendingPosts] = useState<PendingPost[]>([]);
  const [approaches, setApproaches] = useState<DirectApproach[]>([]);
  const [isUpdating, setIsUpdating] = useState<string | null>(null);
  const [responses, setResponses] = useState<{ [key: string]: string }>({});

  useEffect(() => {
    if (!loading && (!user || !isAdmin)) {
      navigate('/dashboard');
    }
  }, [user, isAdmin, loading, navigate]);

  useEffect(() => {
    if (isAdmin) {
      fetchPendingPosts();
      fetchApproaches();

      const postsChannel = supabase
        .channel('admin-posts-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'posts' }, () => {
          fetchPendingPosts();
        })
        .subscribe();

      const approachesChannel = supabase
        .channel('admin-approaches-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_approaches' }, () => {
          fetchApproaches();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(postsChannel);
        supabase.removeChannel(approachesChannel);
      };
    }
  }, [isAdmin]);

  const fetchPendingPosts = async () => {
    const { data, error } = await supabase
      .from('posts')
      .select(`
        id,
        content,
        created_at,
        profiles (
          full_name
        )
      `)
      .eq('status', 'pending')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching pending posts:', error);
      return;
    }

    setPendingPosts(data as PendingPost[]);
  };

  const fetchApproaches = async () => {
    const { data, error } = await supabase
      .from('direct_approaches')
      .select(`
        id,
        subject,
        message,
        status,
        admin_response,
        created_at,
        profiles (
          full_name
        )
      `)
      .in('status', ['open', 'in_progress'])
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching approaches:', error);
      return;
    }

    setApproaches(data as DirectApproach[]);
  };

  const handleApprovePost = async (postId: string) => {
    setIsUpdating(postId);
    try {
      const { error } = await supabase.from('posts').update({ status: 'approved' }).eq('id', postId);

      if (error) throw error;

      toast({
        title: 'Post approved',
        description: 'The post is now visible to the community.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRejectPost = async (postId: string) => {
    setIsUpdating(postId);
    try {
      const { error } = await supabase.from('posts').update({ status: 'rejected' }).eq('id', postId);

      if (error) throw error;

      toast({
        title: 'Post rejected',
        description: 'The post has been removed from the queue.',
      });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(null);
    }
  };

  const handleRespondToApproach = async (approachId: string) => {
    const response = responses[approachId];
    if (!response || !response.trim()) {
      toast({
        title: 'Error',
        description: 'Please enter a response',
        variant: 'destructive',
      });
      return;
    }

    setIsUpdating(approachId);
    try {
      const { error } = await supabase
        .from('direct_approaches')
        .update({ admin_response: response, status: 'resolved' })
        .eq('id', approachId);

      if (error) throw error;

      toast({
        title: 'Response sent!',
        description: 'The resident will be notified.',
      });
      setResponses({ ...responses, [approachId]: '' });
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!isAdmin) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle pb-20 md:pb-8">
      <header className="bg-background border-b shadow-soft sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
              <ArrowLeft className="h-4 w-4" />
            </Button>
            <h1 className="text-xl sm:text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              Admin Dashboard
            </h1>
          </div>
        </div>
      </header>

      {/* Stats Overview */}
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
          <Card className="shadow-medium bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Pending Posts</p>
                  <p className="text-3xl font-bold text-primary">{pendingPosts.length}</p>
                </div>
                <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center">
                  <ClipboardList className="h-6 w-6 text-primary" />
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="shadow-medium bg-gradient-to-br from-secondary/5 to-transparent">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Open Requests</p>
                  <p className="text-3xl font-bold text-secondary">{approaches.length}</p>
                </div>
                <div className="w-12 h-12 bg-secondary/10 rounded-full flex items-center justify-center">
                  <Send className="h-6 w-6 text-secondary" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="posts" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="posts">
              Pending Posts {pendingPosts.length > 0 && `(${pendingPosts.length})`}
            </TabsTrigger>
            <TabsTrigger value="approaches">
              Direct Approaches {approaches.length > 0 && `(${approaches.length})`}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="posts" className="space-y-4">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Pending Posts</CardTitle>
                <CardDescription>
                  Review and moderate community posts before they appear in the feed
                </CardDescription>
              </CardHeader>
              <CardContent>
                {pendingPosts.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <p>No pending posts to review</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {pendingPosts.map((post) => (
                      <Card key={post.id} className="shadow-soft">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-lg">{post.profiles.full_name}</CardTitle>
                            <CardDescription>
                              {formatDistanceToNow(new Date(post.created_at), { addSuffix: true })}
                            </CardDescription>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <p className="whitespace-pre-wrap">{post.content}</p>
                          <div className="flex gap-2">
                            <Button
                              onClick={() => handleApprovePost(post.id)}
                              disabled={isUpdating === post.id}
                              className="flex-1"
                            >
                              <Check className="h-4 w-4 mr-2" />
                              Approve
                            </Button>
                            <Button
                              onClick={() => handleRejectPost(post.id)}
                              disabled={isUpdating === post.id}
                              variant="destructive"
                              className="flex-1"
                            >
                              <X className="h-4 w-4 mr-2" />
                              Reject
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="approaches" className="space-y-4">
            <Card className="shadow-medium">
              <CardHeader>
                <CardTitle>Direct Approaches</CardTitle>
                <CardDescription>Respond to residents' requests and concerns</CardDescription>
              </CardHeader>
              <CardContent>
                {approaches.length === 0 ? (
                  <div className="py-12 text-center text-muted-foreground">
                    <p>No pending approaches</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {approaches.map((approach) => (
                      <Card key={approach.id} className="shadow-soft">
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <div className="space-y-1">
                              <CardTitle className="text-lg">{approach.subject}</CardTitle>
                              <CardDescription>
                                From {approach.profiles.full_name} •{' '}
                                {formatDistanceToNow(new Date(approach.created_at), { addSuffix: true })}
                              </CardDescription>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          <div>
                            <p className="text-sm font-medium mb-1">Request:</p>
                            <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                              {approach.message}
                            </p>
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor={`response-${approach.id}`}>Your Response:</Label>
                            <Textarea
                              id={`response-${approach.id}`}
                              value={responses[approach.id] || ''}
                              onChange={(e) =>
                                setResponses({ ...responses, [approach.id]: e.target.value })
                              }
                              placeholder="Type your response to the resident..."
                              className="min-h-[100px]"
                            />
                          </div>
                          <Button
                            onClick={() => handleRespondToApproach(approach.id)}
                            disabled={isUpdating === approach.id}
                            className="w-full"
                          >
                            <Send className="h-4 w-4 mr-2" />
                            {isUpdating === approach.id ? 'Sending...' : 'Send Response'}
                          </Button>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default AdminDashboard;
