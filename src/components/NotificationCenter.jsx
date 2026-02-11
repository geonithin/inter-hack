import { X, Bell, Info, CheckCircle, AlertTriangle, XCircle, Trash2, Check, Send, Users, FileText, TrendingUp, Clock, Zap, Calendar, Filter, History } from 'lucide-react';
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
    const [showBroadcastHistory, setShowBroadcastHistory] = useState(false);
    const [broadcastHistory, setBroadcastHistory] = useState([]);
    const [notificationForm, setNotificationForm] = useState({
        title: '',
        message: '',
        type: 'info',
        category: 'announcement',
        priority: 'normal',
        recipient_filter: 'all',
        specific_teams: [],
        department: 'CS',
        expires_in_days: null
    });
    const [teams, setTeams] = useState([]);
    const [templates, setTemplates] = useState([]);

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
        if (!user?.id) return;
        
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
                // Only show errors that aren't expected permission issues
                if (!error.message?.includes('relation') && !error.message?.includes('permission')) {
                    console.error('NotificationCenter: Error fetching notifications:', error);
                }
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
            // Suppress expected errors in production
            if (process.env.NODE_ENV === 'development') {
                console.warn('NotificationCenter: Could not fetch notifications');
            }
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
        if (!user?.id) return;
        
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
        if (!user?.id) return;
        
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
        if (!user?.id) return;
        
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
                .select('id, name, lead_id, department')
                .order('name');
            
            if (error) {
                if (error.code !== '42501') {
                    console.warn('Could not fetch teams:', error.message);
                }
                return;
            }
            setTeams(data || []);
        } catch (error) {
            if (process.env.NODE_ENV === 'development') {
                console.warn('Error fetching teams:', error.message);
            }
        }
    };

    const fetchTemplates = async () => {
        try {
            const { data, error } = await supabase
                .from('notification_templates')
                .select('*')
                .eq('is_active', true)
                .order('name');
            
            if (error) throw error;
            setTemplates(data || []);
        } catch (error) {
            console.warn('Could not fetch templates:', error.message);
        }
    };

    const fetchBroadcastHistory = async () => {
        if (!user?.id) return;
        
        try {
            const { data, error } = await supabase
                .from('notification_broadcasts')
                .select('*')
                .eq('sender_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);
            
            if (error) throw error;
            setBroadcastHistory(data || []);
        } catch (error) {
            console.warn('Could not fetch broadcast history:', error.message);
        }
    };

    const sendNotificationToTeams = async (e) => {
        e.preventDefault();
        
        try {
            setSendingNotification(true);

            // Use the database function for sending bulk notifications
            const { data, error } = await supabase.rpc('send_bulk_notification', {
                p_title: notificationForm.title.trim(),
                p_message: notificationForm.message.trim(),
                p_type: notificationForm.type,
                p_category: notificationForm.category,
                p_priority: notificationForm.priority,
                p_recipient_filter: notificationForm.recipient_filter,
                p_department: notificationForm.recipient_filter === 'department' ? notificationForm.department : null,
                p_team_ids: notificationForm.recipient_filter === 'specific' ? notificationForm.specific_teams : [],
                p_sender_id: user.id,
                p_expires_in_days: notificationForm.expires_in_days
            });

            if (error) throw error;

            console.log('Notification sent successfully:', data);
            
            // Show success message
            alert(`✅ Successfully sent ${data.notifications_sent} notification${data.notifications_sent !== 1 ? 's' : ''}!`);

            // Refresh notifications and broadcast history
            await fetchNotifications();
            await fetchBroadcastHistory();
            
            // Reset form and close modal
            setNotificationForm({
                title: '',
                message: '',
                type: 'info',
                category: 'announcement',
                priority: 'normal',
                recipient_filter: 'all',
                specific_teams: [],
                department: 'CS',
                expires_in_days: null
            });
            setIsNotificationModalOpen(false);
            
        } catch (error) {
            console.error('Error sending notification:', error);
            alert(`❌ Error: ${error.message}`);
        } finally {
            setSendingNotification(false);
        }
    };

    const applyTemplate = (template) => {
        setNotificationForm({
            ...notificationForm,
            title: template.title,
            message: template.message,
            type: template.type,
            category: template.category,
            priority: template.priority
        });
    };

    // Set up real-time subscription with better connection management
    useEffect(() => {
        if (!user?.id) return;

        fetchNotifications();
        
        // Fetch teams, templates and broadcast history if user is faculty
        if (getUserRole() === 'faculty') {
            fetchTeams();
            fetchTemplates();
            fetchBroadcastHistory();
        }

        // Only set up subscription if not already established globally
        let channel = null;
        let isSubscribed = false;
        
        if (!window.notificationChannel && user?.id) {
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
                        // Silently handle channel errors - they're expected if subscriptions aren't enabled
                        if (process.env.NODE_ENV === 'development') {
                            console.log('Channel connection unavailable (this is normal)');
                        }
                        // Don't retry on channel errors to prevent infinite loops
                        if (channel) {
                            try {
                                supabase.removeChannel(channel);
                            } catch (e) {
                                // Silently ignore cleanup errors
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
                <div className="bg-gradient-to-br from-oxford/5 via-oxford/3 to-transparent border-b border-oxford/10 p-5">
                    <div className="space-y-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-gradient-to-br from-oxford to-oxford-dark rounded-xl shadow-lg">
                                <Users className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1">
                                <p className="text-xs font-black text-oxford uppercase tracking-wider">Faculty Portal</p>
                                <p className="text-[9px] text-oxford/50 font-bold">Broadcast to teams</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <button
                                onClick={() => setIsNotificationModalOpen(true)}
                                className="flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-oxford to-oxford-dark text-white rounded-xl font-black text-[10px] uppercase tracking-wider hover:shadow-lg active:scale-95 transition-all"
                            >
                                <Send className="w-3.5 h-3.5" />
                                Send
                            </button>
                            <button
                                onClick={() => {
                                    setShowBroadcastHistory(!showBroadcastHistory);
                                    if (!showBroadcastHistory) fetchBroadcastHistory();
                                }}
                                className="flex items-center justify-center gap-2 px-4 py-3 border-2 border-oxford/20 text-oxford rounded-xl font-black text-[10px] uppercase tracking-wider hover:bg-oxford/5 active:scale-95 transition-all"
                            >
                                <History className="w-3.5 h-3.5" />
                                History
                            </button>
                        </div>
                        {showBroadcastHistory && broadcastHistory.length > 0 && (
                            <div className="mt-3 p-3 bg-white rounded-xl border border-oxford/10 max-h-48 overflow-y-auto space-y-2">
                                {broadcastHistory.slice(0, 5).map((broadcast) => (
                                    <div key={broadcast.id} className="p-2.5 bg-oxford/5 rounded-lg border border-oxford/10">
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-[10px] font-black text-oxford truncate">{broadcast.title}</p>
                                                <p className="text-[8px] text-oxford/60 font-bold mt-0.5">{broadcast.message.substring(0, 50)}{broadcast.message.length > 50 ? '...' : ''}</p>
                                            </div>
                                            <div className="flex-shrink-0 text-right">
                                                <span className="inline-block px-2 py-0.5 bg-oxford text-white rounded text-[8px] font-black">
                                                    {broadcast.recipient_count}
                                                </span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 mt-2">
                                            <span className="text-[7px] font-black text-oxford/40 uppercase tracking-wider">{new Date(broadcast.created_at).toLocaleDateString()}</span>
                                            <span className="text-[7px] font-bold text-oxford/40">•</span>
                                            <span className="text-[7px] font-black text-oxford/40 uppercase">{broadcast.recipient_filter}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
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

            {/* Faculty Notification Modal - Complete Redesign */}
            {isNotificationModalOpen && getUserRole() === 'faculty' && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-3 bg-gradient-to-br from-oxford/60 via-oxford/40 to-oxford/60 backdrop-blur-md animate-in fade-in">
                    <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-hidden shadow-2xl border-2 border-oxford/20 animate-in zoom-in-95 duration-300">
                        {/* Header */}
                        <div className="relative bg-gradient-to-r from-oxford via-oxford-dark to-oxford p-6 text-white overflow-hidden">
                            <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
                            <div className="relative flex items-start justify-between">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 bg-white/20 backdrop-blur-sm rounded-2xl shadow-lg">
                                        <Send className="w-7 h-7" />
                                    </div>
                                    <div>
                                        <h3 className="text-2xl font-black uppercase tracking-tight leading-none">Broadcast Notification</h3>
                                        <p className="text-xs font-bold opacity-90 mt-1.5 flex items-center gap-2">
                                            <TrendingUp className="w-3.5 h-3.5" />
                                            Send updates to teams instantly
                                        </p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => setIsNotificationModalOpen(false)}
                                    className="p-2 hover:bg-white/20 rounded-xl transition-all"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                        </div>

                        <form onSubmit={sendNotificationToTeams} className="overflow-y-auto max-h-[calc(90vh-140px)]">
                            <div className="p-6 space-y-5">
                                {/* Quick Templates */}
                                {templates.length > 0 && (
                                    <div className="bg-gradient-to-br from-oxford/5 to-oxford/10 p-4 rounded-2xl border border-oxford/10">
                                        <div className="flex items-center gap-2 mb-3">
                                            <Zap className="w-4 h-4 text-oxford" />
                                            <label className="text-[10px] font-black text-oxford uppercase tracking-wider">Quick Templates</label>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            {templates.slice(0, 4).map((template) => (
                                                <button
                                                    key={template.id}
                                                    type="button"
                                                    onClick={() => applyTemplate(template)}
                                                    className="p-3 bg-white border border-oxford/10 rounded-xl text-left hover:border-oxford hover:bg-oxford/5 transition-all group"
                                                >
                                                    <p className="text-[10px] font-black text-oxford uppercase leading-tight group-hover:text-oxford-dark">{template.name.replace(/_/g, ' ')}</p>
                                                    <p className="text-[8px] text-oxford/50 font-bold mt-1">{template.title.substring(0, 30)}...</p>
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {/* Title */}
                                <div>
                                    <label className="block text-xs font-black text-oxford mb-2 uppercase tracking-wider">
                                        Notification Title *
                                    </label>
                                    <input
                                        type="text"
                                        value={notificationForm.title}
                                        onChange={(e) => setNotificationForm({ ...notificationForm, title: e.target.value })}
                                        className="w-full px-4 py-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford focus:ring-2 focus:ring-oxford/20 transition-all font-bold text-sm placeholder:text-oxford/30"
                                        placeholder="e.g., Submission Deadline Update"
                                        required
                                        maxLength={100}
                                    />
                                    <p className="text-[9px] text-oxford/40 font-bold mt-1.5 ml-1">{notificationForm.title.length}/100 characters</p>
                                </div>

                                {/* Message */}
                                <div>
                                    <label className="block text-xs font-black text-oxford mb-2 uppercase tracking-wider">
                                        Message Content *
                                    </label>
                                    <textarea
                                        value={notificationForm.message}
                                        onChange={(e) => setNotificationForm({ ...notificationForm, message: e.target.value })}
                                        className="w-full px-4 py-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford focus:ring-2 focus:ring-oxford/20 transition-all font-bold resize-none text-sm placeholder:text-oxford/30"
                                        rows="4"
                                        placeholder="Enter your message here..."
                                        required
                                        maxLength={500}
                                    />
                                    <p className="text-[9px] text-oxford/40 font-bold mt-1.5 ml-1">{notificationForm.message.length}/500 characters</p>
                                </div>

                                {/* Type, Category, and Priority - Grid Layout */}
                                <div className="grid grid-cols-3 gap-3">
                                    {/* Type */}
                                    <div>
                                        <label className="block text-[10px] font-black text-oxford mb-2 uppercase tracking-wider">Type</label>
                                        <select
                                            value={notificationForm.type}
                                            onChange={(e) => setNotificationForm({ ...notificationForm, type: e.target.value })}
                                            className="w-full px-3 py-2.5 border-2 border-oxford/10 rounded-xl focus:border-oxford focus:ring-2 focus:ring-oxford/20 transition-all font-bold text-xs"
                                        >
                                            <option value="info">ℹ️ Info</option>
                                            <option value="success">✅ Success</option>
                                            <option value="warning">⚠️ Warning</option>
                                            <option value="error">❌ Error</option>
                                        </select>
                                    </div>

                                    {/* Category */}
                                    <div>
                                        <label className="block text-[10px] font-black text-oxford mb-2 uppercase tracking-wider">Category</label>
                                        <select
                                            value={notificationForm.category}
                                            onChange={(e) => setNotificationForm({ ...notificationForm, category: e.target.value })}
                                            className="w-full px-3 py-2.5 border-2 border-oxford/10 rounded-xl focus:border-oxford focus:ring-2 focus:ring-oxford/20 transition-all font-bold text-xs"
                                        >
                                            <option value="announcement">📢 Announcement</option>
                                            <option value="deadline">⏰ Deadline</option>
                                            <option value="update">🔄 Update</option>
                                            <option value="reminder">🔔 Reminder</option>
                                            <option value="alert">⚡ Alert</option>
                                        </select>
                                    </div>

                                    {/* Priority */}
                                    <div>
                                        <label className="block text-[10px] font-black text-oxford mb-2 uppercase tracking-wider">Priority</label>
                                        <select
                                            value={notificationForm.priority}
                                            onChange={(e) => setNotificationForm({ ...notificationForm, priority: e.target.value })}
                                            className={cn(
                                                "w-full px-3 py-2.5 border-2 rounded-xl focus:ring-2 transition-all font-bold text-xs",
                                                notificationForm.priority === 'urgent' ? "border-red-300 focus:border-red-500 focus:ring-red-200 bg-red-50" :
                                                notificationForm.priority === 'high' ? "border-orange-300 focus:border-orange-500 focus:ring-orange-200 bg-orange-50" :
                                                "border-oxford/10 focus:border-oxford focus:ring-oxford/20"
                                            )}
                                        >
                                            <option value="low">🟢 Low</option>
                                            <option value="normal">🔵 Normal</option>
                                            <option value="high">🟠 High</option>
                                            <option value="urgent">🔴 Urgent</option>
                                        </select>
                                    </div>
                                </div>

                                {/* Recipients Section */}
                                <div className="bg-gradient-to-br from-oxford/5 to-transparent p-4 rounded-2xl border border-oxford/10">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Filter className="w-4 h-4 text-oxford" />
                                        <label className="text-xs font-black text-oxford uppercase tracking-wider">Target Recipients</label>
                                    </div>
                                    
                                    <select
                                        value={notificationForm.recipient_filter}
                                        onChange={(e) => setNotificationForm({ ...notificationForm, recipient_filter: e.target.value, specific_teams: [] })}
                                        className="w-full px-4 py-3 border-2 border-oxford/10 rounded-xl focus:border-oxford focus:ring-2 focus:ring-oxford/20 transition-all font-bold text-sm mb-3"
                                    >
                                        <option value="all">📢 All Teams</option>
                                        <option value="department">🏢 By Department</option>
                                        <option value="specific">👥 Specific Teams</option>
                                    </select>

                                    {/* Department Filter */}
                                    {notificationForm.recipient_filter === 'department' && (
                                        <select
                                            value={notificationForm.department}
                                            onChange={(e) => setNotificationForm({ ...notificationForm, department: e.target.value })}
                                            className="w-full px-4 py-3 border-2 border-oxford/10 rounded-xl focus:border-oxford focus:ring-2 focus:ring-oxford/20 transition-all font-bold text-sm"
                                        >
                                            <option value="CS">💻 Computer Science</option>
                                            <option value="EC">⚡ Electronics & Communication</option>
                                            <option value="ME">⚙️ Mechanical Engineering</option>
                                            <option value="EE">🔌 Electrical Engineering</option>
                                            <option value="CE">🏗️ Civil Engineering</option>
                                        </select>
                                    )}

                                    {/* Specific Teams */}
                                    {notificationForm.recipient_filter === 'specific' && (
                                        <div className="space-y-2 max-h-40 overflow-y-auto border-2 border-oxford/10 rounded-xl p-3 bg-white">
                                            {teams.length === 0 ? (
                                                <p className="text-xs text-oxford/50 font-bold text-center py-4">No teams available</p>
                                            ) : (
                                                teams.map((team) => (
                                                    <label
                                                        key={team.id}
                                                        className={cn(
                                                            "flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-all",
                                                            notificationForm.specific_teams.includes(team.id)
                                                                ? "bg-oxford/10 border border-oxford/30"
                                                                : "hover:bg-oxford/5 border border-transparent"
                                                        )}
                                                    >
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
                                                            className="rounded border-oxford/30 text-oxford focus:ring-oxford w-4 h-4"
                                                        />
                                                        <div className="flex-1">
                                                            <span className="text-sm font-bold text-oxford">{team.name}</span>
                                                            {team.department && (
                                                                <span className="ml-2 text-[9px] font-black px-2 py-0.5 bg-oxford/10 text-oxford/60 rounded-full uppercase">
                                                                    {team.department}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </label>
                                                ))
                                            )}
                                        </div>
                                    )}

                                    {/* Team Count Display */}
                                    <div className="mt-3 p-2.5 bg-white rounded-lg border border-oxford/10">
                                        <p className="text-[10px] font-black text-oxford/60 uppercase tracking-wider flex items-center gap-2">
                                            <Users className="w-3.5 h-3.5" />
                                            Will notify: <span className="text-oxford">
                                                {notificationForm.recipient_filter === 'all' ? teams.length :
                                                 notificationForm.recipient_filter === 'department' ? teams.filter(t => t.department === notificationForm.department).length :
                                                 notificationForm.specific_teams.length} team{notificationForm.specific_teams.length !== 1 ? 's' : ''}
                                            </span>
                                        </p>
                                    </div>
                                </div>

                                {/* Optional: Expiration */}
                                <div className="flex items-center gap-4 p-4 bg-oxford/5 rounded-xl border border-oxford/10">
                                    <Calendar className="w-5 h-5 text-oxford flex-shrink-0" />
                                    <div className="flex-1">
                                        <label className="block text-[10px] font-black text-oxford uppercase tracking-wider mb-1.5">
                                            Auto-delete after (optional)
                                        </label>
                                        <select
                                            value={notificationForm.expires_in_days || ''}
                                            onChange={(e) => setNotificationForm({ ...notificationForm, expires_in_days: e.target.value ? parseInt(e.target.value) : null })}
                                            className="w-full px-3 py-2 border-2 border-oxford/10 rounded-lg focus:border-oxford transition-all font-bold text-xs"
                                        >
                                            <option value="">Never expire</option>
                                            <option value="1">1 day</option>
                                            <option value="3">3 days</option>
                                            <option value="7">1 week</option>
                                            <option value="30">1 month</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* Footer Actions */}
                            <div className="sticky bottom-0 p-5 bg-gradient-to-t from-white via-white to-transparent border-t border-oxford/10">
                                <div className="flex gap-3">
                                    <button
                                        type="button"
                                        onClick={() => setIsNotificationModalOpen(false)}
                                        className="flex-1 px-6 py-4 border-2 border-oxford/20 text-oxford/70 font-black rounded-xl uppercase tracking-wider text-xs hover:text-oxford hover:border-oxford hover:bg-oxford/5 transition-all"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={sendingNotification || (notificationForm.recipient_filter === 'specific' && notificationForm.specific_teams.length === 0)}
                                        className="flex-1 px-6 py-4 bg-gradient-to-r from-oxford to-oxford-dark text-white font-black rounded-xl uppercase tracking-wider text-xs hover:shadow-2xl transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:shadow-none active:scale-95 flex items-center justify-center gap-2"
                                    >
                                        {sendingNotification ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Sending...
                                            </>
                                        ) : (
                                            <>
                                                <Send className="w-4 h-4" />
                                                Send Notification
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
