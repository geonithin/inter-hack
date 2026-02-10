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
    
    // Submission tracking
    const [hasSubmittedIdea, setHasSubmittedIdea] = useState(false);
    const [submissionData, setSubmissionData] = useState(null);

    useEffect(() => {
        const loadDashboardData = async () => {
            // With protected routes, we can trust that user is authenticated
            if (!isAuthenticated() || !user) {
                return;
            }

            try {
                // Fetch all data in parallel to reduce loading time
                const [statementsResponse, teamResponse] = await Promise.all([
                    supabase
                        .from('problem_statements')
                        .select('*')
                        .eq('is_active', true)
                        .order('title'),
                    supabase
                        .from('teams')
                        .select('*')
                        .eq('lead_id', user.id)
                        .single()
                ]);

                const { data: statementsData, error: statementsError } = statementsResponse;
                const { data: teamData, error: teamError } = teamResponse;

                if (statementsError) {
                    console.error('Error fetching problem statements:', statementsError);
                } else {
                    // Get all team counts in a single query
                    const { data: teamCounts } = await supabase
                        .from('teams')
                        .select('selected_statement_id')
                        .not('selected_statement_id', 'is', null);

                    // Count teams per statement
                    const countMap = {};
                    teamCounts?.forEach(team => {
                        countMap[team.selected_statement_id] = (countMap[team.selected_statement_id] || 0) + 1;
                    });

                    // Add team count for each statement (much faster)
                    const statementsWithCounts = statementsData.map(statement => ({
                        ...statement,
                        teams: countMap[statement.id] || 0,
                        dept: statement.department
                    }));
                    
                    setProblemStatements(statementsWithCounts);

                    // Handle team data and check for submission
                    if (teamError) {
                        console.warn('Error fetching team:', teamError);
                        // Even if team fetch fails, try to get submissions
                        if (user?.id) {
                            const { data: userTeam } = await supabase
                                .from('teams')
                                .select('id')
                                .eq('lead_id', user.id)
                                .single();
                                
                            if (userTeam) {
                                const { data: submissions, error: submissionError } = await supabase
                                    .from('submissions')
                                    .select('*')
                                    .eq('team_id', userTeam.id)
                                    .limit(1);
                                    
                                if (submissionError) {
                                    console.warn('Error fetching submissions in fallback:', submissionError);
                                } else if (submissions && submissions.length > 0) {
                                    setHasSubmittedIdea(true);
                                    setSubmissionData(submissions[0]);
                                    console.log('Found submission despite team fetch error:', submissions[0]);
                                }
                            }
                        }
                    } else {
                        setTeam(teamData);
                        if (teamData.selected_statement_id) {
                            // Find the selected statement from fetched data
                            const statement = statementsWithCounts?.find(s => s.id === teamData.selected_statement_id);
                            setSelectedStatement(statement);
                        }
                        
                        // Check if team has already submitted their idea
                        const { data: submissions, error: submissionError } = await supabase
                            .from('submissions')
                            .select('*')
                            .eq('team_id', teamData.id)
                            .limit(1);
                            
                        if (submissionError) {
                            console.warn('Error fetching submissions:', submissionError);
                            if (submissionError.message?.includes('relation "submissions" does not exist')) {
                                console.error('⚠️ Submissions table missing. Please run the migration in Supabase SQL editor.');
                                showNotification('Database setup required: run submissions migration', 'warning');
                            }
                        } else if (submissions && submissions.length > 0) {
                            setHasSubmittedIdea(true);
                            setSubmissionData(submissions[0]);
                            console.log('Team has already submitted their idea:', submissions[0]);
                        }
                    }
                }
            } catch (error) {
                console.error('Error loading dashboard data:', error);
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

    // Fetch notifications - simplified without real-time
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

    // Simple notification refresh without WebSocket
    useEffect(() => {
        if (!user) return;

        // Initial fetch
        fetchNotifications();
        
        // Refresh notifications periodically 
        const interval = setInterval(fetchNotifications, 10000); // Every 10 seconds

        return () => {
            clearInterval(interval);
        };
    }, [user]);

    // Listen for global notification updates (when marked as read in other components)
    useEffect(() => {
        const handleNotificationUpdate = (event) => {
            console.log('Dashboard: Global notification update received:', event.detail);
            // Update the count immediately for faster UI response
            setUnreadCount(event.detail.unreadCount);
            // Also refetch notifications to get the latest read status
            fetchNotifications();
        };

        window.addEventListener('notificationUpdate', handleNotificationUpdate);
        
        return () => {
            window.removeEventListener('notificationUpdate', handleNotificationUpdate);
        };
    }, [user]); // Added user dependency so fetchNotifications is available

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
            <div className="max-w-6xl mx-auto space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-200">
                {/* Back Button */}
                <div className="flex justify-start mb-6">
                    <button
                        onClick={() => { setHasSelected(false); }}
                        className="text-[10px] sm:text-sm font-black text-oxford uppercase border-2 border-oxford px-4 py-2 rounded-xl hover:bg-oxford hover:text-white transition-all shadow-lg active:scale-95 tracking-widest bg-white"
                    >
                        ← Back to Problem Statements
                    </button>
                </div>

                {/* Enhanced Problem Statement View */}
                <div className="bg-gradient-to-br from-white to-gray-50 rounded-3xl border-2 border-oxford/15 shadow-xl hover:shadow-2xl transition-all p-8">
                    {/* Header */}
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 mb-8">
                        <div className="space-y-4">
                            <div className="flex items-center gap-4">
                                <span className="px-4 py-2 bg-oxford text-white text-sm font-black rounded-xl uppercase tracking-widest shadow-md">
                                    {selectedStatement.dept}
                                </span>
                                <div className="flex items-center gap-2 text-oxford/60 bg-oxford/5 px-3 py-2 rounded-xl">
                                    <Users className="w-5 h-5" />
                                    <span className="text-sm font-bold">Teams: {selectedStatement.teams}/{selectedStatement.max_teams}</span>
                                </div>
                            </div>
                            <h1 className="text-2xl sm:text-4xl font-black text-oxford leading-tight">
                                {selectedStatement.title}
                            </h1>
                            <div className="flex items-center gap-3">
                                {hasSubmittedIdea ? (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-green-100 border-2 border-green-300 rounded-xl">
                                        <CheckCircle className="w-5 h-5 text-green-600" />
                                        <span className="text-sm font-black text-green-700 uppercase tracking-widest">Submitted</span>
                                    </div>
                                ) : (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-amber-100 border-2 border-amber-300 rounded-xl">
                                        <AlertCircle className="w-5 h-5 text-amber-600" />
                                        <span className="text-sm font-black text-amber-700 uppercase tracking-widest">Ready to Submit</span>
                                    </div>
                                )}
                            </div>
                        </div>
                        
                        <div className="flex flex-col sm:flex-row gap-4">
                            {hasSubmittedIdea ? (
                                <button className="px-8 py-4 bg-oxford text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-oxford-dark transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3">
                                    <CheckCircle className="w-5 h-5" />
                                    View My Submission
                                </button>
                            ) : (
                                <button className="px-8 py-4 bg-oxford text-white font-black text-sm uppercase tracking-widest rounded-2xl hover:bg-oxford-dark transition-all shadow-lg active:scale-95 flex items-center justify-center gap-3">
                                    <Filter className="w-5 h-5" />
                                    Submit Your Idea
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Problem Description */}
                    <div className="bg-white rounded-2xl p-6 border border-oxford/10 shadow-sm">
                        <h3 className="text-lg font-black text-oxford uppercase tracking-wide mb-4">Problem Statement</h3>
                        <p className="text-oxford/80 text-base leading-relaxed">
                            {selectedStatement.description}
                        </p>
                    </div>

                    {/* Additional Information Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8">
                        <div className="bg-white rounded-xl p-6 border border-oxford/10 shadow-sm text-center">
                            <div className="w-12 h-12 bg-oxford/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Clock className="w-6 h-6 text-oxford" />
                            </div>
                            <h4 className="text-sm font-black text-oxford uppercase tracking-widest mb-2">Submission Deadline</h4>
                            <p className="text-oxford font-bold">48H 12M Remaining</p>
                        </div>
                        
                        <div className="bg-white rounded-xl p-6 border border-oxford/10 shadow-sm text-center">
                            <div className="w-12 h-12 bg-oxford/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Users className="w-6 h-6 text-oxford" />
                            </div>
                            <h4 className="text-sm font-black text-oxford uppercase tracking-widest mb-2">Team Participation</h4>
                            <p className="text-oxford font-bold">{selectedStatement.teams} out of {selectedStatement.max_teams}</p>
                        </div>
                        
                        <div className="bg-white rounded-xl p-6 border border-oxford/10 shadow-sm text-center">
                            <div className="w-12 h-12 bg-oxford/10 rounded-full flex items-center justify-center mx-auto mb-3">
                                <Filter className="w-6 h-6 text-oxford" />
                            </div>
                            <h4 className="text-sm font-black text-oxford uppercase tracking-widest mb-2">Department</h4>
                            <p className="text-oxford font-bold">{selectedStatement.dept} Track</p>
                        </div>
                    </div>
                </div>

                {/* Submission Details or Form */}
                {hasSubmittedIdea ? (
                    <div className="space-y-6 animate-in fade-in duration-300">
                        <div className="bg-green-50 border-2 border-green-200 p-6 rounded-2xl">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                                    <CheckCircle className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-lg font-black text-oxford uppercase">Your Idea Has Been Submitted!</h3>
                                    <p className="text-sm text-oxford/70">Submission is locked and under review by the faculty panel.</p>
                                </div>
                            </div>
                        </div>
                        
                        <div className="grid gap-6">
                            <div className="bg-white p-6 rounded-2xl border border-oxford/10 shadow-sm">
                                <h4 className="text-sm font-black text-oxford uppercase tracking-widest mb-3 opacity-60">Solution Title</h4>
                                <p className="text-oxford font-bold text-xl">{submissionData?.title}</p>
                            </div>
                            
                            <div className="bg-white p-6 rounded-2xl border border-oxford/10 shadow-sm">
                                <h4 className="text-sm font-black text-oxford uppercase tracking-widest mb-3 opacity-60">Solution Description</h4>
                                <p className="text-oxford/80 leading-relaxed">{submissionData?.description}</p>
                            </div>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-white p-6 rounded-2xl border border-oxford/10 shadow-sm">
                                    <h4 className="text-sm font-black text-oxford uppercase tracking-widest mb-3 opacity-60">Technologies Used</h4>
                                    <p className="text-oxford font-medium">{submissionData?.tech_stack}</p>
                                </div>
                                
                                {submissionData?.solution_link && (
                                    <div className="bg-white p-6 rounded-2xl border border-oxford/10 shadow-sm">
                                        <h4 className="text-sm font-black text-oxford uppercase tracking-widest mb-3 opacity-60">Project Link</h4>
                                        <a href={submissionData.solution_link} target="_blank" rel="noopener noreferrer" 
                                           className="text-oxford hover:text-oxford-dark underline font-medium break-all">
                                            {submissionData.solution_link}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <SubmissionForm
                        problemStatement={selectedStatement}
                        onCancel={() => { setHasSelected(false); }}
                        onSubmitSuccess={(submissionData) => {
                            setHasSubmittedIdea(true);
                            setSubmissionData(submissionData);
                            setHasSelected(false);
                            showNotification('Idea submitted successfully!', 'success');
                        }}
                    />
                )}
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-200">
            {/* Submission Status Notice */}
            {hasSubmittedIdea && (
                <div className="bg-green-50 border-2 border-green-200 p-4 rounded-xl animate-in fade-in duration-300">
                    <div className="flex items-center gap-3">
                        <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
                            <CheckCircle className="w-4 h-4 text-white" />
                        </div>
                        <div>
                            <h3 className="font-black text-oxford text-sm uppercase">Idea Submitted Successfully!</h3>
                            <p className="text-xs text-oxford/70">Your submission is locked. You can view but not select other problem statements.</p>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="oxford-edge rounded-2xl space-y-6 bg-white shadow-lg hover:shadow-xl transition-all p-6 mb-8">
                <div className="text-center space-y-3">
                    <h1 className="text-2xl sm:text-3xl font-black text-oxford uppercase tracking-tighter">Problem Statement Selection</h1>
                    <p className="text-[10px] sm:text-xs text-oxford/40 font-black uppercase tracking-[0.2em]">Choose your innovation track to proceed</p>
                </div>
                
                <div className="flex items-center justify-center gap-8">
                    <div className="text-center">
                        <p className="text-[9px] font-black text-oxford/40 uppercase tracking-widest mb-1">Status</p>
                        <p className="text-sm font-black text-oxford uppercase">
                            {selectedStatement ? "Track Selected ✓" : "Selection Pending"}
                        </p>
                    </div>
                    <div className="w-px h-8 bg-oxford/10"></div>
                    <div className="text-center">
                        <p className="text-[9px] font-black text-oxford/40 uppercase tracking-widest mb-1">Deadline</p>
                        <p className="text-sm font-black text-oxford uppercase">48H 12M</p>
                    </div>
                </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8">
                {[
                    { label: "Current Status", value: "Registered", icon: Users },
                    { label: "Track choice", value: selectedStatement ? "Selected" : "Pending", icon: Filter },
                    { label: "Submission", value: hasSubmittedIdea ? "✓ Submitted" : selectedStatement ? "Ready" : "Not Started", icon: Search },
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

            {/* Problem Statements Grid */}
            <div className="grid gap-4">
                {filteredStatements.map((statement) => {
                    const isSelected = selectedStatement?.id === statement.id;
                    const isFull = statement.teams >= statement.max_teams;
                    const isExpanded = expandedRow === statement.id;

                    return (
                        <div key={statement.id} className={cn(
                            "bg-white rounded-2xl border-3 shadow-md hover:shadow-lg transition-all duration-200 overflow-hidden",
                            isSelected 
                                ? "border-emerald-500 bg-gradient-to-r from-emerald-50 to-white" 
                                : "border-gray-200 hover:border-oxford/30"
                        )}>
                            {/* Card Content */}
                            <div className="p-6">
                                <div className="flex items-center justify-between">
                                    
                                    {/* Left Section */}
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="flex items-center gap-3">
                                            <span className={cn(
                                                "px-3 py-1.5 text-sm font-black rounded-lg uppercase tracking-wider",
                                                isSelected 
                                                    ? "bg-emerald-500 text-white" 
                                                    : isFull 
                                                        ? "bg-red-500 text-white" 
                                                        : "bg-oxford text-white"
                                            )}>
                                                {statement.dept}
                                            </span>
                                            
                                            {isSelected && (
                                                <div className="p-1 bg-emerald-100 rounded-full">
                                                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                                                </div>
                                            )}
                                        </div>
                                        
                                        <h3 className={cn(
                                            "text-lg sm:text-xl font-bold flex-1 line-clamp-1",
                                            isSelected ? "text-emerald-700" : "text-oxford"
                                        )}>
                                            {statement.title}
                                        </h3>
                                    </div>
                                    
                                    {/* Right Section */}
                                    <div className="flex items-center gap-6">
                                        <div className="flex items-center gap-2 text-oxford/70">
                                            <Users className="w-5 h-5" />
                                            <span className="font-bold text-sm">
                                                {statement.teams}/{statement.max_teams}
                                            </span>
                                        </div>
                                        
                                        {/* Action Button */}
                                        <div className="flex items-center gap-3">
                                            {!isFull || isSelected ? (
                                                hasSubmittedIdea && isSelected ? (
                                                    <button
                                                        onClick={() => setHasSelected(true)}
                                                        className="px-6 py-2.5 bg-emerald-500 text-white font-bold text-sm uppercase tracking-wider rounded-xl hover:bg-emerald-600 transition-all shadow-md flex items-center gap-2"
                                                    >
                                                        View Submission
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            if (isSelected) {
                                                                setHasSelected(true);
                                                            } else {
                                                                handleSelect(statement);
                                                            }
                                                        }}
                                                        className={cn(
                                                            "px-6 py-2.5 font-bold text-sm uppercase tracking-wider rounded-xl transition-all shadow-md flex items-center gap-2",
                                                            isSelected
                                                                ? "bg-emerald-500 text-white hover:bg-emerald-600"
                                                                : "bg-oxford text-white hover:bg-oxford-dark"
                                                        )}
                                                    >
                                                        {isSelected ? "Submit Idea" : selectedStatement ? "Switch Track" : "Select Track"}
                                                        <ChevronRight className="w-4 h-4" />
                                                    </button>
                                                )
                                            ) : (
                                                <div className="px-6 py-2.5 bg-gray-100 text-gray-500 font-bold text-sm uppercase tracking-wider rounded-xl flex items-center gap-2">
                                                    <Lock className="w-4 h-4" />
                                                    Full
                                                </div>
                                            )}
                                            
                                            <button
                                                onClick={() => setExpandedRow(isExpanded ? null : statement.id)}
                                                className="p-2 text-oxford/70 hover:text-oxford hover:bg-oxford/5 rounded-lg transition-all"
                                            >
                                                {isExpanded ? (
                                                    <ChevronDown className="w-5 h-5" />
                                                ) : (
                                                    <ChevronRight className="w-5 h-5" />
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Expandable Content */}
                            {isExpanded && (
                                <div className="border-t border-gray-100 bg-gray-50/30 p-6 animate-in slide-in-from-top-2 duration-200">
                                    <div className="space-y-4">
                                        <h4 className="text-oxford font-bold text-lg">Problem Description</h4>
                                        <p className="text-oxford/80 leading-relaxed text-sm">
                                            {statement.description}
                                        </p>
                                        <div className="flex gap-4 pt-2">
                                            <div className="text-sm">
                                                <span className="font-bold text-oxford">Department:</span> 
                                                <span className="text-oxford/70 ml-1">{statement.dept}</span>
                                            </div>
                                            <div className="text-sm">
                                                <span className="font-bold text-oxford">Available Spots:</span> 
                                                <span className="text-oxford/70 ml-1">{statement.max_teams - statement.teams}</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            {/* Confirmation Modal */}
            {isConfirming && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-100 flex items-center justify-center p-4">
                    <div className="bg-white max-w-lg w-full rounded-3xl shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
                        
                        {/* Header */}
                        <div className="bg-gradient-to-r from-oxford to-oxford-dark p-6 text-white">
                            <div className="flex items-center gap-4">
                                <div className="p-3 bg-white/20 rounded-full">
                                    <Filter className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black uppercase tracking-tight">
                                        {selectedStatement ? "Switch Track" : "Confirm Selection"}
                                    </h3>
                                    <p className="text-sm text-white/80 font-medium">
                                        {selectedStatement ? "Change your problem statement" : "Choose this problem statement"}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div className="p-6 space-y-6">
                            {/* Current vs New Selection */}
                            {selectedStatement ? (
                                <div className="space-y-4">
                                    <div className="flex items-center gap-4">
                                        <div className="flex-1 bg-gray-50 rounded-xl p-4 border-2 border-gray-200">
                                            <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mb-1">Current</p>
                                            <p className="text-sm font-black text-gray-700 line-clamp-2">{selectedStatement.title}</p>
                                        </div>
                                        <div className="p-2">
                                            <ChevronRight className="w-5 h-5 text-oxford" />
                                        </div>
                                        <div className="flex-1 bg-oxford/5 rounded-xl p-4 border-2 border-oxford/20">
                                            <p className="text-xs font-bold text-oxford uppercase tracking-widest mb-1">New</p>
                                            <p className="text-sm font-black text-oxford line-clamp-2">{isConfirming.title}</p>
                                        </div>
                                    </div>
                                    <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
                                        <div className="flex items-start gap-3">
                                            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" />
                                            <div>
                                                <p className="text-sm font-bold text-blue-900 mb-1">Track Switch Notice</p>
                                                <p className="text-xs text-blue-700">Your current selection will be replaced. Any work related to your previous selection may need adjustment.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center space-y-4">
                                    <div className="bg-oxford/5 rounded-2xl p-6 border-2 border-oxford/10">
                                        <h4 className="text-lg font-black text-oxford mb-2">{isConfirming.title}</h4>
                                        <p className="text-sm text-oxford/70">Department: <span className="font-bold">{isConfirming.dept}</span></p>
                                        <p className="text-sm text-oxford/70">Available spots: <span className="font-bold">{isConfirming.max_teams - isConfirming.teams}</span></p>
                                    </div>
                                    <p className="text-sm text-oxford/80 font-medium">
                                        Ready to work on this problem statement?
                                    </p>
                                </div>
                            )}

                            {/* Action Buttons */}
                            <div className="flex gap-3 pt-4">
                                <button
                                    onClick={() => setIsConfirming(null)}
                                    className="flex-1 py-3 px-4 border-2 border-oxford text-oxford font-black uppercase text-sm tracking-widest rounded-xl hover:bg-oxford/5 active:scale-95 transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmSelection}
                                    className="flex-1 py-3 px-4 bg-oxford text-white font-black uppercase text-sm tracking-widest rounded-xl hover:bg-oxford-dark flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all"
                                >
                                    <CheckCircle className="w-4 h-4" />
                                    {selectedStatement ? "Switch" : "Confirm"}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Floating Notification Bell - Only show when there are unread notifications */}
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
                    "fixed bottom-6 left-6 z-100 p-4 rounded-xl shadow-2xl border-2 animate-in slide-in-from-bottom-4 fade-in duration-300 max-w-sm",
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
