import { X, Bell, Info, CheckCircle, AlertTriangle, XCircle, Trash2, Check, Send, Users, FileText } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';

export default function NotificationCenter({ 
    isOpen, 
    onClose, 
    notifications: propNotifications = [], 
    unreadCount: propUnreadCount = 0, 
    onNotificationUpdate 
}) {
    const { user, getUserRole } = useAuth();
    const [notifications, setNotifications] = useState(propNotifications);
    const [loading, setLoading] = useState(false);
    const [unreadCount, setUnreadCount] = useState(propUnreadCount);
    
    // Faculty notification states
    const [isNotificationModalOpen, setIsNotificationModalOpen] = useState(false);
    const [sendingNotification, setSendingNotification] = useState(false);
    const [notificationForm, setNotificationForm] = useState({
        title: '',
        message: '',
        recipient_type: 'all',
        specific_teams: [],
        department: 'CS'
    });
    const [teams, setTeams] = useState([]);

    // Update local state when props change
    useEffect(() => {
        setNotifications(propNotifications);
        setUnreadCount(propUnreadCount);
    }, [propNotifications, propUnreadCount]);

    const icons = {
        success: <CheckCircle className="w-4 h-4 text-green-500" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        info: <Info className="w-4 h-4 text-oxford" />,
        error: <XCircle className="w-4 h-4 text-red-500" />,
    };

    // Fetch notifications from Supabase
    const fetchNotifications = async () => {
        if (!user) return;
        
        try {
            setLoading(true);
            console.log('NotificationCenter: Fetching notifications for user:', user.id, 'type:', typeof user.id);
            
            const { data, error } = await supabase
                .from('notifications')
                .select(`
                    id,
                    title,
                    message,
                    type,
                    is_read,
                    created_at,
                    related_data,
                    sender_type,
                    team_id
                `)
                .eq('recipient_id', user.id.toString())
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
                console.error('NotificationCenter: Error fetching notifications:', error);
                console.error('NotificationCenter: Error details:', JSON.stringify({
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint,
                    userId: user.id,
                    userIdType: typeof user.id
                }, null, 2));
                throw error;
            }

            console.log('NotificationCenter: Successfully fetched notifications:', data);
            const formattedNotifications = data.map(notification => ({
                ...notification,
                time: formatTimeAgo(new Date(notification.created_at))
            }));

            const newUnreadCount = data.filter(n => !n.is_read).length;
            
            setNotifications(formattedNotifications);
            setUnreadCount(newUnreadCount);
            
            // Update parent component
            if (onNotificationUpdate) {
                onNotificationUpdate(formattedNotifications, newUnreadCount);
            }
        } catch (error) {
            console.error('NotificationCenter: Error in fetchNotifications:', error);
        } finally {
            setLoading(false);
        }
    };

    // Format time ago
    const formatTimeAgo = (date) => {
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMs / 3600000);
        const diffDays = Math.floor(diffMs / 86400000);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return `${diffMins}m ago`;
        if (diffHours < 24) return `${diffHours}h ago`;
        if (diffDays < 7) return `${diffDays}d ago`;
        return date.toLocaleDateString();
    };

    // Mark notification as read
    const markAsRead = async (notificationId) => {
        try {
            console.log('Marking notification as read:', notificationId);
            const { error } = await supabase
                .from('notifications')
                .update({ 
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('id', notificationId)
                .eq('recipient_id', user.id.toString());

            if (error) throw error;

            const updatedNotifications = notifications.map(n => 
                n.id === notificationId 
                    ? { ...n, is_read: true }
                    : n
            );
            const newUnreadCount = Math.max(0, unreadCount - 1);

            setNotifications(updatedNotifications);
            setUnreadCount(newUnreadCount);
            
            // Update parent component
            if (onNotificationUpdate) {
                onNotificationUpdate(updatedNotifications, newUnreadCount);
            }

            // Broadcast to all components that notifications have been updated
            window.dispatchEvent(new CustomEvent('notificationUpdate', { 
                detail: { unreadCount: newUnreadCount } 
            }));

            console.log('Notification marked as read, new unread count:', newUnreadCount);
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Mark all as read
    const markAllAsRead = async () => {
        try {
            const unreadNotifications = notifications.filter(n => !n.is_read);
            if (unreadNotifications.length === 0) return;

            console.log('Marking all notifications as read');
            const { error } = await supabase
                .from('notifications')
                .update({ 
                    is_read: true,
                    read_at: new Date().toISOString()
                })
                .eq('recipient_id', user.id.toString())
                .eq('is_read', false);

            if (error) throw error;

            const updatedNotifications = notifications.map(n => ({ ...n, is_read: true }));
            const newUnreadCount = 0;

            setNotifications(updatedNotifications);
            setUnreadCount(newUnreadCount);
            
            // Update parent component
            if (onNotificationUpdate) {
                onNotificationUpdate(updatedNotifications, newUnreadCount);
            }

            // Broadcast to all components that notifications have been updated
            window.dispatchEvent(new CustomEvent('notificationUpdate', { 
                detail: { unreadCount: newUnreadCount } 
            }));

            console.log('All notifications marked as read');
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    // Delete notification
    const deleteNotification = async (notificationId) => {
        try {
            const notificationToDelete = notifications.find(n => n.id === notificationId);
            
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId)
                .eq('recipient_id', user.id.toString());

            if (error) throw error;

            const updatedNotifications = notifications.filter(n => n.id !== notificationId);
            const newUnreadCount = notificationToDelete && !notificationToDelete.is_read 
                ? Math.max(0, unreadCount - 1)
                : unreadCount;

            setNotifications(updatedNotifications);
            setUnreadCount(newUnreadCount);
            
            // Update parent component
            if (onNotificationUpdate) {
                onNotificationUpdate(updatedNotifications, newUnreadCount);
            }
        } catch (error) {
            console.error('Error deleting notification:', error);
        }
    };

    // Faculty notification functions
    const fetchTeams = async () => {
        try {
            const { data, error } = await supabase
                .from('teams')
                .select('id, name, leader_id')
                .order('name');
            
            if (error) throw error;
            setTeams(data || []);
        } catch (error) {
            console.error('Error fetching teams:', error);
        }
    };

    const sendNotificationToTeams = async (notificationData) => {
        try {
            setSendingNotification(true);

            // Get target teams based on recipient type
            let targetTeams = [];
            
            if (notificationData.recipient_type === 'all') {
                const { data: allTeams, error } = await supabase
                    .from('teams')
                    .select('id, name, leader_id');
                    
                if (error) throw error;
                targetTeams = allTeams;
            } else if (notificationData.recipient_type === 'department') {
                // Get teams working on problem statements from the selected department
                const { data: departmentTeams, error } = await supabase
                    .from('teams')
                    .select('id, name, leader_id, problem_statements(department)')
                    .eq('problem_statements.department', notificationData.department)
                    .neq('selected_statement_id', null);
                    
                if (error) throw error;
                targetTeams = departmentTeams;
            } else if (notificationData.recipient_type === 'specific') {
                // Get the selected teams
                const { data: specificTeams, error } = await supabase
                    .from('teams')
                    .select('id, name, leader_id')
                    .in('id', notificationData.specific_teams);
                    
                if (error) throw error;
                targetTeams = specificTeams;
            }

            // Send notification to each team leader
            const notifications = targetTeams.map(team => ({
                recipient_id: team.leader_id,
                type: 'info',
                title: notificationData.title,
                message: notificationData.message,
                is_read: false,
                sender_type: 'faculty',
                created_at: new Date().toISOString()
            }));

            const { error: insertError } = await supabase
                .from('notifications')
                .insert(notifications);
                
            if (insertError) throw insertError;

            // Show success and refresh notifications
            await fetchNotifications();
            
            // Reset form and close modal
            setNotificationForm({
                title: '',
                message: '',
                recipient_type: 'all',
                specific_teams: [],
                department: 'CS'
            });
            setIsNotificationModalOpen(false);
            
        } catch (error) {
            console.error('Error sending notification:', error);
        } finally {
            setSendingNotification(false);
        }
    };

    // Set up real-time subscription with better connection management
    useEffect(() => {
        if (!user) return;

        fetchNotifications();
        
        // Fetch teams if user is faculty
        if (getUserRole() === 'faculty') {
            fetchTeams();
        }

        // Only set up subscription if not already established globally
        let channel = null;
        let isSubscribed = false;
        
        if (!window.notificationChannel) {
            console.log('Setting up notification subscription for user:', user.id);
            
            const channelName = `notifications_${user.id}`;
            channel = supabase.channel(channelName);
            
            channel
                .on('postgres_changes', 
                    { 
                        event: 'INSERT', 
                        schema: 'public', 
                        table: 'notifications',
                        filter: `recipient_id=eq.${user.id.toString()}`
                    }, 
                    (payload) => {
                        console.log('New notification received:', payload);
                        const newNotification = {
                            ...payload.new,
                            time: 'Just now'
                        };
                        
                        setNotifications(prev => [newNotification, ...prev]);
                        
                        if (!newNotification.is_read) {
                            setUnreadCount(prev => prev + 1);
                        }
                        
                        // Trigger refresh to sync with parent
                        setTimeout(fetchNotifications, 500);
                    }
                )
                .subscribe((status, error) => {
                    console.log('Subscription status:', status);
                    if (error) {
                        console.error('Subscription error:', error);
                    }
                    
                    if (status === 'SUBSCRIBED') {
                        isSubscribed = true;
                        console.log('✅ Notifications realtime connected');
                    } else if (status === 'CHANNEL_ERROR') {
                        console.error('❌ Channel error, will not retry');
                        // Don't retry on channel errors to prevent infinite loops
                        if (channel) {
                            try {
                                supabase.removeChannel(channel);
                            } catch (e) {
                                console.log('Channel cleanup error:', e.message);
                            }
                            window.notificationChannel = null;
                        }
                    }
                });
                
            window.notificationChannel = channel;
        }

        return () => {
            // Safer cleanup with error handling and status checks
            if (channel && isSubscribed) {
                try {
                    console.log('Cleaning up notification channel');
                    supabase.removeChannel(channel);
                } catch (error) {
                    console.log('Channel cleanup error (safe to ignore):', error.message);
                }
                
                if (window.notificationChannel === channel) {
                    window.notificationChannel = null;
                }
                isSubscribed = false;
            }
        };
    }, [user]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-70 sm:w-80 bg-white shadow-2xl z-60 border-l-4 border-oxford flex flex-col animate-in slide-in-from-right duration-300">
            {/* Header */}
            <div className="bg-gradient-to-r from-oxford to-oxford-dark text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center space-x-3">
                    <div className="relative p-2 bg-white/10 rounded-lg">
                        <Bell className="w-5 h-5" />
                        {unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-[9px] font-black rounded-full flex items-center justify-center animate-pulse">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </div>
                        )}
                    </div>
                    <div>
                        <h2 className="text-lg font-black uppercase tracking-tight leading-none">
                            Notifications
                        </h2>
                        {unreadCount > 0 && (
                            <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-0.5">
                                {unreadCount} unread
                            </p>
                        )}
                    </div>
                </div>
                <button onClick={onClose} className="hover:bg-white/10 p-2 rounded-lg transition-colors">
                    <X className="w-5 h-5" />
                </button>
            </div>

            {/* Faculty Send Notification Section */}
            {getUserRole() === 'faculty' && (
                <div className="bg-oxford/5 border-b border-oxford/10 p-4">
                    <div className="text-center space-y-3">
                        <div className="flex items-center justify-center gap-2">
                            <div className="p-1.5 bg-oxford/10 rounded-full">
                                <Users className="w-3 h-3 text-oxford" />
                            </div>
                            <p className="text-[11px] font-black text-oxford uppercase tracking-widest">Faculty Portal</p>
                        </div>
                        <button
                            onClick={() => setIsNotificationModalOpen(true)}
                            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-oxford text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-oxford-dark transition-all shadow-lg active:scale-95"
                        >
                            <Send className="w-4 h-4" />
                            Notify Teams
                        </button>
                    </div>
                </div>
            )}

            {/* Notifications List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-24 text-oxford/40">
                        <div className="w-10 h-10 border-4 border-oxford/20 border-t-oxford rounded-full animate-spin mb-4" />
                        <p className="font-black uppercase text-[10px] tracking-widest">Loading...</p>
                        <p className="text-[8px] text-oxford/20 mt-1">Fetching notifications</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-24 text-oxford/30">
                        <div className="p-6 bg-oxford/5 rounded-2xl mb-4">
                            <Bell className="w-12 h-12 text-oxford/20" />
                        </div>
                        <p className="font-black uppercase text-[11px] tracking-widest mb-1">No Notifications</p>
                        <p className="text-[9px] text-oxford/20 font-bold">All caught up! Great work.</p>
                    </div>
                ) : (
                    notifications.map((n) => (
                        <div 
                            key={n.id} 
                            className={cn(
                                "p-4 border-2 rounded-xl transition-all group cursor-pointer",
                                n.is_read 
                                    ? "border-oxford/10 bg-oxford/2 hover:border-oxford/20" 
                                    : "border-oxford/20 bg-white shadow-md hover:border-oxford/40 hover:shadow-lg"
                            )}
                            onClick={() => !n.is_read && markAsRead(n.id)}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className="flex items-center gap-3 flex-1">
                                    <div className={cn(
                                        "p-1.5 rounded-lg",
                                        n.is_read ? "bg-oxford/10" : "bg-oxford/15"
                                    )}>
                                        {icons[n.type]}
                                    </div>
                                    <div className="flex-1">
                                        <h4 className={cn(
                                            "font-black uppercase text-[11px] leading-tight tracking-tight truncate",
                                            n.is_read ? "text-oxford/60" : "text-oxford"
                                        )}>
                                            {n.title}
                                        </h4>
                                        {n.sender_type && (
                                            <span className="inline-block mt-1 text-[8px] font-black uppercase bg-oxford/10 px-2 py-0.5 rounded text-oxford/50 tracking-wide">
                                                {n.sender_type}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 ml-2">
                                    {!n.is_read && <div className="w-2 h-2 rounded-full bg-oxford animate-pulse" />}
                                    {!n.is_read && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                markAsRead(n.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-green-50 hover:text-green-600 rounded-lg transition-all"
                                            title="Mark as read"
                                        >
                                            <Check className="w-3 h-3" />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            deleteNotification(n.id);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1.5 hover:bg-red-50 hover:text-red-600 rounded-lg transition-all"
                                        title="Delete notification"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            <p className={cn(
                                "text-[10px] leading-relaxed font-bold pl-8",
                                n.is_read ? "text-oxford/50" : "text-oxford/70"
                            )}>
                                {n.message}
                            </p>
                            <div className="flex justify-between items-center mt-3 pl-8">
                                <p className="text-[8px] font-black text-oxford/30 uppercase tracking-widest">{n.time}</p>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Footer Actions */}
            <div className="p-4 bg-oxford/3 border-t border-oxford/10 space-y-3">
                <button 
                    onClick={markAllAsRead}
                    disabled={unreadCount === 0}
                    className={cn(
                        "w-full py-3.5 border-2 rounded-xl font-black uppercase text-[10px] tracking-widest transition-all shadow-sm active:scale-95",
                        unreadCount > 0 
                            ? "border-oxford/20 bg-white text-oxford hover:bg-oxford hover:text-white hover:border-oxford" 
                            : "border-oxford/5 bg-oxford/5 text-oxford/30 cursor-not-allowed"
                    )}
                >
                    Mark All Read ({unreadCount})
                </button>
                <div className="text-center">
                    <button
                        onClick={fetchNotifications}
                        className="text-[9px] font-black uppercase text-oxford/50 hover:text-oxford transition-colors tracking-widest px-3 py-1.5 rounded-lg hover:bg-oxford/5"
                    >
                        Refresh Notifications
                    </button>
                </div>
            </div>

            {/* Faculty Notification Modal */}
            {isNotificationModalOpen && getUserRole() === 'faculty' && (
                <div className="fixed inset-0 z-70 flex items-center justify-center p-4 bg-oxford/40 backdrop-blur-sm">
                    <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border-4 border-oxford">
                        <div className="bg-gradient-to-r from-oxford to-oxford-dark p-6 text-white flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-xl">
                                <Send className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tighter leading-none">Send Notification</h3>
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">Message teams directly</p>
                            </div>
                        </div>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            sendNotificationToTeams(notificationForm);
                        }} className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-black text-oxford mb-2 uppercase tracking-wide">Title</label>
                                <input
                                    type="text"
                                    value={notificationForm.title}
                                    onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                                    className="w-full px-4 py-3 border-2 border-oxford/10 rounded-xl focus:border-oxford focus:ring-0 transition-all font-bold text-sm"
                                    placeholder="Notification title"
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-black text-oxford mb-2 uppercase tracking-wide">Message</label>
                                <textarea
                                    value={notificationForm.message}
                                    onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                                    className="w-full px-4 py-3 border-2 border-oxford/10 rounded-xl focus:border-oxford focus:ring-0 transition-all font-bold resize-none text-sm"
                                    rows="3"
                                    placeholder="Your message to teams..."
                                    required
                                />
                            </div>
                            
                            <div>
                                <label className="block text-sm font-black text-oxford mb-2 uppercase tracking-wide">Recipients</label>
                                <select
                                    value={notificationForm.recipient_type}
                                    onChange={(e) => setNotificationForm({ ...notificationForm, recipient_type: e.target.value })}
                                    className="w-full px-4 py-3 border-2 border-oxford/10 rounded-xl focus:border-oxford focus:ring-0 transition-all font-bold text-sm"
                                >
                                    <option value="all">All Teams</option>
                                    <option value="department">By Department</option>
                                    <option value="specific">Specific Teams</option>
                                </select>
                            </div>
                            
                            {notificationForm.recipient_type === 'department' && (
                                <div>
                                    <label className="block text-sm font-black text-oxford mb-2 uppercase tracking-wide">Department</label>
                                    <select
                                        value={notificationForm.department}
                                        onChange={(e) => setNotificationForm({ ...notificationForm, department: e.target.value })}
                                        className="w-full px-4 py-3 border-2 border-oxford/10 rounded-xl focus:border-oxford focus:ring-0 transition-all font-bold text-sm"
                                    >
                                        <option value="CS">Computer Science</option>
                                        <option value="IT">Information Technology</option>
                                        <option value="CE">Computer Engineering</option>
                                        <option value="EE">Electrical Engineering</option>
                                    </select>
                                </div>
                            )}
                            
                            {notificationForm.recipient_type === 'specific' && (
                                <div>
                                    <label className="block text-sm font-black text-oxford mb-2 uppercase tracking-wide">Select Teams</label>
                                    <div className="space-y-2 max-h-32 overflow-y-auto border border-oxford/10 rounded-lg p-3 bg-oxford/2">
                                        {teams.map((team) => (
                                            <label key={team.id} className="flex items-center gap-3 p-2 hover:bg-oxford/5 rounded-lg cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={notificationForm.specific_teams.includes(team.id)}
                                                    onChange={(e) => {
                                                        if (e.target.checked) {
                                                            setNotificationForm({
                                                                ...notificationForm,
                                                                specific_teams: [...notificationForm.specific_teams, team.id]
                                                            });
                                                        } else {
                                                            setNotificationForm({
                                                                ...notificationForm,
                                                                specific_teams: notificationForm.specific_teams.filter(id => id !== team.id)
                                                            });
                                                        }
                                                    }}
                                                    className="rounded border-oxford/20 text-oxford focus:ring-oxford"
                                                />
                                                <span className="text-sm font-bold text-oxford">{team.name}</span>
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            )}
                            
                            <div className="flex gap-3 pt-4">
                                <button 
                                    type="button"
                                    onClick={() => setIsNotificationModalOpen(false)}
                                    className="flex-1 px-6 py-3.5 border-2 border-oxford/10 text-oxford/60 font-black rounded-xl uppercase tracking-widest text-[10px] hover:text-oxford hover:border-oxford transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={sendingNotification}
                                    className="flex-1 px-6 py-3.5 bg-oxford text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-oxford-dark transition-all shadow-lg active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {sendingNotification ? 'Sending...' : 'Send'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
