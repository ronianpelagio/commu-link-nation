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
          <div className="animate-spin rounded-full h-12 w-12 border-t-4 border-b-4 border-[#2ec2b3] mx-auto"></div>
          <p className="mt-4 text-[#2ec2b3] font-semibold">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const navItems = [
    { icon: Home, label: 'Home', path: '/', active: true },
    { icon: ClipboardList, label: 'Tasks', path: '/tasks' },
    { icon: MessageCircle, label: 'Messages', path: '/messages' },
    { icon: Phone, label: 'Contact Barangay', path: '/direct-approach' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-teal-50 via-white to-cyan-50">
      {/* Top Navigation */}
      <header className="bg-white/95 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-[#2ec2b3]">
              Community Match
            </h1>

            {/* Top Right Nav */}
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

            {/* Mobile menu placeholder */}
            <div className="md:hidden">
              <Button variant="ghost" size="icon">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
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
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {/* Welcome Hero */}
        <div className="mb-6 sm:mb-10">
          <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 p-6 sm:p-8 md:p-12 overflow-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-r from-[#2ec2b3]/5 to-transparent pointer-events-none"></div>
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between gap-6 sm:gap-8">
              <div>
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-gray-900">
                  Welcome back,<br />
                  <span className="text-[#2ec2b3]">
                    {user?.user_metadata?.full_name || 'Friend'}
                  </span>!
                </h2>
                <p className="text-gray-600 text-base sm:text-lg mt-2 sm:mt-3">
                  Here's what's happening in your barangay today
                </p>
              </div>
              <div className="w-20 h-20 sm:w-24 sm:h-24 lg:w-28 lg:h-28 bg-[#2ec2b3] rounded-2xl sm:rounded-3xl flex items-center justify-center text-white text-4xl sm:text-5xl font-bold shadow-2xl overflow-hidden">
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
        <div className="bg-white rounded-2xl sm:rounded-3xl shadow-xl border border-gray-100 overflow-hidden">
          <div className="bg-[#2ec2b3] p-6 sm:p-8 text-white">
            <h3 className="text-2xl sm:text-3xl font-bold">Community Feed</h3>
            <p className="mt-2 opacity-90 text-base sm:text-lg">
              Latest tasks, announcements, and messages from your community
            </p>
          </div>
          <div className="p-4 sm:p-6 lg:p-8">
            <CommunityFeed />
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;