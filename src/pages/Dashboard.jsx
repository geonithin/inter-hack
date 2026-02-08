import { useState, useEffect } from 'react';
import { Search, Filter, Lock, Clock, Users, ChevronRight, ChevronDown, CheckCircle, AlertCircle, X, XCircle, AlertTriangle, CheckCircle2, Bell } from 'lucide-react';
import { cn } from '../lib/utils';
import SubmissionForm from '../components/SubmissionForm';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function Dashboard() {
    const { user, isAuthenticated } = useAuth();
    const [team, setTeam] = useState(null);
    const [problemStatements, setProblemStatements] = useState([]);
    const [selectedStatement, setSelectedStatement] = useState(null);
    const [isConfirming, setIsConfirming] = useState(null);
    const [hasSelected, setHasSelected] = useState(false);
    const [filterDept, setFilterDept] = useState('All');
    const [isLoading, setIsLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null);
    
    // Notification system
    const [notification, setNotification] = useState(null);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [showNotifications, setShowNotifications] = useState(false);

    useEffect(() => {
        const loadDashboardData = async () => {
            // With protected routes, we can trust that user is authenticated
            if (!isAuthenticated() || !user) {
                return;
            }

            // Fetch problem statements
            const { data: statementsData, error: statementsError } = await supabase
                .from('problem_statements')
                .select('*')
                .eq('is_active', true)
                .order('title');

            if (statementsError) {
                console.error('Error fetching problem statements:', statementsError);
            } else {
                // Add team count for each statement
                const statementsWithCounts = await Promise.all(
                    statementsData.map(async (statement) => {
                        const { count } = await supabase
                            .from('teams')
                            .select('*', { count: 'exact', head: true })
                            .eq('selected_statement_id', statement.id);
                        
                        return {
                            ...statement,
                            teams: count || 0,
                            dept: statement.department
                        };
                    })
                );
                setProblemStatements(statementsWithCounts);
            }

            // Fetch team data
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .select('*')
                .eq('lead_id', user.id)
                .single();

            if (teamError) {
                console.error('Error fetching team:', teamError);
            } else {
                setTeam(teamData);
                if (teamData.selected_statement_id) {
                    // Find the selected statement from fetched data
                    const statement = statementsWithCounts?.find(s => s.id === teamData.selected_statement_id);
                    setSelectedStatement(statement);
                }
            }
            setIsLoading(false);
        };

        loadDashboardData();
        fetchNotifications();
    }, [isAuthenticated, user]);

    // Show notification toast
    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    // Fetch notifications
    const fetchNotifications = async () => {
        if (!user) return;
        
        try {
            console.log('Fetching notifications for user:', user.id);
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('recipient_id', user.id.toString())  // Convert to string
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('Error fetching notifications:', error);
                return;
            }

            console.log('Fetched notifications:', data);
            setNotifications(data || []);
            const unread = (data || []).filter(n => !n.is_read).length;
            setUnreadCount(unread);
            console.log('Unread count:', unread);
        } catch (error) {
            console.error('Error in fetchNotifications:', error);
        }
    };

    // Set up real-time notification subscription - simplified
    useEffect(() => {
        if (!user) return;

        console.log('Dashboard: Setting up simplified notification subscription');
        
        // Use polling instead of WebSocket to avoid connection issues
        const pollInterval = setInterval(() => {
            fetchNotifications();
        }, 5000); // Poll every 5 seconds

        return () => {
            clearInterval(pollInterval);
        };
    }, [user]);

    // Listen for global notification updates (when marked as read in other components)
    useEffect(() => {
        const handleNotificationUpdate = (event) => {
            console.log('Dashboard: Global notification update received:', event.detail);
            setUnreadCount(event.detail.unreadCount);
        };

        window.addEventListener('notificationUpdate', handleNotificationUpdate);
        
        return () => {
            window.removeEventListener('notificationUpdate', handleNotificationUpdate);
        };
    }, []);

    const filteredStatements = filterDept === 'All'
        ? problemStatements
        : problemStatements.filter(s => s.dept === filterDept);

    const handleSelect = (statement) => {
        setIsConfirming(statement);
    };

    const confirmSelection = async () => {
        try {
            const { error: updateError } = await supabase
                .from('teams')
                .update({ selected_statement_id: isConfirming.id })
                .eq('id', team.id);

            if (updateError) throw updateError;

            setSelectedStatement(isConfirming);
            setHasSelected(true);
            setIsConfirming(null);
            setTeam({ ...team, selected_statement_id: isConfirming.id });
            
            // Show success notification
            showNotification(`Problem statement "${isConfirming.title}" selected successfully!`, 'success');
            
            // Create notification record
            try {
                const { error: notificationError } = await supabase
                    .from('notifications')
                    .insert([{
                        recipient_id: user.id,
                        recipient_type: 'team',
                        title: 'Problem Statement Selected!',
                        message: `Your team "${team.name}" has successfully selected the problem statement: "${isConfirming.title}". You can now start working on your solution!`,
                        type: 'info',
                        is_read: false,
                        sender_type: 'system',
                        team_id: team.id
                    }]);

                if (notificationError) {
                    console.error('Error creating selection notification:', notificationError);
                } else {
                    console.log('Selection notification created successfully');
                    // Refresh notifications to show the new one
                    fetchNotifications();
                }
            } catch (error) {
                console.error('Selection notification error:', error);
            }
        } catch (error) {
            console.error('Error updating selection:', error);
            showNotification('Failed to save selection. Please try again.', 'error');
        }
    };

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-200">
                <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 sm:border-8 border-oxford border-t-transparent rounded-full animate-spin" />
                <p className="text-oxford font-black uppercase tracking-[0.2em] text-xs sm:text-sm">Loading Project tracks...</p>
            </div>
        );
    }

    if (selectedStatement && hasSelected) {
        return (
            <div className="max-w-3xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-200">
                <div className="flex items-center justify-between border-b-2 border-oxford pb-4">
                    <div>
                        <h2 className="text-xl sm:text-3xl font-bold text-oxford uppercase tracking-tight">Idea Submission</h2>
                        <p className="text-xs sm:text-base text-oxford/80">Submit your solution for the selected problem</p>
                    </div>
                    <button
                        onClick={() => { setHasSelected(false); }}
                        className="text-[10px] sm:text-sm font-black text-oxford uppercase border-2 sm:border-4 border-oxford px-4 sm:px-6 py-2 sm:py-3 rounded-xl hover:bg-oxford hover:text-white transition-all shadow-lg active:scale-95 tracking-widest bg-white"
                    >
                        Back to Tracks
                    </button>
                </div>
                <SubmissionForm
                    problemStatement={selectedStatement}
                    onCancel={() => { setHasSelected(false); }}
                />
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-200">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 border-b-2 sm:border-b-4 border-oxford pb-4 sm:pb-6">
                <div className="space-y-1 sm:space-y-2">
                    <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-oxford uppercase tracking-tighter">Project Dashboard</h1>
                    <p className="text-[10px] sm:text-sm text-oxford/80 font-bold uppercase tracking-widest">Select your innovation track</p>
                </div>

                <div className="flex items-center space-x-3 bg-oxford text-white px-6 py-4 rounded-xl shadow-xl">
                    <Clock className="w-6 h-6 animate-pulse" />
                    <span className="text-sm sm:text-lg font-black uppercase tracking-[0.2em]">Deadline: 48h 12m</span>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
                {[
                    { label: "Current Status", value: "Registered", icon: Users },
                    { label: "Track choice", value: selectedStatement ? "Selected" : "Pending", icon: Filter },
                    { label: "Submission", value: "Not Started", icon: Search },
                ].map((stat, i) => (
                    <div key={i} className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl border-2 border-transparent hover:border-oxford shadow-lg hover:shadow-xl transition-all flex items-center justify-between">
                        <div>
                            <p className="text-[9px] sm:text-[10px] font-black text-oxford/70 uppercase tracking-[0.3em] mb-1">{stat.label}</p>
                            <p className="text-lg sm:text-2xl font-black text-oxford uppercase tracking-tight">{stat.value}</p>
                        </div>
                        <div className="p-2 bg-oxford/5 rounded-full">
                            <stat.icon className="w-5 h-5 sm:w-6 sm:h-6 text-oxford/50" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center justify-center pt-4">
                <div className="flex bg-gray-50 p-1 sm:p-2 rounded-xl sm:rounded-2xl border-2 border-oxford/10 overflow-x-auto">
                    <button onClick={() => setFilterDept('All')} className={cn("px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-sm uppercase tracking-widest transition-all whitespace-nowrap", filterDept === 'All' ? "bg-oxford text-white shadow-lg" : "text-oxford/70 hover:text-oxford")}>All Tracks</button>
                    <button onClick={() => setFilterDept('CS')} className={cn("px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-sm uppercase tracking-widest transition-all whitespace-nowrap", filterDept === 'CS' ? "bg-oxford text-white shadow-lg" : "text-oxford/70 hover:text-oxford")}>CS</button>
                    <button onClick={() => setFilterDept('EC')} className={cn("px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-sm uppercase tracking-widest transition-all whitespace-nowrap", filterDept === 'EC' ? "bg-oxford text-white shadow-lg" : "text-oxford/70 hover:text-oxford")}>EC</button>
                    <button onClick={() => setFilterDept('ME')} className={cn("px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-sm uppercase tracking-widest transition-all whitespace-nowrap", filterDept === 'ME' ? "bg-oxford text-white shadow-lg" : "text-oxford/70 hover:text-oxford")}>ME</button>
                    <button onClick={() => setFilterDept('EE')} className={cn("px-4 sm:px-6 py-2 sm:py-3 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-sm uppercase tracking-widest transition-all whitespace-nowrap", filterDept === 'EE' ? "bg-oxford text-white shadow-lg" : "text-oxford/70 hover:text-oxford")}>EE</button>
                </div>
            </div>

            {/* Problem Statements List */}
            <div className="space-y-2">
                {filteredStatements.map((statement) => {
                    const isSelected = selectedStatement?.id === statement.id;
                    const isFull = statement.teams >= statement.max_teams;
                    const isExpanded = expandedRow === statement.id;

                    return (
                        <div key={statement.id} className={cn(
                            "border-2 rounded-xl bg-white shadow-lg hover:shadow-xl transition-all overflow-hidden",
                            isSelected ? "border-emerald-600 bg-emerald-50/10 ring-2 ring-emerald-500 ring-offset-1" : "border-transparent hover:border-oxford/30"
                        )}>
                            {/* Row Header */}
                            <div 
                                className="flex items-center justify-between p-4 cursor-pointer hover:bg-gray-50/50 transition-colors"
                                onClick={() => setExpandedRow(isExpanded ? null : statement.id)}
                            >
                                <div className="flex items-center gap-4 flex-1">
                                    <div className="flex items-center gap-2">
                                        <span className={cn(
                                            "text-xs font-black px-3 py-1 rounded-full uppercase tracking-widest",
                                            isSelected ? "bg-emerald-600 text-white" : "bg-oxford text-white"
                                        )}>
                                            {statement.dept}
                                        </span>
                                        {isSelected && (
                                            <CheckCircle className="w-5 h-5 text-emerald-600" />
                                        )}
                                        {isFull && !isSelected && (
                                            <Lock className="w-5 h-5 text-red-500" />
                                        )}
                                    </div>
                                    
                                    <h3 className={cn(
                                        "text-lg font-black uppercase flex-1",
                                        isSelected ? "text-emerald-700" : "text-oxford"
                                    )}>
                                        {statement.title}
                                    </h3>
                                </div>
                                
                                <div className="flex items-center gap-4">
                                    <div className="flex items-center gap-2 text-sm">
                                        <Users className="w-4 h-4 text-oxford/80" />
                                        <span className="font-bold text-oxford/80">
                                            {statement.teams}/{statement.max_teams}
                                        </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                        {!isFull || isSelected ? (
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleSelect(statement);
                                                }}
                                                className={cn(
                                                    "px-6 py-2 rounded-lg font-black text-sm uppercase tracking-widest transition-all",
                                                    isSelected
                                                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                                                        : "bg-oxford text-white hover:bg-oxford-dark"
                                                )}
                                            >
                                                {isSelected ? "View Submission" : selectedStatement ? "Switch" : "Select"}
                                            </button>
                                        ) : (
                                            <span className="px-6 py-2 rounded-lg font-black text-sm uppercase tracking-widest bg-gray-100 text-gray-400">
                                                Track Full
                                            </span>
                                        )}
                                        
                                        {isExpanded ? (
                                            <ChevronDown className="w-5 h-5 text-oxford/80" />
                                        ) : (
                                            <ChevronRight className="w-5 h-5 text-oxford/80" />
                                        )}
                                    </div>
                                </div>
                            </div>
                            
                            {/* Expandable Content */}
                            {isExpanded && (
                                <div className="border-t border-oxford/10 p-6 bg-gray-50/30 animate-in slide-in-from-top-2 duration-150">
                                    <div className="prose prose-sm max-w-none">
                                        <h4 className="text-oxford font-black uppercase tracking-wide mb-3">Problem Description</h4>
                                        <p className="text-oxford/90 leading-relaxed">
                                            {statement.description}
                                        </p>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Confirmation Modal */}
            {isConfirming && (
                <div className="fixed inset-0 bg-oxford/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white border-4 border-oxford max-w-md w-full p-6 sm:p-8 rounded-xl sm:rounded-2xl shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="text-center space-y-4">
                            <div className={cn(
                                "w-12 h-12 sm:w-16 sm:h-16 rounded-full flex items-center justify-center mx-auto",
                                selectedStatement ? "bg-amber-100" : "bg-oxford/10"
                            )}>
                                {selectedStatement ? (
                                    <AlertCircle className="w-6 h-6 sm:w-8 sm:h-8 text-amber-600" />
                                ) : (
                                    <Filter className="w-6 h-6 sm:w-8 sm:h-8 text-oxford" />
                                )}
                            </div>
                            <h3 className="text-xl sm:text-3xl font-black text-oxford uppercase tracking-tighter">
                                {selectedStatement ? "Replace Selection?" : "Confirm Selection?"}
                            </h3>
                            <div className="space-y-4">
                                {selectedStatement && (
                                    <div className="bg-amber-50 p-4 rounded-xl border border-amber-200 text-left">
                                        <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Replacing current:</p>
                                        <p className="text-xs font-bold text-amber-900 line-clamp-1">"{selectedStatement.title}"</p>
                                    </div>
                                )}
                                <p className="text-xs sm:text-lg text-oxford/80 leading-relaxed font-bold">
                                    You are {selectedStatement ? "switching to:" : "selecting:"} <br />
                                    <span className="font-black text-oxford underline underline-offset-4 decoration-2">"{isConfirming.title}"</span>
                                </p>
                            </div>
                            <div className="pt-4 sm:pt-6 grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                <button
                                    onClick={() => setIsConfirming(null)}
                                    className="py-3 sm:py-4 border-2 sm:border-4 border-oxford text-oxford font-black uppercase text-[10px] sm:text-sm tracking-[0.2em] rounded-xl sm:rounded-2xl hover:bg-gray-50 active:scale-95 transition-all shadow-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmSelection}
                                    className="py-3 sm:py-4 bg-oxford text-white font-black uppercase text-[10px] sm:text-sm tracking-[0.2em] rounded-xl sm:rounded-2xl hover:bg-oxford-dark flex items-center justify-center gap-2 sm:gap-3 shadow-xl active:scale-95 transition-all"
                                >
                                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" /> {selectedStatement ? "Replace" : "Confirm"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Notification Bell */}
            {unreadCount > 0 && (
                <button
                    onClick={() => setShowNotifications(!showNotifications)}
                    className="fixed bottom-6 right-6 z-50 p-4 bg-oxford text-white rounded-full shadow-lg hover:bg-oxford-dark transition-all active:scale-95 animate-bounce"
                >
                    <Bell className="w-5 h-5" />
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs font-bold px-2 py-0.5 rounded-full">
                        {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                </button>
            )}

            {/* Notification Panel */}
            {showNotifications && (
                <div className="fixed inset-0 z-60 bg-black/50 backdrop-blur-sm" onClick={() => setShowNotifications(false)}>
                    <div className="fixed right-0 top-0 h-full w-80 max-w-full bg-white shadow-2xl overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="p-4 border-b border-gray-200">
                            <div className="flex items-center justify-between">
                                <h3 className="text-lg font-bold text-oxford">Notifications</h3>
                                <button onClick={() => setShowNotifications(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>
                        
                        <div className="p-4">
                            {notifications.length === 0 ? (
                                <div className="text-center py-8 text-gray-500">
                                    <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p>No notifications yet</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {notifications.slice(0, 10).map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={cn(
                                                "p-3 rounded-lg border",
                                                notif.is_read 
                                                    ? "bg-gray-50 border-gray-200" 
                                                    : "bg-blue-50 border-blue-200"
                                            )}
                                        >
                                            <div className="flex items-start gap-3">
                                                {notif.type === 'status_update' && <AlertCircle className="w-4 h-4 text-blue-500 mt-0.5" />}
                                                {notif.type === 'welcome' && <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5" />}
                                                {notif.type === 'info' && <AlertTriangle className="w-4 h-4 text-orange-500 mt-0.5" />}
                                                
                                                <div className="flex-1 min-w-0">
                                                    <p className="font-semibold text-xs text-gray-900 mb-1">
                                                        {notif.title}
                                                    </p>
                                                    <p className="text-xs text-gray-600">
                                                        {notif.message}
                                                    </p>
                                                    <p className="text-[10px] text-gray-400 mt-1">
                                                        {new Date(notif.created_at).toLocaleDateString()} {new Date(notif.created_at).toLocaleTimeString()}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Toast Notification */}
            {notification && (
                <div className={cn(
                    "fixed bottom-6 left-6 z-[100] p-4 rounded-xl shadow-2xl border-2 animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-sm",
                    notification.type === 'success' ? "bg-green-50 border-green-200 text-green-800" :
                    notification.type === 'error' ? "bg-red-50 border-red-200 text-red-800" :
                    notification.type === 'info' ? "bg-blue-50 border-blue-200 text-blue-800" :
                    "bg-yellow-50 border-yellow-200 text-yellow-800"
                )}>
                    <div className="flex items-center gap-3">
                        {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                        {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                        {notification.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-600" />}
                        {(notification.type === 'warning' || !notification.type) && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                        <p className="font-bold text-sm">{notification.message}</p>
                        <button 
                            onClick={() => setNotification(null)}
                            className="ml-2 p-1 hover:bg-black/10 rounded transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
