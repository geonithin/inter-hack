import { X, Bell, Info, CheckCircle, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { useState, useEffect } from 'react';

export default function NotificationCenter({ isOpen, onClose }) {
    const [notifications, setNotifications] = useState([
        { id: 1, title: 'Registration Successful', message: 'Welcome to SMCE Hackathon! Your team "Alpha" is successfully registered.', type: 'success', time: '2h ago', isRead: false },
        { id: 2, title: 'Problem Statement Selection', message: 'Hurry up! 80% of problem statements are already selected.', type: 'warning', time: '1h ago', isRead: false },
        { id: 3, title: 'Submission Deadline', message: 'The idea submission deadline is Feb 10th, 11:59 PM.', type: 'info', time: '30m ago', isRead: true },
    ]);

    const icons = {
        success: <CheckCircle className="w-4 h-4 text-green-500" />,
        warning: <AlertTriangle className="w-4 h-4 text-amber-500" />,
        info: <Info className="w-4 h-4 text-oxford" />,
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-y-0 right-0 w-[280px] sm:w-[320px] bg-white shadow-2xl z-[60] border-l-4 border-oxford flex flex-col animate-in slide-in-from-right duration-300">
            <div className="bg-oxford text-white px-4 py-3 sm:py-4 flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                    <Bell className="w-4 h-4 sm:w-5 sm:h-5" />
                    <h2 className="text-sm sm:text-base font-black uppercase tracking-tighter">Notifications</h2>
                </div>
                <button onClick={onClose} className="hover:bg-white/10 p-1.5 rounded-lg transition-colors">
                    <X className="w-4 h-4 sm:w-5 sm:h-5" />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3">
                {notifications.length === 0 ? (
                    <div className="text-center py-20 text-oxford/40">
                        <Bell className="w-12 h-12 mx-auto mb-4 opacity-10" />
                        <p className="font-black uppercase text-[10px] tracking-widest">No active alerts</p>
                    </div>
                ) : (
                    notifications.map((n) => (
                        <div key={n.id} className={cn(
                            "p-2.5 border-2 rounded-xl transition-all hover:border-oxford group",
                            n.isRead ? "border-oxford/10 bg-gray-50/20" : "border-oxford/20 bg-white"
                        )}>
                            <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    {icons[n.type]}
                                    <h4 className="font-black text-oxford uppercase text-[10px] sm:text-[11px] leading-tight tracking-tight">{n.title}</h4>
                                </div>
                                {!n.isRead && <div className="w-1.5 h-1.5 rounded-full bg-oxford animate-pulse" />}
                            </div>
                            <p className="text-[10px] text-oxford/70 leading-relaxed font-bold pl-6">{n.message}</p>
                            <p className="text-[8px] font-black text-oxford/30 uppercase text-right tracking-widest mt-1.5">{n.time}</p>
                        </div>
                    ))
                )}
            </div>

            <div className="p-3 bg-gray-50 border-t-2 border-oxford/10">
                <button className="w-full py-3 bg-white border border-oxford/10 rounded-xl text-[9px] font-black text-oxford uppercase tracking-widest hover:bg-oxford hover:text-white transition-all shadow-sm active:scale-95">
                    Mark all current as read
                </button>
            </div>
        </div>
    );
}
