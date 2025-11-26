import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, Home, ClipboardList, MessageCircle, Phone } from 'lucide-react';
import CommunityFeed from '@/components/dashboard/CommunityFeed';
import { SignOutDialog } from '@/components/SignOutDialog';

const Dashboard = () => {
  const { user, isAdmin, loading, signOut } = useAuth();
  const navigate = useNavigate();
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);

  useEffect(() => {
    if (!loading && !user) {
      navigate('/auth');
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>Loading...</p>
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="min-h-screen bg-gradient-subtle">
      {/* Navigation Header */}
      <header className="bg-background border-b shadow-soft sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              Barangay Connect
            </h1>
            <div className="flex items-center gap-4">
              {isAdmin && (
                <Button variant="outline" onClick={() => navigate('/admin')}>
                  Admin Panel
                </Button>
              )}
              <Button variant="outline" size="icon" onClick={() => setShowSignOutDialog(true)}>
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      <SignOutDialog
        open={showSignOutDialog}
        onOpenChange={setShowSignOutDialog}
        onConfirm={() => signOut(true)}
      />

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid lg:grid-cols-4 gap-6">
          {/* Sidebar Navigation */}
          <aside className="lg:col-span-1 space-y-2">
            <Button variant="secondary" className="w-full justify-start" size="lg">
              <Home className="mr-2 h-5 w-5" />
              Home
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              size="lg"
              onClick={() => navigate('/tasks')}
            >
              <ClipboardList className="mr-2 h-5 w-5" />
              Task Board
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              size="lg"
              onClick={() => navigate('/messages')}
            >
              <MessageCircle className="mr-2 h-5 w-5" />
              Messages
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              size="lg"
              onClick={() => navigate('/direct-approach')}
            >
              <Phone className="mr-2 h-5 w-5" />
              Contact Barangay
            </Button>
            <Button
              variant="ghost"
              className="w-full justify-start"
              size="lg"
              onClick={() => navigate('/profile')}
            >
              Profile
            </Button>
          </aside>

          {/* Main Feed */}
          <main className="lg:col-span-3">
            <CommunityFeed />
          </main>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
