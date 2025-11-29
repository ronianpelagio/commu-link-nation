import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { 
  LogOut, 
  Home, 
  ClipboardList, 
  MessageCircle, 
  Phone, 
  User,
  Shield 
} from 'lucide-react';
import CommunityFeed from '@/components/dashboard/CommunityFeed';
import { SignOutDialog } from '@/components/SignOutDialog';
import { NotificationBell } from '@/components/NotificationBell';

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
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-teal-50 to-cyan-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-t-4 border-b-4 border-[#2ec2b3] mx-auto"></div>
          <p className="mt-3 text-[#2ec2b3] font-semibold text-sm">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { icon: Home, label: 'Home', path: '/dashboard', active: true },
    { icon: ClipboardList, label: 'Tasks', path: '/tasks' },
    ...(!isAdmin ? [
      { icon: MessageCircle, label: 'Messages', path: '/messages' },
      { icon: Phone, label: 'Contact', path: '/direct-approach' },
    ] : []),
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      {/* Top Navigation */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-12 sm:h-16">
            {/* Logo */}
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-[#2ec2b3] rounded-xl flex items-center justify-center">
                <Home className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
              </div>
              <h1 className="text-lg sm:text-2xl font-bold text-[#2ec2b3] hidden sm:block">
                Community Match
              </h1>
            </div>

            {/* Desktop Nav */}
            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Button
                  key={item.label}
                  variant={item.active ? "default" : "ghost"}
                  className={`px-4 py-2 rounded-xl font-medium transition-all ${
                    item.active
                      ? 'bg-[#2ec2b3] hover:bg-[#28b0a2] text-white shadow-lg'
                      : 'text-gray-700 hover:text-[#2ec2b3] hover:bg-teal-50'
                  }`}
                  onClick={() => item.path && navigate(item.path)}
                >
                  <item.icon className="h-4 w-4 mr-2" />
                  {item.label}
                </Button>
              ))}

              {isAdmin && (
                <Button
                  variant="outline"
                  className="ml-2 border-[#2ec2b3] text-[#2ec2b3] hover:bg-teal-50"
                  onClick={() => navigate('/admin')}
                >
                  <Shield className="h-4 w-4 mr-2" />
                  Admin
                </Button>
              )}

              <NotificationBell />

              <Button
                variant="ghost"
                size="icon"
                className="ml-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors"
                onClick={() => setShowSignOutDialog(true)}
              >
                <LogOut className="h-5 w-5" />
              </Button>
            </nav>

            {/* Mobile Nav - Icon Only */}
            <div className="md:hidden flex items-center gap-1">
              <NotificationBell />
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setShowSignOutDialog(true)}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50 shadow-[0_-2px_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-around py-1 pb-[env(safe-area-inset-bottom)]">
          {navItems.map((item) => (
            <button
              key={item.label}
              className={`flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[60px] ${
                item.active ? 'text-[#2ec2b3]' : 'text-gray-500'
              }`}
              onClick={() => item.path && navigate(item.path)}
            >
              <item.icon className={`h-5 w-5 ${item.active ? 'stroke-[2.5px]' : ''}`} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
          {isAdmin && (
            <button
              className="flex flex-col items-center justify-center gap-0.5 py-2 px-3 min-w-[60px] text-gray-500"
              onClick={() => navigate('/admin')}
            >
              <Shield className="h-5 w-5" />
              <span className="text-[10px] font-medium">Admin</span>
            </button>
          )}
        </div>
      </nav>

      <SignOutDialog
        open={showSignOutDialog}
        onOpenChange={setShowSignOutDialog}
        onConfirm={() => signOut(true)}
      />

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8 pb-20 md:pb-8">
        {/* Welcome Hero */}
        <div className="mb-4 sm:mb-8">
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-4 sm:p-6 md:p-10 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#2ec2b3]/5 to-transparent pointer-events-none"></div>
            <div className="relative flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900 truncate">
                  Welcome back,
                </h2>
                <p className="text-lg sm:text-xl lg:text-2xl font-bold text-[#2ec2b3] truncate">
                  {user?.user_metadata?.full_name || 'Friend'}!
                </p>
                <p className="text-gray-500 text-sm sm:text-base mt-1 hidden sm:block">
                  Here's what's happening in your barangay today
                </p>
              </div>
              <div className="w-14 h-14 sm:w-20 sm:h-20 lg:w-24 lg:h-24 bg-[#2ec2b3] rounded-2xl flex items-center justify-center text-white text-2xl sm:text-4xl font-bold shadow-lg overflow-hidden flex-shrink-0">
                {user?.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="Profile" className="w-full h-full object-cover" />
                ) : (
                  user?.user_metadata?.full_name?.[0] || 'U'
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Community Feed */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="bg-[#2ec2b3] p-4 sm:p-6 text-white">
            <h3 className="text-lg sm:text-2xl font-bold">Community Feed</h3>
            <p className="mt-1 opacity-90 text-sm sm:text-base">
              Latest from your community
            </p>
          </div>
          <div className="p-3 sm:p-5 lg:p-6">
            <CommunityFeed />
          </div>
        </div>
      </main>

      <SignOutDialog
        open={showSignOutDialog}
        onOpenChange={setShowSignOutDialog}
        onConfirm={() => signOut(true)}
      />
    </div>
  );
};

export default Dashboard;