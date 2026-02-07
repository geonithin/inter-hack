import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Plus, Edit, Trash2, Users, FileCheck, AlertCircle, Calendar } from 'lucide-react';
import { cn } from '../lib/utils';

export default function AdminDashboard() {
    const navigate = useNavigate();

    useEffect(() => {
        const isLoggedIn = localStorage.getItem('isLoggedIn') === 'true';
        if (!isLoggedIn) {
            navigate('/login');
        }
    }, [navigate]);

    const [activeTab, setActiveTab] = useState('statements');

    const PROBLEM_DATA = [
        { id: 1, title: "AI Driven Traffic Management", dept: "CS", teams: 1, status: "Active" },
        { id: 2, title: "Blockchain for Academic Verifications", dept: "CS", teams: 2, status: "Active" },
        { id: 3, title: "Smart Agriculture IoT Node", dept: "EC", teams: 3, status: "Locked" },
    ];

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 sm:gap-6 border-b-2 sm:border-b-4 border-oxford pb-4 sm:pb-6">
                <div className="space-y-1 sm:space-y-2">
                    <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-oxford uppercase tracking-tighter text-shadow-sm">Admin Control</h1>
                    <p className="text-[10px] sm:text-sm text-oxford/60 font-bold uppercase tracking-[0.3em]">Event Management Suite</p>
                </div>

                <div className="flex gap-2 sm:gap-3">
                    <button className="bg-oxford text-white px-4 sm:px-6 py-2 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-sm uppercase tracking-widest flex items-center gap-2 hover:bg-oxford-dark transition-all shadow-xl active:scale-95">
                        <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> Add Problem
                    </button>
                    <button className="border-2 sm:border-4 border-oxford text-oxford px-4 sm:px-6 py-2 sm:py-3.5 rounded-xl sm:rounded-2xl font-black text-[10px] sm:text-sm uppercase tracking-widest flex items-center gap-2 hover:bg-gray-50 transition-all shadow-lg active:scale-95">
                        <Calendar className="w-4 h-4 sm:w-5 sm:h-5" /> Deadlines
                    </button>
                </div>
            </div>

            <div className="flex bg-gray-50 p-1 sm:p-2 rounded-xl sm:rounded-2xl border-2 border-oxford/10 w-fit">
                <button onClick={() => setActiveTab('statements')} className={cn("px-4 sm:px-8 py-2 sm:py-4 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-sm uppercase tracking-widest transition-all", activeTab === 'statements' ? "bg-oxford text-white shadow-xl" : "text-oxford/40")}>Problems</button>
                <button onClick={() => setActiveTab('submissions')} className={cn("px-4 sm:px-8 py-2 sm:py-4 rounded-lg sm:rounded-xl font-black text-[10px] sm:text-sm uppercase tracking-widest transition-all", activeTab === 'submissions' ? "bg-oxford text-white shadow-xl" : "text-oxford/40")}>Submissions</button>
            </div>

            {activeTab === 'statements' ? (
                <div className="grid grid-cols-1 gap-3 sm:gap-4">
                    {PROBLEM_DATA.map((item) => (
                        <div key={item.id} className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4 oxford-edge shadow-lg">
                            <div className="space-y-3">
                                <div className="flex items-center gap-2">
                                    <span className="text-[9px] font-black bg-oxford/10 text-oxford px-2 py-0.5 rounded-lg uppercase tracking-widest">{item.dept}</span>
                                    <span className={cn(
                                        "text-[9px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest",
                                        item.status === 'Locked' ? "bg-red-100 text-red-600" : "bg-green-100 text-green-600"
                                    )}>{item.status}</span>
                                </div>
                                <h4 className="text-base sm:text-xl font-black text-oxford uppercase tracking-tight">{item.title}</h4>
                                <p className="text-[9px] sm:text-xs text-oxford/60 flex items-center gap-2 font-black uppercase tracking-widest">
                                    <Users className="w-3.5 h-3.5" /> {item.teams}/3 TEAMS SELECTED
                                </p>
                            </div>
                            <div className="flex gap-2">
                                <button className="p-2.5 border-2 border-oxford/20 rounded-xl hover:border-oxford hover:bg-oxford/5 transition-all">
                                    <Edit className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-oxford" />
                                </button>
                                <button className="p-2.5 border-2 border-red-200 rounded-xl hover:border-red-500 hover:bg-red-50 transition-all">
                                    <Trash2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-red-500" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-6">
                    <div className="bg-oxford/5 p-4 rounded-xl flex items-center gap-3 border-2 border-oxford/10">
                        <AlertCircle className="w-5 h-5 text-oxford" />
                        <p className="text-xs sm:text-sm font-bold text-oxford tracking-tight">You have <span className="font-black underline">12 pending submissions</span> waiting for review.</p>
                    </div>

                    <div className="overflow-x-auto border-4 border-oxford rounded-3xl shadow-2xl bg-white">
                        <table className="w-full text-left">
                            <thead className="bg-oxford text-white border-b-4 border-oxford">
                                <tr className="text-[9px] sm:text-xs font-black uppercase tracking-[0.2em]">
                                    <th className="p-4 sm:p-5">Team</th>
                                    <th className="p-4 sm:p-5 border-l-2 border-white/10">Statement</th>
                                    <th className="p-4 sm:p-5 border-l-2 border-white/10">Status</th>
                                    <th className="p-4 sm:p-5 border-l-2 border-white/10">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-oxford/10">
                                {[1, 2, 3].map((i) => (
                                    <tr key={i} className="hover:bg-oxford/[0.02] transition-colors group">
                                        <td className="p-4 sm:p-6">
                                            <p className="font-black text-oxford uppercase text-xs sm:text-base tracking-tight group-hover:text-oxford-light">Team Alpha</p>
                                            <p className="text-[9px] sm:text-xs text-oxford/40 font-black uppercase tracking-[0.2em] mt-0.5">CS | 3rd Year</p>
                                        </td>
                                        <td className="p-4 sm:p-6 border-l-2 border-oxford/10">
                                            <p className="text-[10px] sm:text-sm font-black text-oxford uppercase tracking-tight line-clamp-2">AI Driven Traffic System</p>
                                        </td>
                                        <td className="p-6 sm:p-8 border-l-2 border-oxford/10">
                                            <div className="inline-flex items-center gap-2 px-4 py-2 bg-amber-50 text-amber-700 rounded-full border-2 border-amber-200">
                                                <div className="w-1.5 h-1.5 bg-amber-500 rounded-full animate-pulse" />
                                                <span className="text-[8px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap">Pending</span>
                                            </div>
                                        </td>
                                        <td className="p-6 sm:p-8 border-l-2 border-oxford/10">
                                            <button className="text-[10px] font-black text-white bg-oxford px-6 py-3 rounded-xl uppercase tracking-widest hover:bg-oxford-dark transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2 whitespace-nowrap">
                                                <FileCheck className="w-4 h-4" /> View
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
