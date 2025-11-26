import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Send, Image, Video } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ApproachConversation } from '@/components/ApproachConversation';

interface Approach {
  id: string;
  subject: string;
  message: string;
  status: string;
  admin_response: string | null;
  created_at: string;
  media_url: string | null;
  media_type: string | null;
}

const DirectApproach = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [approaches, setApproaches] = useState<Approach[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      fetchApproaches();

      const channel = supabase
        .channel('approaches-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'direct_approaches' }, () => {
          fetchApproaches();
        })
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const fetchApproaches = async () => {
    const { data, error } = await supabase
      .from('direct_approaches')
      .select('*')
      .eq('user_id', user?.id)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching approaches:', error);
      return;
    }

    setApproaches(data);
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const maxSize = 50 * 1024 * 1024; // 50MB
    if (file.size > maxSize) {
      toast({
        title: 'File too large',
        description: 'Maximum file size is 50MB',
        variant: 'destructive',
      });
      return;
    }

    const allowedTypes = ['image/', 'video/'];
    if (!allowedTypes.some(type => file.type.startsWith(type))) {
      toast({
        title: 'Invalid file type',
        description: 'Only images and videos are allowed',
        variant: 'destructive',
      });
      return;
    }

    setMediaFile(file);
  };

  const uploadMedia = async (file: File): Promise<string | null> => {
    try {
      setIsUploading(true);
      const fileExt = file.name.split('.').pop();
      const fileName = `${user?.id}/${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from('approach-media')
        .upload(fileName, file);

      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage
        .from('approach-media')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error: any) {
      toast({
        title: 'Upload Error',
        description: error.message,
        variant: 'destructive',
      });
      return null;
    } finally {
      setIsUploading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);

    const formData = new FormData(e.currentTarget);
    const subject = formData.get('subject') as string;
    const message = formData.get('message') as string;

    try {
      let mediaUrl = null;
      let mediaType = null;

      if (mediaFile) {
        mediaUrl = await uploadMedia(mediaFile);
        if (!mediaUrl) {
          setIsSubmitting(false);
          return;
        }
        mediaType = mediaFile.type.startsWith('image/') ? 'image' : 'video';
      }

      const { error } = await supabase.from('direct_approaches').insert({
        user_id: user?.id,
        subject,
        message,
        status: 'open',
        media_url: mediaUrl,
        media_type: mediaType,
      });

      if (error) throw error;

      toast({
        title: 'Request submitted!',
        description: 'Barangay officials will respond soon.',
      });
      setShowForm(false);
      setMediaFile(null);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    } catch (error: any) {
      toast({
        title: 'Error',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-accent';
      case 'in_progress':
        return 'bg-secondary';
      case 'resolved':
        return 'bg-primary';
      case 'closed':
        return 'bg-muted';
      default:
        return 'bg-muted';
    }
  };

  if (loading) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="bg-background border-b shadow-soft">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button variant="outline" size="icon" onClick={() => navigate('/dashboard')}>
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-2xl font-bold">Direct Approach to Barangay</h1>
            </div>
            <Button onClick={() => setShowForm(!showForm)}>
              <Send className="h-4 w-4 mr-2" />
              {showForm ? 'Cancel' : 'New Request'}
            </Button>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {showForm && (
          <Card className="mb-6 shadow-soft">
            <CardHeader>
              <CardTitle>Submit a Request</CardTitle>
              <CardDescription>
                Contact barangay officials for assistance, concerns, or formal requests
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="subject">Subject</Label>
                  <Input id="subject" name="subject" required placeholder="Brief description of your request" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="message">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    required
                    placeholder="Provide detailed information about your request..."
                    className="min-h-[150px]"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Attach Image or Video (Optional)</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,video/*"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {mediaFile ? (
                    <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
                      {mediaFile.type.startsWith('image/') ? (
                        <Image className="h-5 w-5 text-muted-foreground" />
                      ) : (
                        <Video className="h-5 w-5 text-muted-foreground" />
                      )}
                      <span className="flex-1 truncate text-sm">{mediaFile.name}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setMediaFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full"
                    >
                      <Image className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                  )}
                </div>
                <Button type="submit" disabled={isSubmitting || isUploading} className="w-full">
                  {isSubmitting || isUploading ? 'Submitting...' : 'Submit Request'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-4">
          <h2 className="text-xl font-semibold">Your Requests</h2>
          {approaches.length === 0 ? (
            <Card className="shadow-soft">
              <CardContent className="py-12 text-center text-muted-foreground">
                <p>No requests yet. Click "New Request" to contact barangay officials.</p>
              </CardContent>
            </Card>
          ) : (
            approaches.map((approach) => (
              <Card key={approach.id} className="shadow-soft">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg">{approach.subject}</CardTitle>
                      <CardDescription>
                        {formatDistanceToNow(new Date(approach.created_at), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <Badge className={getStatusColor(approach.status)}>
                      {approach.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-sm font-medium mb-1">Your Request:</p>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{approach.message}</p>
                  </div>
                  {approach.media_url && (
                    <div>
                      {approach.media_type === 'image' ? (
                        <img
                          src={approach.media_url}
                          alt="Attached media"
                          className="rounded-lg max-w-full h-auto max-h-64 object-cover"
                        />
                      ) : (
                        <video
                          src={approach.media_url}
                          controls
                          className="rounded-lg max-w-full h-auto max-h-64"
                        />
                      )}
                    </div>
                  )}
                  {approach.admin_response && (
                    <div className="border-t pt-4">
                      <p className="text-sm font-medium mb-1 text-primary">Barangay Response:</p>
                      <p className="text-sm whitespace-pre-wrap">{approach.admin_response}</p>
                    </div>
                  )}
                  {!approach.admin_response && approach.status === 'open' && (
                    <p className="text-sm text-muted-foreground italic">
                      Waiting for barangay officials to respond...
                    </p>
                  )}
                  <ApproachConversation approachId={approach.id} currentUserId={user.id} />
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>
    </div>
  );
};

export default DirectApproach;
