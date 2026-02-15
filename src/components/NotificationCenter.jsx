import React from 'react';
import { X, Bell, Info, CheckCircle, AlertTriangle, XCircle, Trash2, Send, MessageCircle, Target, Clock } from 'lucide-react';
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
    const [sendingNotification, setSendingNotification] = useState(false);
    const [sentNotifications, setSentNotifications] = useState([]);
    const [notificationForm, setNotificationForm] = useState({
        title: '',
        message: '',
        type: 'info',
        priority: 'normal',
        recipient_filter: 'all',
        specific_teams: [],
        department: 'CS'
    });
    const [teams, setTeams] = useState([]);

    // Check if user is faculty
    const isFaculty = getUserRole() === 'faculty';

    // Update local state when props change (only for non-faculty)
    useEffect(() => {
        if (!isFaculty) {
            setNotifications(propNotifications);
            setUnreadCount(propUnreadCount);
        }
    }, [propNotifications, propUnreadCount, isFaculty]);

    // Faculty: Fetch teams for sending notifications
    useEffect(() => {
        if (isFaculty && isOpen) {
            fetchTeams();
        }
    }, [isFaculty, isOpen]);

    // Non-Faculty: Fetch notifications
    useEffect(() => {
        if (!isFaculty && isOpen) {
            fetchNotifications();
        }
    }, [isOpen, isFaculty]);

    // Faculty: Fetch teams for message sending
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
            console.warn('Error fetching teams:', error.message);
        }
    };

    // Faculty: Send notification to teams
    const handleSendNotification = async (e) => {
        e.preventDefault();
        if (!notificationForm.title || !notificationForm.message) {
            return;
        }

        setSendingNotification(true);
        try {
            let recipientIds = [];
            
            // Determine recipients based on filter
            if (notificationForm.recipient_filter === 'all') {
                recipientIds = teams.map(t => t.lead_id).filter(Boolean);
            } else if (notificationForm.recipient_filter === 'selected') {
                recipientIds = teams.filter(t => t.status === 'Selected').map(t => t.lead_id).filter(Boolean);
            } else if (notificationForm.recipient_filter === 'pending') {
                recipientIds = teams.filter(t => t.status === 'Pending').map(t => t.lead_id).filter(Boolean);
            } else if (notificationForm.recipient_filter === 'department') {
                recipientIds = teams.filter(t => t.department === notificationForm.department).map(t => t.lead_id).filter(Boolean);
            }

            if (recipientIds.length === 0) {
                setSendingNotification(false);
                return;
            }

            // Send to each recipient
            const notifications = recipientIds.map(recipientId => ({
                title: notificationForm.title,
                message: notificationForm.message,
                type: notificationForm.type,
                priority: notificationForm.priority,
                recipient_id: recipientId,
                sender_type: 'faculty',
                sender_id: user.id,
                created_at: new Date().toISOString(),
                is_read: false
            }));

            const { error } = await supabase
                .from('notifications')
                .insert(notifications);

            if (error) throw error;

            // Track sent notification locally
            const sentNotification = {
                id: Date.now(),
                title: notificationForm.title,
                message: notificationForm.message,
                type: notificationForm.type,
                recipient_count: recipientIds.length,
                sent_at: new Date().toISOString(),
                filter_type: notificationForm.recipient_filter
            };

            setSentNotifications(prev => [sentNotification, ...prev]);
            
            // Reset form
            setNotificationForm({
                title: '',
                message: '',
                type: 'info',
                priority: 'normal',
                recipient_filter: 'all',
                specific_teams: [],
                department: 'CS'
            });
        } catch (error) {
            console.error('Error sending notification:', error);
        } finally {
            setSendingNotification(false);
        }
    };

    // Non-Faculty: Fetch notifications from Supabase
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
                .eq('recipient_id', user.id)
                .order('created_at', { ascending: false })
                .limit(20);

            if (error) {
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
            console.warn('NotificationCenter: Could not fetch notifications:', error.message);
            setNotifications([]);
            setUnreadCount(0);
        } finally {
            setLoading(false);
        }
    };

    // Non-Faculty: Mark notification as read
    const markAsRead = async (notificationId) => {
        if (!user?.id) return;
        
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', notificationId)
                .eq('recipient_id', user.id);

            if (error) throw error;

            const updatedNotifications = notifications.map(n => 
                n.id === notificationId ? { ...n, is_read: true } : n
            );
            
            setNotifications(updatedNotifications);
            
            // Calculate new unread count
            const newUnreadCount = Math.max(0, unreadCount - 1);
            setUnreadCount(newUnreadCount);
            
            // Update parent component with correct unread count
            if (onNotificationUpdate) {
                onNotificationUpdate(updatedNotifications, newUnreadCount);
            }
            
            // Emit global event for other components
            window.dispatchEvent(new CustomEvent('notificationUpdate', {
                detail: { unreadCount: newUnreadCount }
            }));
            
        } catch (error) {
            console.error('Error marking notification as read:', error);
        }
    };

    // Non-Faculty: Mark all notifications as read
    const markAllAsRead = async () => {
        if (!user?.id || notifications.length === 0) return;
        
        const unreadNotificationIds = notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadNotificationIds.length === 0) return;
        
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('recipient_id', user.id)
                .in('id', unreadNotificationIds);

            if (error) throw error;

            // Update local state
            const updatedNotifications = notifications.map(n => ({ ...n, is_read: true }));
            setNotifications(updatedNotifications);
            setUnreadCount(0);
            
            // Update parent component
            if (onNotificationUpdate) {
                onNotificationUpdate(updatedNotifications, 0);
            }
            
            // Emit global event for other components
            window.dispatchEvent(new CustomEvent('notificationUpdate', {
                detail: { unreadCount: 0 }
            }));
            
        } catch (error) {
            console.error('Error marking all notifications as read:', error);
        }
    };

    // Non-Faculty: Delete notification
    const deleteNotification = async (notificationId) => {
        if (!user?.id) return;
        
        try {
            const notificationToDelete = notifications.find(n => n.id === notificationId);
            
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('id', notificationId)
                .eq('recipient_id', user.id);

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

    // Utility function for time formatting
    const formatTimeAgo = (date) => {
        const now = new Date();
        const diffInMinutes = Math.floor((now - date) / 60000);
        
        if (diffInMinutes < 1) return 'Just now';
        if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
        if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
        return `${Math.floor(diffInMinutes / 1440)}d ago`;
    };

    const icons = {
        success: <CheckCircle className="w-4 h-4 text-green-500" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        info: <Info className="w-4 h-4 text-oxford" />,
        error: <XCircle className="w-4 h-4 text-red-500" />,
    };

    if (!isOpen) return null;

    // Faculty users get a completely different interface focused on sending messages
    if (isFaculty) {
        return (
            <div className="fixed top-16 sm:inset-y-0 right-2 sm:right-0 w-80 sm:w-96 md:w-[28rem] max-h-[calc(100vh-5rem)] sm:max-h-none bg-white shadow-xl border border-gray-200 rounded-xl sm:rounded-l-none sm:border-l z-50 flex flex-col">
                {/* Professional Faculty Header */}
                <div className="bg-white border-b border-gray-200">
                    <div className="p-4">
                        <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                                <div className="w-10 h-10 bg-oxford/10 rounded-lg flex items-center justify-center">
                                    <MessageCircle className="w-5 h-5 text-oxford" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-gray-900">Send Message</h2>
                                    <p className="text-sm text-gray-500">Broadcast to Teams</p>
                                </div>
                            </div>
                            <button 
                                onClick={onClose} 
                                className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                            >
                                <X className="w-4 h-4 text-gray-600" />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Professional Message Composer */}
                <form onSubmit={handleSendNotification} className="flex-1 flex flex-col p-4 space-y-4 overflow-y-auto">
                    {/* Message Title Card */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Message Title *
                        </label>
                        <input
                            type="text"
                            value={notificationForm.title}
                            onChange={(e) => setNotificationForm(prev => ({ ...prev, title: e.target.value }))}
                            placeholder="Enter announcement title..."
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-oxford focus:ring-1 focus:ring-oxford outline-none transition-all"
                            required
                        />
                    </div>

                    {/* Message Content Card */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Message Content *
                        </label>
                        <textarea
                            value={notificationForm.message}
                            onChange={(e) => setNotificationForm(prev => ({ ...prev, message: e.target.value }))}
                            placeholder="Write your message here..."
                            rows={4}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-oxford focus:ring-1 focus:ring-oxford outline-none transition-all resize-none"
                            required
                        />
                    </div>

                    {/* Configuration Cards */}
                    <div className="space-y-3">
                        <div className="bg-gray-50 rounded-xl p-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Message Type
                            </label>
                            <select
                                value={notificationForm.type}
                                onChange={(e) => setNotificationForm(prev => ({ ...prev, type: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-oxford focus:ring-1 focus:ring-oxford outline-none transition-all"
                            >
                                <option value="info">Information</option>
                                <option value="success">Success</option>
                                <option value="warning">Warning</option>
                                <option value="error">Important</option>
                            </select>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Priority Level
                            </label>
                            <select
                                value={notificationForm.priority}
                                onChange={(e) => setNotificationForm(prev => ({ ...prev, priority: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-oxford focus:ring-1 focus:ring-oxford outline-none transition-all"
                            >
                                <option value="normal">Normal</option>
                                <option value="high">High</option>
                                <option value="urgent">Urgent</option>
                            </select>
                        </div>

                        <div className="bg-gray-50 rounded-xl p-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Recipients
                            </label>
                            <select
                                value={notificationForm.recipient_filter}
                                onChange={(e) => setNotificationForm(prev => ({ ...prev, recipient_filter: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-oxford focus:ring-1 focus:ring-oxford outline-none transition-all"
                            >
                                <option value="all">All Teams</option>
                                <option value="selected">Selected Teams Only</option>
                                <option value="pending">Pending Teams Only</option>
                                <option value="department">By Department</option>
                            </select>
                        </div>
                    </div>

                    {/* Department Filter */}
                    {notificationForm.recipient_filter === 'department' && (
                        <div className="bg-gray-50 rounded-xl p-4">
                            <label className="block text-sm font-semibold text-gray-700 mb-2">
                                Department
                            </label>
                            <select
                                value={notificationForm.department}
                                onChange={(e) => setNotificationForm(prev => ({ ...prev, department: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-oxford focus:ring-1 focus:ring-oxford outline-none transition-all"
                            >
                                <option value="CSE">Computer Science & Engineering</option>
                                <option value="AIDS">Artificial Intelligence & Data Science</option>
                                <option value="ECE">Electronics & Communication Engineering</option>
                                <option value="EEE">Electrical & Electronics Engineering</option>
                                <option value="MECH">Mechanical Engineering</option>
                            </select>
                        </div>
                    )}

                    {/* Recipient Info Card */}
                    <div className="bg-oxford/5 rounded-xl p-4 border border-oxford/10">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-oxford/10 rounded-lg flex items-center justify-center">
                                <Target className="w-4 h-4 text-oxford" />
                            </div>
                            <div>
                                <p className="text-sm font-semibold text-oxford">
                                    Will notify: {teams.length} team{teams.length !== 1 ? 's' : ''}
                                </p>
                                <p className="text-xs text-oxford/60">Recipients will be notified immediately</p>
                            </div>
                        </div>
                    </div>

                    {/* Send Button Card */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <button
                            type="submit"
                            disabled={sendingNotification || !notificationForm.title || !notificationForm.message}
                            className={cn(
                                "w-full py-3 bg-oxford text-white font-semibold rounded-lg transition-all flex items-center justify-center gap-2",
                                sendingNotification || !notificationForm.title || !notificationForm.message 
                                    ? "opacity-50 cursor-not-allowed" 
                                    : "hover:bg-oxford-dark"
                            )}
                        >
                            {sendingNotification ? (
                                <>
                                    <Clock className="w-5 h-5 animate-spin" />
                                    Sending...
                                </>
                            ) : (
                                <>
                                    <Send className="w-5 h-5" />
                                    Send Message
                                </>
                            )}
                        </button>
                    </div>
                </form>

                {/* Sent Messages History */}
                {sentNotifications.length > 0 && (
                    <div className="border-t border-gray-200 p-4 max-h-64 overflow-y-auto">
                        <h4 className="text-sm font-semibold text-gray-700 mb-3">Recent Messages</h4>
                        <div className="space-y-2">
                            {sentNotifications.slice(0, 5).map((sentMsg) => (
                                <div key={sentMsg.id} className="bg-gray-50 rounded-lg p-3">
                                    <div className="flex items-start justify-between gap-2">
                                        <div className="flex-1">
                                            <h5 className="font-semibold text-sm text-gray-900 mb-1">{sentMsg.title}</h5>
                                            <p className="text-xs text-gray-600 line-clamp-2">{sentMsg.message}</p>
                                            <div className="flex items-center gap-2 mt-2 text-xs text-gray-500">
                                                <span>{sentMsg.recipient_count} recipients</span>
                                                <span>•</span>
                                                <span>{new Date(sentMsg.sent_at).toLocaleDateString()}</span>
                                            </div>
                                        </div>
                                        <div className={cn(
                                            "px-2 py-1 rounded text-xs font-medium",
                                            sentMsg.type === 'success' ? "bg-green-100 text-green-700" :
                                            sentMsg.type === 'warning' ? "bg-amber-100 text-amber-700" :
                                            sentMsg.type === 'error' ? "bg-red-100 text-red-700" :
                                            "bg-blue-100 text-blue-700"
                                        )}>
                                            {sentMsg.type}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // Original notification receiving interface for team leads
    return (
        <div className="fixed top-16 sm:inset-y-0 right-2 sm:right-0 w-80 sm:w-96 md:w-[28rem] max-h-[calc(100vh-5rem)] sm:max-h-none bg-white shadow-xl border border-gray-200 rounded-xl sm:rounded-l-none sm:border-l z-50 flex flex-col">
            {/* Professional Header with Card Layout */}
            <div className="bg-white border-b border-gray-200">
                <div className="p-4">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                            <div className="relative">
                                <div className="w-10 h-10 bg-oxford/10 rounded-lg flex items-center justify-center">
                                    <Bell className="w-5 h-5 text-oxford" />
                                </div>
                                {unreadCount > 0 && (
                                    <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center">
                                        <span className="text-xs font-bold text-white">
                                            {unreadCount > 9 ? '9+' : unreadCount}
                                        </span>
                                    </div>
                                )}
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Notifications</h2>
                                <p className="text-sm text-gray-500">
                                    {unreadCount > 0 ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` : 'All caught up'}
                                </p>
                            </div>
                        </div>
                        
                        <button 
                            onClick={onClose} 
                            className="w-8 h-8 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center transition-colors"
                        >
                            <X className="w-4 h-4 text-gray-600" />
                        </button>
                    </div>
                    
                    {/* Action Cards */}
                    <div className="flex space-x-2">
                        {unreadCount > 0 && (
                            <div className="bg-oxford/5 rounded-lg p-3 flex-1">
                                <button 
                                    onClick={markAllAsRead}
                                    className="w-full flex items-center justify-center space-x-2 py-2 bg-oxford hover:bg-oxford-dark text-white rounded-md transition-colors text-sm font-medium"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Mark all read</span>
                                </button>
                            </div>
                        )}
                        
                        <div className="bg-gray-50 rounded-lg p-3 flex-1">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-medium text-gray-600">Total</span>
                                <span className="text-sm font-bold text-gray-900">{notifications.length}</span>
                            </div>
                            <div className="flex items-center justify-between mt-1">
                                <span className="text-xs font-medium text-gray-600">Unread</span>
                                <span className="text-sm font-bold text-red-600">{unreadCount}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Professional Notifications List */}
            <div className="flex-1 overflow-y-auto">
                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-gray-300 border-t-oxford rounded-full animate-spin mb-3"></div>
                        <p className="text-sm text-gray-500 font-medium">Loading notifications...</p>
                    </div>
                ) : notifications.length > 0 ? (
                    <div className="p-4 space-y-2">
                        {notifications.map((notification) => (
                            <div
                                key={notification.id}
                                className={cn(
                                    "bg-white border rounded-xl p-4 transition-all duration-200 cursor-pointer group hover:shadow-md",
                                    notification.is_read 
                                        ? "border-gray-200 hover:border-gray-300" 
                                        : "border-l-4 border-l-oxford bg-oxford/5 border-gray-200 hover:bg-oxford/10"
                                )}
                                onClick={() => !notification.is_read && markAsRead(notification.id)}
                            >
                                <div className="flex items-start space-x-3">
                                    {/* Icon Card */}
                                    <div className={cn(
                                        "flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center",
                                        notification.is_read 
                                            ? "bg-gray-100" 
                                            : "bg-oxford text-white"
                                    )}>
                                        {React.cloneElement(icons[notification.type] || icons.info, {
                                            className: cn("w-5 h-5", notification.is_read ? "text-gray-500" : "text-white")
                                        })}
                                    </div>
                                    
                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between mb-2">
                                            <div className="flex-1">
                                                <h3 className={cn(
                                                    "font-semibold text-sm leading-tight mb-1",
                                                    notification.is_read ? "text-gray-700" : "text-gray-900"
                                                )}>
                                                    {notification.title}
                                                </h3>
                                                
                                                <div className="flex items-center space-x-2">
                                                    {notification.sender_type === 'faculty' && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-oxford/10 text-oxford">
                                                            Faculty
                                                        </span>
                                                    )}
                                                    {!notification.is_read && (
                                                        <span className="inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium bg-blue-100 text-blue-800">
                                                            New
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            
                                            {/* Action Card */}
                                            <div className="ml-4">
                                                <button
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        deleteNotification(notification.id);
                                                    }}
                                                    className="opacity-0 group-hover:opacity-100 w-8 h-8 bg-red-50 hover:bg-red-100 rounded-lg flex items-center justify-center transition-all"
                                                >
                                                    <Trash2 className="w-4 h-4 text-red-600" />
                                                </button>
                                            </div>
                                        </div>
                                        
                                        <p className={cn(
                                            "text-sm mb-3",
                                            notification.is_read ? "text-gray-600" : "text-gray-700"
                                        )}>
                                            {notification.message}
                                        </p>
                                        
                                        {/* Time Card */}
                                        <div className="bg-gray-50 rounded-lg px-3 py-1 inline-block">
                                            <p className="text-xs text-gray-500 font-medium">
                                                {notification.time}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        
                        {/* Mobile Action Card */}
                        {unreadCount > 0 && (
                            <div className="pt-4 sm:hidden">
                                <div className="bg-oxford/5 rounded-xl p-4">
                                    <button
                                        onClick={markAllAsRead}
                                        className="w-full bg-oxford hover:bg-oxford-dark text-white py-3 rounded-lg font-medium flex items-center justify-center space-x-2 transition-colors"
                                    >
                                        <CheckCircle className="w-5 h-5" />
                                        <span>Mark All as Read</span>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="flex flex-col items-center justify-center py-20 px-4">
                        <div className="w-16 h-16 bg-gray-100 rounded-xl flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-gray-400" />
                        </div>
                        <div className="text-center">
                            <h3 className="text-lg font-medium text-gray-900 mb-2">No notifications</h3>
                            <p className="text-sm text-gray-500">
                                You're all caught up! New notifications will appear here.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}