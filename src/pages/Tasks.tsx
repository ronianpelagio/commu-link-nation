import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Plus, MapPin, DollarSign, Check, Navigation, Star, ClipboardList, Trash2, Locate } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { TaskRatingDialog } from '@/components/TaskRatingDialog';

interface Task {
  id: string;
  title: string;
  description: string;
  payment_amount: number | null;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  status: string;
  created_at: string;
  creator_id: string;
  accepted_by: string | null;
  profiles: { full_name: string };
  accepter?: { full_name: string } | null;
}

const Tasks = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isCreating, setIsCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [mapDialogOpen, setMapDialogOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [taskToRate, setTaskToRate] = useState<Task | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [taskToDelete, setTaskToDelete] = useState<Task | null>(null);
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);

  useEffect(() => {
    const token = import.meta.env.VITE_MAPBOX_PUBLIC_TOKEN;
    if (token) mapboxgl.accessToken = token;
  }, []);

  useEffect(() => {
    if (!loading && !user) navigate('/auth');
  }, [user, loading, navigate]);

  useEffect(() => {
    if (user) {
      getUserLocation();
      fetchTasks();

      const channel = supabase
        .channel('tasks-changes')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'tasks' }, () => fetchTasks())
        .subscribe();

      return () => {
        supabase.removeChannel(channel);
      };
    }
  }, [user]);

  const getUserLocation = () => {
    if (!navigator.geolocation) return;

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setUserLocation(location);
        toast({ title: "Location updated", description: "Ready to post tasks!" });
      },
      () => {
        toast({ title: "Location denied", description: "Enable to use your current location", variant: "destructive" });
      },
      { enableHighAccuracy: true }
    );
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371e3;
    const φ1 = (lat1 * Math.PI) / 180;
    const φ2 = (lat2 * Math.PI) / 180;
    const Δφ = ((lat2 - lat1) * Math.PI) / 180;
    const Δλ = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  };

  const fetchTasks = async () => {
    const { data, error } = await supabase
      .from('tasks')
      .select(`
        *,
        profiles!tasks_creator_id_fkey (full_name)
      `)
      .order('created_at', { ascending: false });

    if (error) return console.error(error);

    const tasksWithAccepters = await Promise.all(
      (data as Task[]).map(async (task) => {
        if (task.accepted_by) {
          const { data: accepterData } = await supabase
            .from('profiles')
            .select('full_name')
            .eq('id', task.accepted_by)
            .single();
          return { ...task, accepter: accepterData };
        }
        return task;
      })
    );

    let filtered = tasksWithAccepters;
    if (userLocation) {
      filtered = tasksWithAccepters.filter((task: Task) => {
        if (!task.location_lat || !task.location_lng) return true;
        const distance = calculateDistance(userLocation.lat, userLocation.lng, task.location_lat, task.location_lng);
        return distance <= 50;
      });
    }

    setTasks(filtered);
  };

  const handleCreateTask = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!userLocation) {
      toast({ title: "Location needed", description: "Please allow location access first", variant: "destructive" });
      return;
    }

    setIsCreating(true);
    const formData = new FormData(e.currentTarget);
    const title = formData.get('title') as string;
    const description = formData.get('description') as string;
    const paymentAmount = formData.get('payment') as string;

    try {
      const { error } = await supabase.from('tasks').insert({
        creator_id: user?.id,
        title,
        description,
        payment_amount: paymentAmount ? parseFloat(paymentAmount) : null,
        location_lat: userLocation.lat,
        location_lng: userLocation.lng,
        location_address: "My current location",
        status: 'open',
      });

      if (error) throw error;

      toast({ title: "Task posted!", description: "Live in your area" });
      setDialogOpen(false);
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setIsCreating(false);
    }
  };

  const handleDeleteTask = async () => {
    if (!taskToDelete) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskToDelete.id)
        .eq('creator_id', user?.id);

      if (error) throw error;

      toast({ title: "Task deleted", description: "Removed from the board" });
      setDeleteDialogOpen(false);
      setTaskToDelete(null);
      fetchTasks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleAcceptTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .update({ accepted_by: user?.id, status: 'in_progress' })
        .eq('id', taskId);
      if (error) throw error;
      toast({ title: "Task accepted!" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleCompleteTask = async (taskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;

    try {
      const { error } = await supabase
        .from('tasks')
        .update({ status: 'completed' })
        .eq('id', taskId);
      if (error) throw error;

      toast({ title: "Task completed!" });

      if (task.creator_id === user?.id && task.accepted_by) {
        setTaskToRate(task);
        setRatingDialogOpen(true);
      }
      fetchTasks();
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const handleSubmitRating = async (rating: number, comment: string) => {
    if (!taskToRate?.accepted_by) return;
    try {
      const { error } = await supabase.from('task_ratings').insert({
        task_id: taskToRate.id,
        rated_user_id: taskToRate.accepted_by,
        rater_id: user?.id,
        rating,
        comment: comment || null,
      });
      if (error) throw error;
      toast({ title: "Thank you!", description: "Rating submitted" });
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    }
  };

  const openTaskMap = (task: Task) => {
    if (!task.location_lat || !task.location_lng) return;
    setSelectedTask(task);
    setMapDialogOpen(true);

    setTimeout(() => {
      if (!mapContainer.current) return;
      if (map.current) map.current.remove();

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [task.location_lng!, task.location_lat!],
        zoom: 17,
      });

      new mapboxgl.Marker({ color: '#dc2626' })
        .setLngLat([task.location_lng!, task.location_lat!])
        .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`<h3 class="font-bold">${task.title}</h3>`))
        .addTo(map.current!)
        .togglePopup();

      if (userLocation) {
        new mapboxgl.Marker({ color: '#2563eb' })
          .setLngLat([userLocation.lng, userLocation.lat])
          .setPopup(new mapboxgl.Popup().setHTML('<p class="font-medium text-blue-600">You are here</p>'))
          .addTo(map.current!);
      }

      map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      map.current.addControl(new mapboxgl.FullscreenControl());

      if (userLocation) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend([task.location_lng!, task.location_lat!]);
        bounds.extend([userLocation.lng, userLocation.lat]);
        map.current!.fitBounds(bounds, { padding: 100, duration: 1500 });
      }
    }, 150);
  };

  const getDirections = (task: Task) => {
    if (!task.location_lat || !task.location_lng) return;
    const origin = userLocation ? `${userLocation.lat},${userLocation.lng}` : '';
    const url = origin
      ? `https://www.google.com/maps/dir/?api=1&origin=${origin}&destination=${task.location_lat},${task.location_lng}&travelmode=walking`
      : `https://www.google.com/maps/search/?api=1&query=${task.location_lat},${task.location_lng}`;
    window.open(url, '_blank');
  };

  if (loading) return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 to-cyan-50 flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#2ec2b3] border-t-transparent"></div>
        <p className="mt-4 text-[#2ec2b3] font-semibold">Loading tasks...</p>
      </div>
    </div>
  );

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      {/* Top Bar */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-100 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-2 sm:px-4 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <div className="flex items-center gap-2 sm:gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="hover:bg-teal-50 rounded-xl">
                <ArrowLeft className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#2ec2b3] flex items-center gap-2 sm:gap-3">
                <ClipboardList className="h-6 w-6 sm:h-8 sm:w-8" />
                <span className="hidden sm:inline">Task Board</span>
                <span className="sm:hidden">Tasks</span>
              </h1>
            </div>

            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-[#2ec2b3] hover:bg-[#28a399] text-white rounded-xl shadow-lg text-sm sm:text-base">
                  <Plus className="h-4 w-4 sm:h-5 sm:w-5 sm:mr-2" />
                  <span className="hidden sm:inline">Create Task</span>
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Create New Task</DialogTitle>
                  <DialogDescription>Post a task using your current location</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-4 mt-4">
                  <div>
                    <Label>Title</Label>
                    <Input name="title" required placeholder="e.g., Help carry groceries" className="mt-1" />
                  </div>
                  <div>
                    <Label>Description</Label>
                    <Textarea name="description" required placeholder="What needs to be done?" className="min-h-32 mt-1" />
                  </div>
                  <div>
                    <Label>Payment (₱) <span className="text-gray-400 text-xs">(optional)</span></Label>
                    <Input name="payment" type="number" step="0.01" placeholder="50.00" className="mt-1" />
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg border border-green-200">
                    <Locate className="h-6 w-6 text-green-600" />
                    <div>
                      <p className="font-medium text-green-800">Using your current location</p>
                      <p className="text-xs text-green-600">Only people within 50m can see this task</p>
                    </div>
                  </div>

                  <Button type="submit" disabled={isCreating || !userLocation} className="w-full bg-[#2ec2b3] hover:bg-[#28a399]">
                    {isCreating ? 'Posting...' : 'Post Task Now'}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-2 sm:px-4 py-4 sm:py-8">
        {!userLocation && (
          <Card className="mb-4 sm:mb-6 border-orange-200 bg-orange-50">
            <CardContent className="py-3 sm:py-4 flex items-center gap-3">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-orange-600 flex-shrink-0" />
              <p className="text-xs sm:text-sm text-orange-800">Enable location to post & see tasks nearby</p>
            </CardContent>
          </Card>
        )}

        <ScrollArea className="h-[calc(100vh-160px)] sm:h-[calc(100vh-200px)] pr-2 sm:pr-4">
          <div className="grid gap-4 sm:gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
            {tasks.length === 0 ? (
              <Card className="col-span-full">
                <CardContent className="py-24 text-center">
                  <ClipboardList className="h-20 w-20 mx-auto text-gray-300 mb-4" />
                  <p className="text-xl text-gray-600">No tasks nearby</p>
                  <p className="text-sm text-gray-400 mt-2">Be the first to post one!</p>
                </CardContent>
              </Card>
            ) : (
              tasks.map((task) => (
                <Card key={task.id} className="shadow-lg hover:shadow-xl transition-all duration-300 border border-gray-100 overflow-hidden">
                  <CardHeader className="bg-gradient-to-r from-[#2ec2b3]/5 to-cyan-50">
                    <div className="flex justify-between items-start">
                      <div>
                        <CardTitle className="text-xl">{task.title}</CardTitle>
                        <CardDescription>
                          by <strong>{task.profiles.full_name}</strong> · {formatDistanceToNow(new Date(task.created_at), { addSuffix: true })}
                        </CardDescription>
                        {task.accepter && <p className="text-sm text-[#2ec2b3] font-medium mt-1">Accepted by {task.accepter.full_name}</p>}
                      </div>
                      {task.status === 'in_progress' && <Badge className="bg-yellow-100 text-yellow-800">In Progress</Badge>}
                      {task.status === 'completed' && <Badge className="bg-green-100 text-green-800">Completed</Badge>}
                    </div>
                  </CardHeader>

                  <CardContent className="pt-4 space-y-4">
                    <p className="text-gray-700 leading-relaxed">{task.description}</p>

                    {task.payment_amount && (
                      <div className="flex items-center font-bold text-[#2ec2b3] text-lg">
                        <DollarSign className="h-5 w-5" />
                        ₱{task.payment_amount.toFixed(2)}
                      </div>
                    )}

                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <MapPin className="h-4 w-4 text-[#2ec2b3]" />
                      <span>Nearby location</span>
                    </div>

                    {task.location_lat && task.location_lng && (
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => openTaskMap(task)} className="flex-1">
                          <MapPin className="h-4 w-4 mr-1" /> Map
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => getDirections(task)} className="flex-1">
                          <Navigation className="h-4 w-4 mr-1" /> Directions
                        </Button>
                      </div>
                    )}

                    <div className="pt-4 border-t space-y-3">
                      {/* Your own task controls */}
                      {task.creator_id === user.id && task.status === 'open' && (
                        <div className="flex gap-2">
                          <Button variant="destructive" size="sm" onClick={() => { setTaskToDelete(task); setDeleteDialogOpen(true); }} className="flex-1">
                            <Trash2 className="h-4 w-4 mr-1" /> Delete
                          </Button>
                        </div>
                      )}

                      {task.status === 'open' && task.creator_id !== user.id && (
                        <Button onClick={() => handleAcceptTask(task.id)} className="w-full bg-[#2ec2b3] hover:bg-[#28a399]">
                          Accept Task
                        </Button>
                      )}
                      {task.status === 'in_progress' && task.accepted_by === user.id && (
                        <Button onClick={() => handleCompleteTask(task.id)} className="w-full bg-green-600 hover:bg-green-700">
                          <Check className="h-4 w-4 mr-2" /> Mark Complete
                        </Button>
                      )}
                      {task.status === 'in_progress' && task.creator_id === user.id && (
                        <Button onClick={() => handleCompleteTask(task.id)} className="w-full bg-green-600 hover:bg-green-700">
                          <Check className="h-4 w-4 mr-2" /> Confirm Done
                        </Button>
                      )}
                      {task.status === 'completed' && task.creator_id === user.id && (
                        <Button variant="outline" onClick={() => { setTaskToRate(task); setRatingDialogOpen(true); }} className="w-full border-[#2ec2b3] text-[#2ec2b3] hover:bg-teal-50">
                          <Star className="h-4 w-4 mr-2" /> Rate Worker
                        </Button>
                      )}
                      {task.creator_id === user.id && task.status !== 'open' && (
                        <div className="text-center py-3 bg-teal-50 rounded-lg text-[#2ec2b3] font-medium">Your Task</div>
                      )}
                      {task.status === 'completed' && (
                        <div className="text-center py-3 bg-green-50 rounded-lg text-green-700 font-medium">Task Completed</div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </ScrollArea>
      </main>

      {/* Map Dialog */}
      <Dialog open={mapDialogOpen} onOpenChange={setMapDialogOpen}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-2xl">
          <DialogHeader className="p-6 bg-gradient-to-r from-[#2ec2b3]/10 to-cyan-50">
            <DialogTitle className="text-2xl">{selectedTask?.title}</DialogTitle>
            <DialogDescription className="flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              Nearby location
            </DialogDescription>
          </DialogHeader>
          <div ref={mapContainer} className="w-full h-96 md:h-[500px]" />
          <div className="p-4 bg-gray-50 border-t">
            <Button onClick={() => getDirections(selectedTask!)} className="w-full bg-[#2ec2b3] hover:bg-[#28a399]">
              <Navigation className="h-5 w-5 mr-2" />
              Get Walking Directions
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this task?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. The task will be permanently removed.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteTask} className="bg-red-600 hover:bg-red-700">
              Delete Task
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Rating Dialog */}
      {taskToRate && (
        <TaskRatingDialog
          open={ratingDialogOpen}
          onOpenChange={setRatingDialogOpen}
          onSubmit={handleSubmitRating}
          userName={taskToRate.accepter?.full_name || 'the helper'}
        />
      )}
    </div>
  );
};

export default Tasks;