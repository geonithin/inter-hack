import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Filter, Lock, Clock, Users, ChevronRight, ChevronDown, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import SubmissionForm from '../components/SubmissionForm';
import { supabase } from '../lib/supabase';

export default function Dashboard() {
    const navigate = useNavigate();
    const [team, setTeam] = useState(null);
    const [problemStatements, setProblemStatements] = useState([]);
    const [selectedStatement, setSelectedStatement] = useState(null);
    const [isConfirming, setIsConfirming] = useState(null);
    const [hasSelected, setHasSelected] = useState(false);
    const [filterDept, setFilterDept] = useState('All');
    const [isLoading, setIsLoading] = useState(true);
    const [expandedRow, setExpandedRow] = useState(null);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (!user) {
                navigate('/login');
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

        checkUser();
    }, [navigate]);

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
        } catch (error) {
            console.error('Error updating selection:', error);
            alert('Failed to save selection. Please try again.');
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
                    <div key={i} className="bg-white p-4 sm:p-6 rounded-xl sm:rounded-2xl oxford-edge flex items-center justify-between shadow-lg">
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
                            "border-2 rounded-xl bg-white shadow-lg transition-all overflow-hidden",
                            isSelected ? "border-emerald-600 bg-emerald-50/10 ring-2 ring-emerald-500 ring-offset-1" : "border-oxford/10 hover:border-oxford/30"
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
        </div>
    );
}
