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

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
      <div className="text-center">
        <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-[#2ec2b3] mx-auto"></div>
        <p className="mt-3 text-[#2ec2b3] font-semibold text-sm">Loading...</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50 pb-20 md:pb-8">
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="h-9 w-9">
                <ArrowLeft className="h-4 w-4" />
              </Button>
              <h1 className="text-lg sm:text-2xl font-bold text-[#2ec2b3]">Contact Barangay</h1>
            </div>
            <Button onClick={() => setShowForm(!showForm)} size="sm" className="text-xs sm:text-sm">
              <Send className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{showForm ? 'Cancel' : 'New Request'}</span>
            </Button>
          </div>
        </div>
      </header>

      <div className="max-w-4xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
        {showForm && (
          <Card className="mb-4 sm:mb-6 shadow-md">
            <CardHeader className="p-3 sm:p-6">
              <CardTitle className="text-base sm:text-lg">Submit a Request</CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Contact barangay officials for assistance or concerns
              </CardDescription>
            </CardHeader>
            <CardContent className="p-3 sm:p-6 pt-0 sm:pt-0">
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="subject" className="text-sm">Subject</Label>
                  <Input id="subject" name="subject" required placeholder="Brief description" className="h-9 text-sm" />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="message" className="text-sm">Message</Label>
                  <Textarea
                    id="message"
                    name="message"
                    required
                    placeholder="Provide detailed information..."
                    className="min-h-[100px] sm:min-h-[150px] text-sm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm">Attach Media (Optional)</Label>
                  <input ref={fileInputRef} type="file" accept="image/*,video/*" onChange={handleFileSelect} className="hidden" />
                  {mediaFile ? (
                    <div className="flex items-center gap-2 p-2.5 bg-muted rounded-lg">
                      {mediaFile.type.startsWith('image/') ? <Image className="h-4 w-4 text-muted-foreground" /> : <Video className="h-4 w-4 text-muted-foreground" />}
                      <span className="flex-1 truncate text-xs sm:text-sm">{mediaFile.name}</span>
                      <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => { setMediaFile(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>
                        Remove
                      </Button>
                    </div>
                  ) : (
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()} className="w-full h-9 text-sm">
                      <Image className="h-4 w-4 mr-2" /> Choose File
                    </Button>
                  )}
                </div>
                <Button type="submit" disabled={isSubmitting || isUploading} className="w-full h-9 text-sm">
                  {isSubmitting || isUploading ? 'Submitting...' : 'Submit Request'}
                </Button>
              </form>
            </CardContent>
          </Card>
        )}

        <div className="space-y-3 sm:space-y-4">
          <h2 className="text-base sm:text-xl font-semibold">Your Requests</h2>
          {approaches.length === 0 ? (
            <Card className="shadow-md">
              <CardContent className="py-10 sm:py-12 text-center text-muted-foreground">
                <p className="text-sm">No requests yet. Click "New Request" to contact officials.</p>
              </CardContent>
            </Card>
          ) : (
            approaches.map((approach) => (
              <Card key={approach.id} className="shadow-md overflow-hidden">
                <CardHeader className="p-3 sm:p-6">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5 min-w-0">
                      <CardTitle className="text-sm sm:text-lg truncate">{approach.subject}</CardTitle>
                      <CardDescription className="text-xs">
                        {formatDistanceToNow(new Date(approach.created_at), { addSuffix: true })}
                      </CardDescription>
                    </div>
                    <Badge className={`${getStatusColor(approach.status)} text-[10px] sm:text-xs flex-shrink-0`}>
                      {approach.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3 sm:space-y-4 p-3 sm:p-6 pt-0 sm:pt-0">
                  <div>
                    <p className="text-xs font-medium mb-1">Your Request:</p>
                    <p className="text-xs sm:text-sm text-muted-foreground whitespace-pre-wrap">{approach.message}</p>
                  </div>
                  {approach.media_url && (
                    <div>
                      {approach.media_type === 'image' ? (
                        <img src={approach.media_url} alt="Attached" className="rounded-lg max-w-full h-auto max-h-48 sm:max-h-64 object-cover" />
                      ) : (
                        <video src={approach.media_url} controls className="rounded-lg max-w-full h-auto max-h-48 sm:max-h-64" />
                      )}
                    </div>
                  )}
                  {approach.admin_response && (
                    <div className="border-t pt-3">
                      <p className="text-xs font-medium mb-1 text-primary">Barangay Response:</p>
                      <p className="text-xs sm:text-sm whitespace-pre-wrap">{approach.admin_response}</p>
                    </div>
                  )}
                  {!approach.admin_response && approach.status === 'open' && (
                    <p className="text-xs sm:text-sm text-muted-foreground italic">Waiting for response...</p>
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
