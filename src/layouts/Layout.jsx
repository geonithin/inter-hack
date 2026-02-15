import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Bell, User, LogOut, Menu, X, UserPlus, ChevronLeft, ChevronDown, Home, FileText, BookOpen, Mail, Settings, AlertCircle } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { cn } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';
import NotificationCenter from '../components/NotificationCenter';
import { supabase } from '../lib/supabase';

export default function Layout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [teamName, setTeamName] = useState('Loading...');
    const [isScrolled, setIsScrolled] = useState(false);
    
    // Notification state
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    
    const userMenuRef = useRef(null);
    const location = useLocation();
    const navigate = useNavigate();
    
    // Use auth context instead of localStorage
    const { isAuthenticated, getUserRole, profile, user, signOut } = useAuth();

    // Handle click outside to close user menu
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setIsUserMenuOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Handle scroll effect for navbar - throttled for performance
    useEffect(() => {
        let ticking = false;
        const handleScroll = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    setIsScrolled(window.scrollY > 20);
                    ticking = false;
                });
                ticking = true;
            }
        };

        window.addEventListener('scroll', handleScroll, { passive: true });
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Fetch team name for authenticated team leads
    useEffect(() => {
        const fetchTeamName = async () => {
            if (isAuthenticated() && getUserRole() === 'lead' && user) {
                try {
                    const { supabase } = await import('../lib/supabase');
                    
                    // Add slight delay to ensure auth context is fully loaded
                    await new Promise(resolve => setTimeout(resolve, 100));
                    
                    const { data: team, error } = await supabase
                        .from('teams')
                        .select('name')
                        .eq('lead_id', user.id)
                        .maybeSingle(); // Use maybeSingle instead of single to handle no results gracefully
                        
                    if (error) {
                        console.error('Error fetching team:', error);
                        return;
                    }
                    
                    if (team) {
                        setTeamName(team.name);
                    } else {
                        setTeamName('Team Lead'); // Fallback if no team found
                    }
                } catch (error) {
                    console.error('Error fetching team name:', error);
                    setTeamName('Team Lead'); // Fallback on error
                }
            }
        };
        
        fetchTeamName();
    }, [isAuthenticated, getUserRole, user, location.pathname]); // Re-fetch when auth state or page changes

    // Fetch notifications and unread count - for all authenticated users
    useEffect(() => {
        const fetchNotifications = async () => {
            if (!isAuthenticated() || !user?.id) return;
            
            try {
                console.log('Layout: Fetching notifications for user:', user.id);
                const { data, error } = await supabase
                    .from('notifications')
                    .select('*')
                    .eq('recipient_id', user.id)
                    .order('created_at', { ascending: false })
                    .limit(10); // Only fetch recent notifications for header count

                if (error) {
                    console.error('Layout: Error fetching notifications:', error);
                    // Don't return early - set count to 0 but don't break the UI
                    setNotifications([]);
                    setUnreadCount(0);
                    return;
                }

                console.log('Layout: Successfully fetched notifications:', data);
                setNotifications(data || []);
                
                // Count unread notifications
                const unread = (data || []).filter(n => !n.is_read).length;
                console.log('Layout: Unread count:', unread);
                setUnreadCount(unread);
            } catch (error) {
                console.error('Layout: Error in fetchNotifications:', error);
                setNotifications([]);
                setUnreadCount(0);
            }
        };

        fetchNotifications();

        // Use simple polling instead of WebSocket to avoid connection issues
        const interval = setInterval(fetchNotifications, 15000); // Every 15 seconds

        return () => {
            clearInterval(interval);
        };
    }, [isAuthenticated, user?.id]);

    // Dashboard access handler using auth context
    const handleDashboardAccess = () => {
        if (isAuthenticated()) {
            const role = getUserRole();
            if (role === 'faculty' || role === 'admin') {
                navigate('/faculty');
            } else {
                navigate('/dashboard');
            }
        } else {
            navigate('/login');
        }
    };

    // Handle logout
    const handleLogout = async () => {
        console.log('Logout clicked');
        
        // Close menus immediately
        setIsUserMenuOpen(false);
        setIsMobileMenuOpen(false);
        
        try {
            console.log('Calling signOut...');
            const result = await signOut();
            console.log('SignOut result:', result);
            
            // Wait a bit longer to ensure auth state is fully cleared
            setTimeout(() => {
                console.log('Navigating to home after logout');
                navigate('/', { replace: true });
            }, 200);
            
        } catch (error) {
            console.error('Logout error:', error);
            // Still navigate away even if logout fails
            navigate('/', { replace: true });
        }
    };

    const isStrictAuthPage = ['/login', '/register'].includes(location.pathname);
    const isLoggedIn = isAuthenticated();
    const userRole = getUserRole();

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header - Now Global */}
            <header className={cn(
                "bg-white text-oxford sticky top-0 z-50 transition-all duration-150",
                isScrolled ? "shadow-lg backdrop-blur-xl bg-white/70" : "shadow-sm bg-white/90 backdrop-blur-sm"
            )}>
                <div className="px-4 sm:px-6 max-w-none w-full h-12 sm:h-16 flex items-center justify-between">
                    <div className="flex items-center shrink-0">
                        <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group" onClick={() => navigate('/')}>
                            <div className="p-1 sm:p-1 bg-white rounded-lg border-2 border-white flex items-center justify-center">
                                <img src="/clg-logo.png" alt="Logo" className="w-4 h-4 sm:w-10 sm:h-10 object-contain" />
                            </div>
                            <div className="space-y-0.5">
                                <h1 className="text-sm sm:text-xl font-black tracking-tighter uppercase leading-none">INNOTECH CHALLANGE'26</h1>
                                <p className="text-[6px] sm:text-[8px] font-black uppercase opacity-40 tracking-[0.2em]">Stella Mary's College of Engineering</p>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Nav - Hidden on Auth Pages to keep focus */}
                    {!isStrictAuthPage && (
                        <div className="hidden lg:flex items-center justify-end flex-1 space-x-6">
                            <nav className="flex items-center space-x-6">
                                <button onClick={() => { navigate('/', { replace: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); }} className="hover:text-oxford-light transition-all font-black uppercase text-xs tracking-widest border-b-2 border-transparent hover:border-oxford pb-0.5 whitespace-nowrap">Home</button>
                                <button onClick={() => { navigate('/'); setTimeout(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="hover:text-oxford-light transition-all font-black uppercase text-xs tracking-widest border-b-2 border-transparent hover:border-oxford pb-0.5 whitespace-nowrap">Contact</button>
                                <button onClick={handleDashboardAccess} className="hover:text-oxford-light transition-all font-black uppercase text-xs tracking-widest border-b-2 border-transparent hover:border-oxford pb-0.5 whitespace-nowrap">
                                    Dashboard
                                </button>
                            </nav>

                            {/* User Profile Menu - Right Side */}
                            {isLoggedIn && (
                                <div className="flex items-center border-l-2 border-oxford/10 pl-3 animate-in fade-in slide-in-from-right-4 duration-500">
                                    {/* User Profile Dropdown */}
                                    <div className="relative" ref={userMenuRef}>
                                        <button
                                            onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                            className="relative flex items-center space-x-2 px-2 py-2 hover:bg-oxford/5 rounded-2xl transition-all border-2 border-transparent hover:border-oxford/20 mr-0"
                                        >
                                            <div className="p-1.5 bg-oxford text-white rounded-xl">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <ChevronDown className={cn("w-4 h-4 transition-transform", isUserMenuOpen && "rotate-180")} />
                                            {/* Notification Badge - For all users */}
                                            {unreadCount > 0 && (
                                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border-2 border-white shadow-md">
                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                </span>
                                            )}
                                        </button>

                                        {isUserMenuOpen && (
                                            <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-lg hover:shadow-xl border-2 border-transparent hover:border-oxford/20 py-2 z-50 animate-in zoom-in-95 slide-in-from-top-2 duration-200 transition-all">
                                                {/* User Profile Info */}
                                                <div className="px-4 py-3 border-b border-oxford/10">
                                                    <div className="flex items-center space-x-3">
                                                        <div className="p-2 bg-oxford text-white rounded-xl">
                                                            <User className="w-5 h-5" />
                                                        </div>
                                                        <div className="text-left">
                                                            <p className="text-[8px] font-black leading-none uppercase opacity-50 tracking-[0.2em] mb-1">
                                                                {userRole === 'faculty' ? 'Selection Committee' : 'Team Lead'}
                                                            </p>
                                                            <p className="text-sm font-black uppercase tracking-tight">
                                                                {userRole === 'faculty' ? (profile?.full_name || 'Dr. Robert Wilson') : teamName}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Menu Options */}
                                                {/* Notifications - For all users */}
                                                {
                                                    <button 
                                                        onClick={() => { setIsNotificationsOpen(true); setIsUserMenuOpen(false); }} 
                                                        className="w-full text-left px-4 py-2.5 hover:bg-oxford/5 text-oxford font-black uppercase text-xs tracking-widest transition-all flex items-center justify-between"
                                                    >
                                                        <span>Notifications</span>
                                                        {unreadCount > 0 && (
                                                            <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full">
                                                                {unreadCount > 99 ? '99+' : unreadCount}
                                                            </span>
                                                        )}
                                                    </button>
                                                }

                                                {/* Logout */}
                                                <div className="border-t border-oxford/10 my-1"></div>
                                                <button 
                                                    onClick={handleLogout} 
                                                    className="w-full text-left px-4 py-2.5 hover:bg-red-50 text-red-600 font-black uppercase text-xs tracking-widest transition-all flex items-center gap-2"
                                                >
                                                    <LogOut className="w-4 h-4" />
                                                    Sign Out
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Mobile Menu Toggle - Always Available Everywhere */}
                    <button className="lg:hidden relative p-1.5 sm:p-2 rounded-lg sm:rounded-xl bg-gray-50 text-oxford active:scale-95 transition-all border border-gray-100" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                        {isMobileMenuOpen ? <X className="w-5 h-5 sm:w-6 sm:h-6" /> : <Menu className="w-5 h-5 sm:w-6 sm:h-6" />}
                        {/* Notification Badge - Show on mobile menu button */}
                        {isLoggedIn && unreadCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border-2 border-white shadow-md">
                                {unreadCount > 99 ? '99+' : unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* Notification Center - For all authenticated users */}
            {isLoggedIn && (
                <NotificationCenter
                    isOpen={isNotificationsOpen}
                    onClose={() => setIsNotificationsOpen(false)}
                    notifications={notifications}
                    unreadCount={unreadCount}
                    onNotificationUpdate={(updatedNotifications, newUnreadCount) => {
                        setNotifications(updatedNotifications);
                        setUnreadCount(newUnreadCount);
                    }}
                />
            )}

            {/* Mobile Menu - Side Drawer Implementation */}
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-60">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 backdrop-blur-xl animate-in fade-in duration-150"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    {/* Enhanced Compact Mobile Menu Card */}
                    <div className="absolute top-4 right-4 w-[75%] max-w-60 bg-linear-to-br from-slate-100 to-slate-50 backdrop-blur-sm p-4 rounded-2xl flex flex-col shadow-lg hover:shadow-2xl animate-in zoom-in-95 slide-in-from-top-2 duration-300 border-2 border-transparent hover:border-gray-300 transition-all">
                        {/* Compact Header */}
                        <div className="flex justify-between items-center mb-4 pb-2 border-b border-gray-200">
                            <p className="text-gray-800 font-bold text-sm">Menu</p>
                            <button className="p-1.5 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-700 active:scale-95 transition-all" onClick={() => setIsMobileMenuOpen(false)}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        
                        {/* Compact Navigation Items */}
                        <nav className="space-y-1 mb-4">
                            <button
                                onClick={() => { navigate('/', { replace: true }); window.scrollTo({ top: 0, behavior: 'smooth' }); setIsMobileMenuOpen(false); }}
                                className={`w-full text-left p-2.5 rounded-xl transition-all duration-200 flex items-center gap-3 group shadow-sm ${
                                    location.pathname === '/' 
                                        ? 'bg-oxford text-white hover:bg-oxford/90' 
                                        : 'bg-white/70 hover:bg-white text-gray-800'
                                }`}
                            >
                                <div className={`p-1.5 rounded-lg group-hover:bg-gray-200 transition-colors ${
                                    location.pathname === '/' ? 'bg-white/20 group-hover:bg-white/30' : 'bg-gray-100'
                                }`}>
                                    <Home className="w-4 h-4" />
                                </div>
                                <p className="font-medium text-sm">Home</p>
                            </button>
                            
                            <button
                                onClick={() => { navigate('/'); setTimeout(() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' }), 100); setIsMobileMenuOpen(false); }}
                                className="w-full text-left p-2.5 rounded-xl bg-white/70 hover:bg-white text-gray-800 transition-all duration-200 flex items-center gap-3 group"
                            >
                                <div className="p-1.5 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                                    <Mail className="w-4 h-4" />
                                </div>
                                <p className="font-medium text-sm">Contact</p>
                            </button>

                            {/* Dynamic Menu Items based on Auth State */}
                            {isLoggedIn ? (
<>
                                    {/* Dashboard Button */}
                                    <button
                                        onClick={() => { handleDashboardAccess(); setIsMobileMenuOpen(false); }}
                                        className={`w-full text-left p-2.5 rounded-xl transition-all duration-200 flex items-center gap-3 group shadow-sm ${
                                            location.pathname === '/dashboard' || location.pathname === '/faculty'
                                                ? 'bg-oxford text-white hover:bg-oxford/90' 
                                                : 'bg-white/70 hover:bg-white text-gray-800'
                                        }`}
                                    >
                                        <div className={`p-1.5 rounded-lg group-hover:bg-gray-200 transition-colors ${
                                            location.pathname === '/dashboard' || location.pathname === '/faculty'
                                                ? 'bg-white/20 group-hover:bg-white/30' 
                                                : 'bg-gray-100'
                                        }`}>
                                            <FileText className="w-4 h-4" />
                                        </div>
                                        <p className="font-medium text-sm">Dashboard</p>
                                    </button>
                                    
                                    {/* Notifications - For all users */}
                                    {
                                        <button
                                            onClick={() => { setIsNotificationsOpen(true); setIsMobileMenuOpen(false); }}
                                            className="w-full text-left p-2.5 rounded-xl bg-white/70 hover:bg-white text-gray-800 transition-all duration-200 flex items-center justify-between group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className="p-1.5 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors relative">
                                                    <Bell className="w-4 h-4" />
                                                    {unreadCount > 0 && (
                                                        <span className="absolute -top-0.5 -right-0.5 bg-red-500 text-white text-xs font-bold px-1 py-0.5 rounded-full border border-slate-100">
                                                            {unreadCount > 99 ? '99+' : unreadCount}
                                                        </span>
                                                    )}
                                                </div>
                                                <p className="font-medium text-sm">Notifications</p>
                                            </div>
                                            {unreadCount > 0 && (
                                                <div className="bg-red-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">
                                                    {unreadCount > 99 ? '99+' : unreadCount}
                                                </div>
                                            )}
                                        </button>
                                    }
                                </>
                            ) : (
                                <>
                                    <div className="border-t border-gray-200 pt-2 mt-2">
                                        <button
                                            onClick={() => { navigate('/login'); setIsMobileMenuOpen(false); }}
                                            className="w-full text-left p-2.5 rounded-xl bg-white/70 hover:bg-white text-gray-800 transition-all duration-200 flex items-center gap-3 group"
                                        >
                                            <div className="p-1.5 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                                                <User className="w-4 h-4" />
                                            </div>
                                            <p className="font-medium text-sm">Sign In</p>
                                        </button>
                                    </div>
                                    
                                    <button
                                        onClick={() => { navigate('/register'); setIsMobileMenuOpen(false); }}
                                        className="w-full text-left p-2.5 rounded-xl bg-white/70 hover:bg-white text-gray-800 transition-all duration-200 flex items-center gap-3 group"
                                    >
                                        <div className="p-1.5 bg-gray-100 rounded-lg group-hover:bg-gray-200 transition-colors">
                                            <UserPlus className="w-4 h-4" />
                                        </div>
                                        <p className="font-medium text-sm">Register</p>
                                    </button>
                                </>
                            )}
                        </nav>

                        {/* Compact User Profile Section */}
                        {isLoggedIn && (
                            <div className="border-t border-gray-200 pt-3">
                                <div className="flex items-center gap-3 mb-3 p-2.5 bg-white/50 rounded-xl">
                                    <div className="p-1.5 bg-gray-100 rounded-lg">
                                        <User className="w-4 h-4 text-gray-700" />
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-gray-500 text-xs font-medium uppercase tracking-wider">
                                            {userRole === 'faculty' ? 'Committee' : 'Team Lead'}
                                        </p>
                                        <p className="text-gray-800 text-xs font-bold truncate">
                                            {userRole === 'faculty' ? (profile?.full_name || 'Dr. Robert Wilson') : teamName}
                                        </p>
                                    </div>
                                </div>
                                
                                <button
                                    onClick={handleLogout}
                                    className="w-full py-2.5 bg-oxford hover:bg-oxford/90 text-white rounded-xl font-medium text-sm flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all duration-200"
                                >
                                    <LogOut className="w-4 h-4" />
                                    Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Global Sub-Header Back Icon Bar */}
            {location.pathname !== '/' && (
                <div className="container-wide pt-2 sm:pt-3 animate-in fade-in slide-in-from-left-4 duration-200">
                    <button
                        onClick={() => {
                            // Navigate to previous page in history
                            navigate(-1);
                        }}
                        className="p-2 sm:p-3 bg-oxford/5 rounded-xl sm:rounded-2xl text-oxford/40 hover:text-oxford hover:bg-oxford/10 transition-all active:scale-90 group inline-flex items-center justify-center shadow-sm border border-oxford/5"
                        title="Go Back"
                    >
                        <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6 group-hover:-translate-x-1 transition-transform" />
                    </button>
                </div>
            )}

            {/* Main Content with Responsive Spacer */}
            <main className={cn("flex-1 container-wide py-4 sm:py-8", isStrictAuthPage && "flex items-center justify-center")}>
                <Outlet />
            </main>

            {/* Footer - Hidden on Auth Pages to keep focus */}
            {!isStrictAuthPage && (
                <footer className="bg-oxford text-white py-3 mt-8">
                    <div className="container-wide">
                        <div className="flex items-center justify-center">
                            <p className="text-xs font-medium text-white/60">© 2026 SMCE Hackathon. All Rights Reserved.</p>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
}
