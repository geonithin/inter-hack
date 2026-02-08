import { X, Bell, Info, CheckCircle, AlertTriangle, XCircle, Trash2, Check } from 'lucide-react';
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

    // Set up real-time subscription
    useEffect(() => {
        if (!user) return;

        fetchNotifications();

        // Only set up subscription if not already established globally
        let channel = null;
        if (!window.notificationChannel) {
            console.log('Setting up notification subscription for user:', user.id);
            channel = supabase
                .channel('notifications_global')
                .on('postgres_changes', 
                    { 
                        event: 'INSERT', 
                        schema: 'public', 
                        table: 'notifications',
                        filter: `recipient_id=eq.${user.id.toString()}`
                    }, 
                    (payload) => {
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
                .subscribe();
                
            window.notificationChannel = channel;
        }

        return () => {
            if (channel && window.notificationChannel === channel) {
                supabase.removeChannel(channel);
                window.notificationChannel = null;
            }
        };
    }, [user]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-[280px] sm:w-[320px] bg-white shadow-2xl z-[60] border-l-4 border-oxford flex flex-col animate-in slide-in-from-right duration-300">
            <div className="bg-oxford text-white px-4 py-3 sm:py-4 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                    <div className="relative">
                        <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                        {unreadCount > 0 && (
                            <div className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 text-white text-[8px] font-black rounded-full flex items-center justify-center animate-pulse">
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </div>
                        )}
                    </div>
                    <h2 className="text-sm sm:text-base font-black uppercase tracking-tighter">
                        Notifications {unreadCount > 0 && `(${unreadCount})`}
                    </h2>
                </div>
                <button onClick={onClose} className="hover:bg-white/10 p-1.5 rounded-lg transition-colors">
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                {loading ? (
                    <div className="text-center py-20 text-oxford/40">
                        <div className="w-8 h-8 border-4 border-oxford border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                        <p className="font-black uppercase text-[10px] tracking-widest">Loading notifications...</p>
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="text-center py-20 text-oxford/40">
                        <Bell className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="font-black uppercase text-[10px] tracking-widest">No notifications</p>
                        <p className="text-[8px] text-oxford/20 mt-1">All caught up!</p>
                    </div>
                ) : (
                    notifications.map((n) => (
                        <div 
                            key={n.id} 
                            className={cn(
                                "p-2.5 border-2 rounded-xl transition-all hover:border-oxford group cursor-pointer",
                                n.is_read ? "border-oxford/10 bg-gray-50/20" : "border-oxford/20 bg-white shadow-sm"
                            )}
                            onClick={() => !n.is_read && markAsRead(n.id)}
                        >
                            <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-2 flex-1">
                                    {icons[n.type]}
                                    <h4 className="font-black text-oxford uppercase text-[10px] sm:text-[11px] leading-tight tracking-tight truncate">
                                        {n.title}
                                    </h4>
                                </div>
                                <div className="flex items-center gap-1">
                                    {!n.is_read && <div className="w-1.5 h-1.5 rounded-full bg-oxford animate-pulse" />}
                                    {!n.is_read && (
                                        <button
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                markAsRead(n.id);
                                            }}
                                            className="opacity-0 group-hover:opacity-100 p-1 hover:bg-green-50 hover:text-green-600 rounded transition-all"
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
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 hover:text-red-600 rounded transition-all"
                                        title="Delete notification"
                                    >
                                        <Trash2 className="w-3 h-3" />
                                    </button>
                                </div>
                            </div>
                            <p className="text-[10px] text-oxford/70 leading-relaxed font-bold pl-6 pr-6">{n.message}</p>
                            <div className="flex justify-between items-center mt-2">
                                <p className="text-[8px] font-black text-oxford/30 uppercase tracking-widest">{n.time}</p>
                                {n.sender_type && (
                                    <span className="text-[7px] font-black uppercase bg-oxford/5 px-2 py-0.5 rounded text-oxford/50">
                                        {n.sender_type}
                                    </span>
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <div className="p-3 bg-gray-50 border-t-2 border-oxford/10 space-y-2">
                <button 
                    onClick={markAllAsRead}
                    disabled={unreadCount === 0}
                    className={cn(
                        "w-full py-3 border border-oxford/10 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all shadow-sm active:scale-95",
                        unreadCount > 0 
                            ? "bg-white text-oxford hover:bg-oxford hover:text-white" 
                            : "bg-gray-100 text-oxford/30 cursor-not-allowed"
                    )}
                >
                    Mark all as read ({unreadCount})
                </button>
                <div className="text-center">
                    <button
                        onClick={fetchNotifications}
                        className="text-[8px] font-black uppercase text-oxford/40 hover:text-oxford transition-colors"
                    >
                        Refresh notifications
                    </button>
                </div>
            </div>
        </div>
    );
}
