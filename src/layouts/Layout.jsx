import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { Bell, User, LogOut, Menu, X, UserPlus, ChevronLeft } from 'lucide-react';
import { useState, useEffect } from 'react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import NotificationCenter from '../components/NotificationCenter';

export default function Layout() {
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isNotificationsOpen, setIsNotificationsOpen] = useState(false);
    const [teamName, setTeamName] = useState('Loading...');
    const [isScrolled, setIsScrolled] = useState(false);
    const location = useLocation();
    const navigate = useNavigate();

    // Handle scroll effect for navbar
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };

        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    // Fetch team name for logged in users
    useEffect(() => {
        const fetchTeamName = async () => {
            const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
            const userRole = localStorage.getItem('userRole');
            
            if (isLoggedIn && userRole === 'lead') {
                try {
                    const { data: { user } } = await supabase.auth.getUser();
                    if (user) {
                        const { data: team, error } = await supabase
                            .from('teams')
                            .select('name')
                            .eq('lead_id', user.id)
                            .single();
                            
                        if (team && !error) {
                            setTeamName(team.name);
                        } else {
                            setTeamName('Team Lead'); // Fallback if no team found
                        }
                    }
                } catch (error) {
                    console.error('Error fetching team name:', error);
                    setTeamName('Team Lead'); // Fallback on error
                }
            }
        };
        
        fetchTeamName();
    }, [location.pathname]); // Re-fetch when page changes

    // Simulated Authentication Guard
    const handleDashboardAccess = () => {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        const userRole = localStorage.getItem('userRole');

        if (isLoggedIn) {
            if (userRole === 'faculty') {
                navigate('/faculty');
            } else {
                navigate('/dashboard');
            }
        } else {
            navigate('/login');
        }
    };

    const isStrictAuthPage = ['/login', '/register'].includes(location.pathname);
    const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
    const userRole = localStorage.getItem('userRole');

    return (
        <div className="min-h-screen bg-white flex flex-col">
            {/* Header - Now Global */}
            <header className={cn(
                "bg-white text-oxford sticky top-0 z-50 transition-all duration-300",
                isScrolled ? "shadow-lg backdrop-blur-xl bg-white/70" : "shadow-sm bg-white/90 backdrop-blur-sm"
            )}>
                <div className="container-wide h-12 sm:h-16 flex items-center justify-between">
                    <div className="flex items-center">
                        <div className="flex items-center space-x-2 sm:space-x-3 cursor-pointer group" onClick={() => navigate('/')}>
                            <div className="p-1 sm:p-1.5 bg-white rounded-lg shadow-lg border-2 border-oxford flex items-center justify-center">
                                <img src="/clg-logo.png" alt="Logo" className="w-6 h-6 sm:w-10 sm:h-10 object-contain" />
                            </div>
                            <div className="space-y-0.5">
                                <h1 className="text-sm sm:text-xl font-black tracking-tighter uppercase leading-none">SMCE HACKATHON</h1>
                                <p className="text-[6px] sm:text-[8px] font-black uppercase opacity-40 tracking-[0.2em]">Stella Mary's College of Engineering</p>
                            </div>
                        </div>
                    </div>

                    {/* Desktop Nav - Hidden on Auth Pages to keep focus */}
                    {!isStrictAuthPage && (
                        <nav className="hidden lg:flex items-center space-x-8 h-full">
                            <button onClick={() => navigate('/')} className="hover:text-oxford-light transition-all font-black uppercase text-xs tracking-widest border-b-2 border-transparent hover:border-oxford pb-0.5 whitespace-nowrap">Home</button>
                            <button onClick={() => { navigate('/'); setTimeout(() => document.getElementById('rules')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="hover:text-oxford-light transition-all font-black uppercase text-xs tracking-widest border-b-2 border-transparent hover:border-oxford pb-0.5 whitespace-nowrap">Rules</button>
                            <button onClick={() => { navigate('/'); setTimeout(() => document.getElementById('guidelines')?.scrollIntoView({ behavior: 'smooth' }), 100); }} className="hover:text-oxford-light transition-all font-black uppercase text-xs tracking-widest border-b-2 border-transparent hover:border-oxford pb-0.5 whitespace-nowrap">Guidelines</button>
                            <button onClick={handleDashboardAccess} className="hover:text-oxford-light transition-all font-black uppercase text-xs tracking-widest border-b-2 border-transparent hover:border-oxford pb-0.5 whitespace-nowrap">
                                {userRole === 'faculty' ? 'Faculty Portal' : 'Dashboard'}
                            </button>

                            {/* Conditioned Dashboard Info & Logout */}
                            {isLoggedIn && (
                                <div className="flex items-center space-x-4 border-l-2 border-oxford/10 pl-6 animate-in fade-in slide-in-from-right-4 duration-500">
                                    <button
                                        onClick={() => setIsNotificationsOpen(true)}
                                        className="relative p-2.5 hover:bg-oxford/5 rounded-2xl transition-all group"
                                    >
                                        <Bell className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                                        <span className="absolute top-1.5 right-1.5 bg-oxford text-white text-[8px] font-black px-1.5 py-0.5 rounded-full border-2 border-white shadow-md">3</span>
                                    </button>

                                    <div className="flex items-center space-x-3 px-3 py-1.5 bg-oxford/5 rounded-2xl border-2 border-transparent hover:border-oxford/20 transition-all cursor-pointer">
                                        <div className="text-right">
                                            <p className="text-[8px] font-black leading-none uppercase opacity-50 tracking-[0.2em] mb-1">
                                                {userRole === 'faculty' ? 'Selection Committee' : 'Team Lead'}
                                            </p>
                                            <p className="text-xs font-black uppercase tracking-tight">
                                                {userRole === 'faculty' ? 'Dr. Robert Wilson' : teamName}
                                            </p>
                                        </div>
                                        <div className="p-1.5 bg-oxford text-white rounded-xl">
                                            <User className="w-4 h-4" />
                                        </div>
                                    </div>

                                    <button onClick={() => { localStorage.removeItem('isLoggedIn'); localStorage.removeItem('userRole'); navigate('/'); }} className="p-2.5 hover:bg-red-50 text-red-600 rounded-2xl transition-all group" title="Logout">
                                        <LogOut className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                                    </button>
                                </div>
                            )}
                        </nav>
                    )}

                    {/* Mobile Menu Toggle - Always Available Everywhere */}
                    <button className="lg:hidden p-2 sm:p-4 rounded-xl sm:rounded-2xl bg-gray-50 text-oxford active:scale-95 transition-all border border-gray-100" onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}>
                        {isMobileMenuOpen ? <X className="w-6 h-6 sm:w-8 sm:h-8" /> : <Menu className="w-6 h-6 sm:w-8 sm:h-8" />}
                    </button>
                </div>
            </header>

            {/* Notifications Overlay */}
            <NotificationCenter
                isOpen={isNotificationsOpen}
                onClose={() => setIsNotificationsOpen(false)}
            />

            {/* Mobile Menu - Side Drawer Implementation */}
            {isMobileMenuOpen && (
                <div className="lg:hidden fixed inset-0 z-[60]">
                    {/* Backdrop */}
                    <div
                        className="absolute inset-0 backdrop-blur-xl animate-in fade-in duration-300"
                        onClick={() => setIsMobileMenuOpen(false)}
                    />
                    {/* Floating Mini Menu Card */}
                    <div className="absolute top-4 right-4 w-[80%] max-w-[260px] bg-oxford p-4 rounded-[2rem] flex flex-col shadow-2xl animate-in zoom-in-95 slide-in-from-top-2 duration-300 border-2 border-white/10">
                        <div className="flex justify-between items-center mb-6 pb-3 border-b border-white/5">
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em]">Menu</p>
                            <button className="p-2 rounded-xl bg-white/5 text-white active:scale-95 transition-all" onClick={() => setIsMobileMenuOpen(false)}>
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                        <nav className="space-y-2">
                            <button
                                onClick={() => { navigate('/'); setIsMobileMenuOpen(false); }}
                                className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-white font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3"
                            >
                                <div className="w-1 h-1 bg-white/20 rounded-full" />
                                Home
                            </button>

                            {/* Dynamic Menu Items based on Auth State */}
                            {isLoggedIn ? (
                                <>
                                    <button
                                        onClick={() => { handleDashboardAccess(); setIsMobileMenuOpen(false); }}
                                        className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-white font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3"
                                    >
                                        <div className="w-1 h-1 bg-white/20 rounded-full" />
                                        {userRole === 'faculty' ? 'Faculty Portal' : 'Dashboard'}
                                    </button>
                                    <button
                                        onClick={() => { setIsNotificationsOpen(true); setIsMobileMenuOpen(false); }}
                                        className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-white font-black uppercase tracking-widest text-xs transition-all flex items-center justify-between"
                                    >
                                        <div className="flex items-center gap-3">
                                            <div className="w-1 h-1 bg-white/20 rounded-full" />
                                            Alerts
                                        </div>
                                        <span className="bg-white text-oxford text-[9px] font-black px-1.5 py-0.5 rounded-full">3</span>
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => { navigate('/login'); setIsMobileMenuOpen(false); }}
                                        className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-white font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3"
                                    >
                                        <div className="w-1 h-1 bg-white/20 rounded-full" />
                                        Sign In
                                    </button>
                                    <button
                                        onClick={() => { navigate('/register'); setIsMobileMenuOpen(false); }}
                                        className="w-full text-left py-2.5 px-3 rounded-xl hover:bg-white/5 text-white font-black uppercase tracking-widest text-xs transition-all flex items-center gap-3"
                                    >
                                        <div className="w-1 h-1 bg-white/20 rounded-full" />
                                        Register
                                    </button>
                                </>
                            )}
                        </nav>

                        {isLoggedIn && (
                            <div className="mt-6 pt-4 border-t border-white/5 flex flex-col gap-3">
                                <div className="flex items-center space-x-2 text-white px-1">
                                    <div className="p-2 bg-white/5 rounded-lg">
                                        <User className="w-4 h-4 text-white/40" />
                                    </div>
                                    <div className="text-left overflow-hidden">
                                        <p className="text-[7px] font-black uppercase opacity-30 tracking-[0.2em] leading-none mb-0.5">
                                            {userRole === 'faculty' ? 'Selection Committee' : 'Team Lead'}
                                        </p>
                                        <p className="text-xs font-black uppercase tracking-tight truncate">
                                            {userRole === 'faculty' ? 'Dr. Robert Wilson' : teamName}
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => { localStorage.removeItem('isLoggedIn'); localStorage.removeItem('userRole'); navigate('/'); setIsMobileMenuOpen(false); }}
                                    className="w-full py-2.5 bg-red-500/90 text-white rounded-lg font-black uppercase tracking-widest text-[9px] flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all hover:bg-red-600"
                                >
                                    <LogOut className="w-3.5 h-3.5" /> Sign Out
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            )}
            {/* Global Sub-Header Back Icon Bar */}
            {location.pathname !== '/' && (
                <div className="container-wide pt-2 sm:pt-3 animate-in fade-in slide-in-from-left-4 duration-500">
                    <button
                        onClick={() => navigate('/')}
                        className="p-2 sm:p-3 bg-oxford/5 rounded-xl sm:rounded-2xl text-oxford/40 hover:text-oxford hover:bg-oxford/10 transition-all active:scale-90 group inline-flex items-center justify-center shadow-sm border border-oxford/5"
                        title="Back to Home"
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
                <footer className="bg-oxford text-white pt-6 pb-4 mt-6">
                    <div className="container-wide">
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-6 pb-6 border-b border-white/10">
                            <div className="col-span-1 md:col-span-2 space-y-4">
                                <div className="flex items-center space-x-3">
                                    <div className="p-1.5 bg-white rounded-lg">
                                        <img src="/clg-logo.png" alt="Logo" className="w-10 h-10 object-contain" />
                                    </div>
                                    <h2 className="text-2xl font-black tracking-tighter uppercase leading-none">SMCE HACKATHON</h2>
                                </div>
                                <p className="text-white/40 text-sm max-w-sm uppercase font-bold leading-relaxed">
                                    Pioneering the next generation of innovators at Stella Mary's College of Engineering. Join us for a weekend of intense building.
                                </p>
                            </div>
                            <div>
                                <h3 className="font-black uppercase tracking-widest text-xs text-white/40 mb-4">Navigation</h3>
                                <div className="flex flex-col space-y-3">
                                    <button onClick={() => navigate('/')} className="text-sm font-black uppercase tracking-wider text-left hover:text-white/60 transition-all">Home</button>
                                    <button onClick={handleDashboardAccess} className="text-sm font-black uppercase tracking-wider text-left hover:text-white/60 transition-all">Portal</button>
                                </div>
                            </div>
                            <div>
                                <h3 className="font-black uppercase tracking-widest text-xs text-white/40 mb-4">Connect</h3>
                                <div className="flex flex-col space-y-3">
                                    <a href="#" className="text-sm font-black uppercase tracking-wider hover:text-white/60 transition-all">Instagram</a>
                                    <a href="#" className="text-sm font-black uppercase tracking-wider hover:text-white/60 transition-all">LinkedIn</a>
                                </div>
                            </div>
                        </div>
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <p className="text-[10px] font-black uppercase opacity-30 tracking-[0.3em]">© 2024 SMCE HACKATHON. ALL RIGHTS RESERVED.</p>
                            <div className="flex items-center space-x-6">
                                <div className="px-3 py-1 bg-white/5 rounded-full border border-white/10 flex items-center space-x-2">
                                    <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                                    <span className="text-[9px] font-black uppercase tracking-widest opacity-60">System Ready</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </footer>
            )}
        </div>
    );
}
