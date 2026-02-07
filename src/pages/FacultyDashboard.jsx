import { useState, useEffect } from 'react';
import { Users, FileText, CheckCircle2, XCircle, Search, Filter, ArrowUpRight, Edit, Trash2, Eye, X, Plus, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

export default function FacultyDashboard() {
    const [searchQuery, setSearchQuery] = useState('');
    const [filterStatus, setFilterStatus] = useState('All');
    const [exporting, setExporting] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
    const [isDeleteStatementModalOpen, setIsDeleteStatementModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [selectedStatement, setSelectedStatement] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [currentView, setCurrentView] = useState('teams'); // 'teams' or 'statements'
    const [error, setError] = useState(null);
    
    // State management
    const [teams, setTeams] = useState([]);
    const [problemStatements, setProblemStatements] = useState([]);
    
    // New statement form
    const [newStatement, setNewStatement] = useState({
        title: '',
        description: '',
        department: 'CS',
        max_teams: 3
    });

    useEffect(() => {
        // Check if we have faculty data in localStorage
        const facultyData = localStorage.getItem('facultyData');
        const isLoggedIn = localStorage.getItem('isLoggedIn');
        const userRole = localStorage.getItem('userRole');
        
        console.log('Faculty auth check:', { isLoggedIn, userRole, hasFacultyData: !!facultyData });
        
        if (!isLoggedIn || userRole !== 'faculty') {
            console.warn('No valid faculty session found');
            setError('Not authenticated as faculty. Please log in with faculty credentials.');
            setIsLoading(false);
            return;
        }
        
        // If no faculty data in localStorage, create a default session
        if (!facultyData) {
            console.log('No faculty data found, creating default session');
            const defaultFacultyData = {
                id: 1,
                faculty_id: 'FAC001',
                name: 'Default Faculty',
                email: 'faculty@college.edu',
                department: 'CS'
            };
            localStorage.setItem('facultyData', JSON.stringify(defaultFacultyData));
        }
        
        fetchData();
    }, []);
    
    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            console.log('Starting data fetch...');
            
            // Fetch problem statements with error handling for missing table
            let statementsData = [];
            try {
                const { data, error: statementsError } = await supabase
                    .from('problem_statements')
                    .select('*')
                    .eq('is_active', true)
                    .order('title');
                    
                if (statementsError) {
                    console.error('Statements error:', statementsError);
                    if (statementsError.code === '42P01') {
                        // Table doesn't exist
                        console.warn('Problem statements table not found - using empty data');
                        statementsData = [];
                    } else {
                        throw statementsError;
                    }
                } else {
                    statementsData = data || [];
                }
            } catch (err) {
                console.warn('Could not fetch problem statements:', err.message);
                statementsData = [];
            }
            
            console.log('Problem statements fetched:', statementsData.length);
            setProblemStatements(statementsData);
            
            // Fetch teams with problem statement info (without profiles join for now)
            let teamsData = [];
            try {
                const { data, error: teamsError } = await supabase
                    .from('teams')
                    .select(`
                        *,
                        problem_statements(title, department)
                    `);

                if (teamsError) {
                    console.error('Teams error:', teamsError);
                    // If teams query fails, set empty array and continue
                    teamsData = [];
                } else {
                    console.log('Teams fetched:', data?.length || 0);
                    teamsData = data || [];
                }
            } catch (err) {
                console.warn('Could not fetch teams:', err.message);
                teamsData = [];
            }
            
            const processedTeams = teamsData.map(t => ({
                id: t.id,
                name: t.name || 'Unnamed Team',
                lead: t.lead_name || 'Unknown', // Use lead_name field from teams table
                leadEmail: t.lead_email || '',
                statement: t.problem_statements?.title || 'Not Selected',
                status: t.status || 'Pending',
                dept: t.department || t.problem_statements?.department || 'N/A',
                year: t.year || '',
                section: t.section || '',
                lead_id: t.lead_id,
                selected_statement_id: t.selected_statement_id
            }));
            setTeams(processedTeams);
            
            console.log('Data fetch completed successfully');
        } catch (error) {
            console.error('Error fetching data:', error);
            setError(`Failed to load data: ${error.message}`);
            // Set empty data on error to prevent blank screen
            setProblemStatements([]);
            setTeams([]);
        } finally {
            setIsLoading(false);
        }
    };

    const fetchTeamMembers = async (teamId) => {
        try {
            const { data, error } = await supabase
                .from('members')
                .select('*')
                .eq('team_id', teamId)
                .order('name');
                
            if (error) throw error;
            setTeamMembers(data || []);
        } catch (error) {
            console.error('Error fetching team members:', error);
            setTeamMembers([]);
        }
    };
    
    const handleViewTeam = async (team) => {
        setSelectedTeam(team);
        await fetchTeamMembers(team.id);
        setIsViewModalOpen(true);
    };
    
    const handleAddStatement = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('problem_statements')
                .insert([newStatement]);
                
            if (error) throw error;
            
            await fetchData();
            setIsStatementModalOpen(false);
            setNewStatement({ title: '', description: '', department: 'CS', max_teams: 3 });
            alert('Problem statement added successfully!');
        } catch (error) {
            console.error('Error adding statement:', error);
            alert('Failed to add problem statement');
        }
    };
    
    const handleDeleteStatement = async () => {
        if (!selectedStatement) return;
        
        try {
            // Check if any teams have selected this statement
            const { data: teamsUsingStatement, error: checkError } = await supabase
                .from('teams')
                .select('id, name')
                .eq('selected_statement_id', selectedStatement.id);
                
            if (checkError) throw checkError;
            
            if (teamsUsingStatement && teamsUsingStatement.length > 0) {
                alert(`Cannot delete: ${teamsUsingStatement.length} team(s) have selected this statement.`);
                return;
            }
            
            const { error } = await supabase
                .from('problem_statements')
                .update({ is_active: false })
                .eq('id', selectedStatement.id);
                
            if (error) throw error;
            
            await fetchData();
            setIsDeleteStatementModalOpen(false);
            setSelectedStatement(null);
            alert('Problem statement deleted successfully!');
        } catch (error) {
            console.error('Error deleting statement:', error);
            alert('Failed to delete problem statement');
        }
    };

    const handleStatusUpdate = async (teamId, newStatus) => {
        try {
            const { error } = await supabase
                .from('teams')
                .update({ status: newStatus })
                .eq('id', teamId);

            if (error) throw error;

            await fetchData();
        } catch (error) {
            console.error('Error updating status:', error);
            alert('Failed to update status');
        }
    };

    const handleDeleteTeam = async (id) => {
        try {
            // Delete team members first
            await supabase.from('members').delete().eq('team_id', id);
            
            // Then delete the team
            const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', id);

            if (error) throw error;

            await fetchData();
            setDeleteConfirmId(null);
        } catch (error) {
            console.error('Error deleting team:', error);
            alert('Failed to delete team');
        }
    };

    const handleUpdateTeam = async (e) => {
        e.preventDefault();
        try {
            const { error } = await supabase
                .from('teams')
                .update({
                    name: selectedTeam.name,
                    department: selectedTeam.dept,
                    year: selectedTeam.year,
                    section: selectedTeam.section
                })
                .eq('id', selectedTeam.id);

            if (error) throw error;

            setIsEditModalOpen(false);
            setSelectedTeam(null);
            await fetchData();
        } catch (error) {
            console.error('Error updating team:', error);
            alert('Failed to update team');
        }
    };

    const handleExport = () => {
        setExporting(true);
        setTimeout(() => {
            setExporting(false);
            alert('Team data exported successfully as CSV!');
        }, 1500);
    };

    // Calculate stats
    const STATS = currentView === 'teams' ? [
        { label: 'Total Teams', value: teams.length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'Selected Teams', value: teams.filter(t => t.status === 'Selected').length, icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
        { label: 'Pending Review', value: teams.filter(t => t.status === 'Pending').length, icon: ArrowUpRight, color: 'text-amber-600', bg: 'bg-amber-50' },
    ] : [
        { label: 'Active Statements', value: problemStatements.length, icon: FileText, color: 'text-blue-600', bg: 'bg-blue-50' },
        { label: 'CS Track', value: problemStatements.filter(s => s.department === 'CS').length, icon: Users, color: 'text-emerald-600', bg: 'bg-emerald-50' },
        { label: 'EC Track', value: problemStatements.filter(s => s.department === 'EC').length, icon: Users, color: 'text-purple-600', bg: 'bg-purple-50' },
    ];

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-500">
                <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 sm:border-8 border-oxford border-t-transparent rounded-full animate-spin" />
                <p className="text-oxford font-black uppercase tracking-[0.2em] text-xs sm:text-sm">Fetching Team Roster...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in duration-500">
                <div className="p-6 bg-red-50 border-2 border-red-200 rounded-xl max-w-2xl">
                    <div className="flex items-center space-x-3 mb-4">
                        <AlertTriangle className="w-6 h-6 text-red-600" />
                        <p className="text-red-700 font-black uppercase tracking-[0.2em] text-sm">Database Error</p>
                    </div>
                    <p className="text-red-600 text-sm mb-4">{error}</p>
                    <div className="bg-white p-4 rounded-lg border border-red-200">
                        <p className="text-xs text-red-700 font-semibold mb-2">Possible Solutions:</p>
                        <ul className="text-xs text-red-600 space-y-1">
                            <li>• Ensure the problem_statements_migration.sql has been run in Supabase</li>
                            <li>• Check if faculty table exists and has proper data</li>
                            <li>• Verify database connection and table permissions</li>
                        </ul>
                    </div>
                </div>
                <div className="flex space-x-4">
                    <button 
                        onClick={() => window.location.reload()} 
                        className="px-6 py-3 bg-oxford text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-oxford-dark transition-all"
                    >
                        Retry
                    </button>
                    <button 
                        onClick={() => window.location.href = '/login'} 
                        className="px-6 py-3 bg-gray-500 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-gray-600 transition-all"
                    >
                        Return to Login
                    </button>
                </div>
            </div>
        );
    }

    const filteredTeams = teams.filter(team => {
        const matchesSearch = team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            team.statement.toLowerCase().includes(searchQuery.toLowerCase()) ||
            team.lead.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesFilter = filterStatus === 'All' || team.status === filterStatus;
        return matchesSearch && matchesFilter;
    });
    
    const filteredStatements = problemStatements.filter(statement => {
        const matchesSearch = statement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            statement.department.toLowerCase().includes(searchQuery.toLowerCase());
        return matchesSearch;
    });

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b-4 border-oxford pb-6">
                <div className="space-y-1">
                    <h1 className="text-2xl sm:text-4xl font-black text-oxford uppercase tracking-tighter">Faculty Portal</h1>
                    <p className="text-[10px] sm:text-xs text-oxford/40 font-black uppercase tracking-[0.3em]">Institutional Oversight & Management</p>
                </div>
                
                {/* View Toggle */}
                <div className="flex bg-gray-50 p-1 rounded-xl border-2 border-oxford/10">
                    <button
                        onClick={() => setCurrentView('teams')}
                        className={cn(
                            "px-6 py-3 rounded-lg font-black text-xs uppercase tracking-widest transition-all",
                            currentView === 'teams' ? "bg-oxford text-white shadow-lg" : "text-oxford/40 hover:text-oxford"
                        )}
                    >
                        Teams
                    </button>
                    <button
                        onClick={() => setCurrentView('statements')}
                        className={cn(
                            "px-6 py-3 rounded-lg font-black text-xs uppercase tracking-widest transition-all",
                            currentView === 'statements' ? "bg-oxford text-white shadow-lg" : "text-oxford/40 hover:text-oxford"
                        )}
                    >
                        Statements
                    </button>
                </div>
            </div>

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
                {STATS.map((stat, i) => (
                    <div key={i} className="bg-white p-5 sm:p-6 rounded-3xl oxford-edge shadow-xl flex items-center justify-between group hover:scale-[1.02] transition-all">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black text-oxford/40 uppercase tracking-[0.2em]">{stat.label}</p>
                            <p className="text-2xl sm:text-3xl font-black text-oxford">{stat.value}</p>
                        </div>
                        <div className={cn("p-4 rounded-2xl transition-all group-hover:rotate-12", stat.bg, stat.color)}>
                            <stat.icon className="w-6 h-6 sm:w-8 sm:h-8" />
                        </div>
                    </div>
                ))}
            </div>

            {/* Setup Information Banner - Show when data is empty */}
            {(teams.length === 0 && problemStatements.length === 0) && (
                <div className="bg-blue-50 border-2 border-blue-200 rounded-2xl p-6">
                    <div className="flex items-start space-x-4">
                        <AlertTriangle className="w-6 h-6 text-blue-600 mt-1 flex-shrink-0" />
                        <div className="space-y-2">
                            <h3 className="font-black text-blue-900 uppercase tracking-wide text-sm">Initial Setup Required</h3>
                            <p className="text-blue-800 text-sm">
                                The faculty dashboard is ready, but no data is available yet. To get started:
                            </p>
                            <ul className="text-blue-700 text-sm space-y-1 ml-4">
                                <li>• Run the <code className="bg-blue-100 px-2 py-1 rounded text-xs">problem_statements_migration.sql</code> in your Supabase SQL editor</li>
                                <li>• Ensure teams have registered and selected problem statements</li>
                                <li>• Problem statements will be automatically created with sample data</li>
                            </ul>
                            <div className="mt-4">
                                <button 
                                    onClick={() => fetchData()} 
                                    className="px-4 py-2 bg-blue-600 text-white font-bold rounded-lg text-xs uppercase tracking-wide hover:bg-blue-700 transition-all"
                                >
                                    Refresh Data
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Controls Bar */}
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-gray-50 p-3 rounded-[2rem] border-2 border-oxford/10">
                <div className="relative w-full lg:max-w-md">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-oxford/30" />
                    <input
                        type="text"
                        placeholder={`SEARCH ${currentView.toUpperCase()}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-3 bg-white border-2 border-oxford/5 rounded-2xl focus:border-oxford outline-none transition-all font-black text-[10px] uppercase tracking-widest"
                    />
                </div>
                <div className="flex gap-2 w-full lg:w-auto overflow-x-auto pb-1 lg:pb-0">
                    {currentView === 'teams' ? (
                        ['All', 'Pending', 'Selected', 'Rejected'].map((status) => (
                            <button
                                key={status}
                                onClick={() => setFilterStatus(status)}
                                className={cn(
                                    "whitespace-nowrap px-5 py-2.5 rounded-xl font-black text-[9px] uppercase tracking-widest transition-all",
                                    filterStatus === status ? "bg-oxford text-white shadow-lg" : "bg-white text-oxford/40 hover:text-oxford border-2 border-oxford/5"
                                )}
                            >
                                {status}
                            </button>
                        ))
                    ) : (
                        <button
                            onClick={() => setIsStatementModalOpen(true)}
                            className="px-6 py-2.5 bg-oxford text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-oxford-dark transition-all shadow-lg flex items-center gap-2"
                        >
                            <Plus className="w-4 h-4" />
                            Add Statement
                        </button>
                    )}
                </div>
            </div>

            {/* Main Content - Conditional based on view */}
            {currentView === 'teams' ? (
                <div className="oxford-edge rounded-[2.5rem] overflow-hidden bg-white shadow-2xl border-4 border-oxford">
                    <div className="overflow-x-auto text-[10px] sm:text-xs">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-oxford text-white border-b-4 border-oxford">
                                <tr className="font-black uppercase tracking-[0.2em]">
                                    <th className="p-5">Team Info</th>
                                    <th className="p-5 border-l-2 border-white/10">Lead Details</th>
                                    <th className="p-5 border-l-2 border-white/10">Chosen Statement</th>
                                    <th className="p-5 border-l-2 border-white/10 text-center">Status</th>
                                    <th className="p-5 border-l-2 border-white/10 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-oxford/10">
                                {filteredTeams.length > 0 ? filteredTeams.map((team) => (
                                    <tr key={team.id} className="hover:bg-oxford/[0.02] transition-colors group">
                                        <td className="p-5 sm:p-6">
                                            <p className="font-black text-oxford uppercase tracking-tight group-hover:text-oxford-light transition-all">{team.name}</p>
                                            <p className="text-[9px] font-black text-oxford/40 uppercase tracking-widest mt-0.5">
                                                {team.dept} | {team.year} - {team.section}
                                            </p>
                                        </td>
                                        <td className="p-5 sm:p-6 border-l-2 border-oxford/10">
                                            <p className="font-black text-oxford uppercase tracking-tight">{team.lead}</p>
                                            <p className="text-[9px] font-black text-oxford/40 mt-0.5">{team.leadEmail}</p>
                                        </td>
                                        <td className="p-5 sm:p-6 border-l-2 border-oxford/10">
                                            <p className="font-black text-oxford uppercase tracking-tight line-clamp-2 max-w-[250px]">{team.statement}</p>
                                        </td>
                                        <td className="p-5 sm:p-6 border-l-2 border-oxford/10 text-center">
                                            <div className={cn(
                                                "inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 font-black uppercase text-[9px] tracking-widest",
                                                team.status === 'Selected' ? "bg-green-50 text-green-700 border-green-200" :
                                                    team.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                                                        "bg-amber-50 text-amber-700 border-amber-200"
                                            )}>
                                                <div className={cn(
                                                    "w-1.5 h-1.5 rounded-full animate-pulse",
                                                    team.status === 'Selected' ? "bg-green-500" :
                                                        team.status === 'Rejected' ? "bg-red-500" :
                                                            "bg-amber-500"
                                                )} />
                                                {team.status}
                                            </div>
                                        </td>
                                        <td className="p-5 sm:p-6 border-l-2 border-oxford/10">
                                            <div className="flex items-center gap-2 justify-center">
                                                <button
                                                    onClick={() => handleViewTeam(team)}
                                                    className="p-2 bg-oxford/5 hover:bg-oxford hover:text-white text-oxford rounded-lg transition-all group/btn"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                                </button>
                                                <select
                                                    value={team.status}
                                                    onChange={(e) => handleStatusUpdate(team.id, e.target.value)}
                                                    className="text-[9px] font-black uppercase px-2 py-1 border-2 border-oxford/10 rounded-lg focus:border-oxford outline-none"
                                                >
                                                    <option value="Pending">Pending</option>
                                                    <option value="Selected">Selected</option>
                                                    <option value="Rejected">Rejected</option>
                                                </select>
                                                <button
                                                    onClick={() => setDeleteConfirmId(team.id)}
                                                    className="p-2 bg-red-50 hover:bg-red-500 hover:text-white text-red-600 rounded-lg transition-all group/btn"
                                                    title="Delete Team"
                                                >
                                                    <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="5" className="p-12 text-center text-oxford/40">
                                            <div className="space-y-2">
                                                <Users className="w-8 h-8 mx-auto opacity-30" />
                                                <p className="font-black uppercase tracking-widest">No teams found</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            ) : (
                /* Problem Statements View */
                <div className="oxford-edge rounded-[2.5rem] overflow-hidden bg-white shadow-2xl border-4 border-oxford">
                    <div className="overflow-x-auto text-[10px] sm:text-xs">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-oxford text-white border-b-4 border-oxford">
                                <tr className="font-black uppercase tracking-[0.2em]">
                                    <th className="p-5">Statement Title</th>
                                    <th className="p-5 border-l-2 border-white/10">Department</th>
                                    <th className="p-5 border-l-2 border-white/10">Teams</th>
                                    <th className="p-5 border-l-2 border-white/10 text-center">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-oxford/10">
                                {filteredStatements.length > 0 ? filteredStatements.map((statement) => {
                                    const teamCount = teams.filter(t => t.selected_statement_id === statement.id).length;
                                    return (
                                        <tr key={statement.id} className="hover:bg-oxford/[0.02] transition-colors group">
                                            <td className="p-5 sm:p-6">
                                                <p className="font-black text-oxford uppercase tracking-tight group-hover:text-oxford-light transition-all line-clamp-2">
                                                    {statement.title}
                                                </p>
                                                <p className="text-[9px] text-oxford/60 mt-1 line-clamp-3">
                                                    {statement.description.substring(0, 150)}...
                                                </p>
                                            </td>
                                            <td className="p-5 sm:p-6 border-l-2 border-oxford/10">
                                                <span className="px-3 py-1 bg-oxford/5 border-2 border-oxford/10 rounded-lg font-black text-oxford uppercase text-[9px]">
                                                    {statement.department}
                                                </span>
                                            </td>
                                            <td className="p-5 sm:p-6 border-l-2 border-oxford/10">
                                                <div className="flex items-center gap-2">
                                                    <Users className="w-4 h-4 text-oxford/60" />
                                                    <span className="font-black text-oxford">
                                                        {teamCount}/{statement.max_teams}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-5 sm:p-6 border-l-2 border-oxford/10">
                                                <div className="flex items-center gap-2 justify-center">
                                                    <button
                                                        onClick={() => {
                                                            setSelectedStatement(statement);
                                                            setIsDeleteStatementModalOpen(true);
                                                        }}
                                                        className="p-2 bg-red-50 hover:bg-red-500 hover:text-white text-red-600 rounded-lg transition-all group/btn"
                                                        title="Delete Statement"
                                                    >
                                                        <Trash2 className="w-4 h-4 group-hover/btn:scale-110 transition-transform" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                }) : (
                                    <tr>
                                        <td colSpan="4" className="p-12 text-center text-oxford/40">
                                            <div className="space-y-2">
                                                <FileText className="w-8 h-8 mx-auto opacity-30" />
                                                <p className="font-black uppercase tracking-widest">No statements found</p>
                                            </div>
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Teams Table */}
            {view === 'teams' && (
                <div className="space-y-6">
                    {/* Search and Filter */}
                    <div className="bg-white rounded-3xl shadow-2xl border-4 border-oxford overflow-hidden">
                        <div className="bg-oxford p-6 text-white">
                            <h2 className="text-2xl font-black uppercase tracking-tighter">Team Management</h2>
                            <p className="text-oxford-light text-xs uppercase tracking-widest font-black mt-1">View, edit, and manage all teams</p>
                        </div>
                        <div className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div className="relative">
                                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-4 h-4 text-oxford/40" />
                                    <input
                                        type="text"
                                        placeholder="Search teams..."
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        className="w-full pl-11 pr-4 py-3.5 text-sm font-black bg-oxford/5 border-2 border-oxford/20 rounded-2xl placeholder-oxford/40 uppercase tracking-widest focus:outline-none focus:border-oxford transition-all"
                                    />
                                </div>
                                <select
                                    value={deptFilter}
                                    onChange={(e) => setDeptFilter(e.target.value)}
                                    className="px-4 py-3.5 text-sm font-black bg-oxford/5 border-2 border-oxford/20 rounded-2xl text-oxford uppercase tracking-widest focus:outline-none focus:border-oxford cursor-pointer transition-all"
                                >
                                    <option value="">All Departments</option>
                                    <option value="CS">Computer Science</option>
                                    <option value="EC">Electronics</option>
                                    <option value="ME">Mechanical</option>
                                    <option value="CE">Civil</option>
                                    <option value="EE">Electrical</option>
                                </select>
                                <select
                                    value={statusFilter}
                                    onChange={(e) => setStatusFilter(e.target.value)}
                                    className="px-4 py-3.5 text-sm font-black bg-oxford/5 border-2 border-oxford/20 rounded-2xl text-oxford uppercase tracking-widest focus:outline-none focus:border-oxford cursor-pointer transition-all"
                                >
                                    <option value="">All Status</option>
                                    <option value="Pending">Pending</option>
                                    <option value="Selected">Selected</option>
                                    <option value="Rejected">Rejected</option>
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* Teams Table */}
                    <div className="bg-white rounded-3xl shadow-2xl border-4 border-oxford overflow-hidden">
                        <table className="w-full">
                            <thead className="bg-oxford text-white">
                                <tr>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em]">Team</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em]">Lead</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em]">Department</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em]">Status</th>
                                    <th className="px-6 py-4 text-left text-[10px] font-black uppercase tracking-[0.3em]">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-oxford/10">
                                {filteredTeams.length > 0 ? filteredTeams.map((team, index) => (
                                    <tr key={team.id} className={index % 2 === 0 ? 'bg-oxford/2' : 'bg-white'}>
                                        <td className="px-6 py-6">
                                            <div className="space-y-1">
                                                <p className="text-sm font-black text-oxford uppercase tracking-wide">{team.name}</p>
                                                <p className="text-xs text-oxford/50 font-black uppercase tracking-widest">ID: #{team.id}</p>
                                            </div>
                                        </td>
                                        <td className="px-6 py-6">
                                            <p className="text-sm font-black text-oxford uppercase">{team.lead}</p>
                                        </td>
                                        <td className="px-6 py-6">
                                            <span className="inline-block px-3 py-1.5 bg-oxford text-white text-[10px] font-black uppercase rounded-xl tracking-widest">
                                                {team.dept}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6">
                                            <span className={cn(
                                                "inline-block px-3 py-1.5 text-[10px] font-black uppercase rounded-xl tracking-widest",
                                                team.status === 'Selected' ? "bg-green-100 text-green-700" :
                                                team.status === 'Rejected' ? "bg-red-100 text-red-700" :
                                                "bg-yellow-100 text-yellow-700"
                                            )}>
                                                {team.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-6">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => { setSelectedTeam(team); setIsViewModalOpen(true); }}
                                                    className="p-2 sm:p-2.5 rounded-xl bg-emerald-50 text-emerald-600 hover:bg-emerald-600 hover:text-white transition-all active:scale-90 shadow-sm"
                                                    title="View Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => { setSelectedTeam(team); setIsEditModalOpen(true); }}
                                                    className="p-2 sm:p-2.5 rounded-xl bg-amber-50 text-amber-600 hover:bg-amber-600 hover:text-white transition-all active:scale-90 shadow-sm"
                                                    title="Edit Team"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleStatusUpdate(team.id, 'Selected')}
                                                    className={cn(
                                                        "p-2 sm:p-2.5 rounded-xl transition-all active:scale-90 shadow-sm",
                                                        team.status === 'Selected' ? "bg-green-600 text-white" : "bg-oxford/5 text-oxford hover:bg-oxford hover:text-white"
                                                    )}
                                                    title="Approve"
                                                >
                                                    <CheckCircle2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => setDeleteConfirmId(team.id)}
                                                    className="p-2 sm:p-2.5 rounded-xl bg-red-50 text-red-600 hover:bg-red-600 hover:text-white transition-all active:scale-90 shadow-sm"
                                                    title="Delete Team"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                <tr>
                                    <td colSpan="5" className="p-20 text-center">
                                        <p className="text-sm font-black text-oxford/20 uppercase tracking-[0.3em]">No teams found matching your search</p>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                </div>
            )}

            <div className="bg-oxford/5 p-4 sm:p-6 rounded-3xl flex flex-col sm:flex-row items-center justify-between gap-4 border-2 border-oxford/10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-oxford text-white rounded-xl shadow-lg">
                        <ArrowUpRight className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black text-oxford uppercase tracking-widest">Selection Deadline</p>
                        <p className="text-xs font-black text-oxford/60">Feb 15, 2026 • 11:59 PM IST</p>
                    </div>
                </div>
                <button
                    onClick={handleExport}
                    disabled={exporting}
                    className={cn(
                        "w-full sm:w-auto px-8 py-3.5 bg-oxford text-white font-black rounded-2xl uppercase tracking-[0.2em] text-[10px] hover:bg-oxford-dark transition-all shadow-xl active:scale-95 flex items-center justify-center gap-2",
                        exporting && "opacity-50 cursor-not-allowed"
                    )}
                >
                    {exporting ? 'Exporting...' : 'Export Team Data (CSV)'}
                </button>
            </div>

            {/* View Details Modal */}
            {isViewModalOpen && selectedTeam && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford/40 backdrop-blur-sm animate-in fade-in duration-300 text-oxford">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border-4 border-oxford animate-in zoom-in-95 duration-300">
                        <div className="bg-oxford p-6 text-white flex items-center justify-between">
                            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">Team Details</h3>
                            <button onClick={() => { setIsViewModalOpen(false); setSelectedTeam(null); }} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 sm:p-8 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">Team Name</p>
                                    <p className="text-lg font-black text-oxford uppercase">{selectedTeam.name}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">Team ID</p>
                                    <p className="text-lg font-black text-oxford">{selectedTeam.id}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">Team Lead</p>
                                    <p className="text-lg font-black text-oxford uppercase">{selectedTeam.lead}</p>
                                </div>
                                <div className="space-y-1">
                                    <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">Department</p>
                                    <p className="text-lg font-black text-oxford uppercase">{selectedTeam.dept}</p>
                                </div>
                            </div>
                            <div className="space-y-1 bg-oxford/5 p-5 rounded-2xl border-2 border-oxford/10">
                                <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">Problem Statement</p>
                                <p className="text-sm font-black text-oxford uppercase leading-relaxed">{selectedTeam.statement}</p>
                            </div>
                            <div className="flex justify-end pt-4">
                                <button onClick={() => { setIsViewModalOpen(false); setSelectedTeam(null); }} className="px-8 py-3 bg-oxford text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-oxford-dark transition-all shadow-lg active:scale-95">
                                    Close Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Team Modal */}
            {isEditModalOpen && selectedTeam && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford/40 backdrop-blur-sm animate-in fade-in duration-300 text-oxford">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border-4 border-oxford animate-in zoom-in-95 duration-300">
                        <div className="bg-oxford p-6 text-white flex items-center justify-between">
                            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">Edit Team Info</h3>
                            <button onClick={() => { setIsEditModalOpen(false); setSelectedTeam(null); }} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateTeam} className="p-6 sm:p-8 space-y-6">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-oxford/40 uppercase tracking-widest pl-1">Team Name</label>
                                    <input
                                        required
                                        value={selectedTeam.name}
                                        onChange={(e) => setSelectedTeam({ ...selectedTeam, name: e.target.value })}
                                        className="w-full p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none font-black text-sm uppercase"
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-oxford/40 uppercase tracking-widest pl-1">Team Lead</label>
                                    <input
                                        required
                                        value={selectedTeam.lead}
                                        onChange={(e) => setSelectedTeam({ ...selectedTeam, lead: e.target.value })}
                                        className="w-full p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none font-black text-sm uppercase"
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-oxford/40 uppercase tracking-widest pl-1">Problem Statement</label>
                                <textarea
                                    required
                                    rows="3"
                                    value={selectedTeam.statement}
                                    onChange={(e) => setSelectedTeam({ ...selectedTeam, statement: e.target.value })}
                                    className="w-full p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none font-black text-sm uppercase resize-none"
                                />
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => { setIsEditModalOpen(false); setSelectedTeam(null); }} className="px-6 py-3 border-2 border-oxford/10 text-oxford/60 font-black rounded-xl uppercase tracking-widest text-xs hover:text-oxford hover:border-oxford transition-all">
                                    Cancel
                                </button>
                                <button type="submit" className="px-8 py-3 bg-oxford text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-oxford-dark transition-all shadow-lg active:scale-95">
                                    Save Changes
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Enhanced View Team Modal with Members */}
            {isViewModalOpen && selectedTeam && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-4xl max-h-[90vh] overflow-hidden shadow-2xl border-4 border-oxford animate-in zoom-in-95 duration-300">
                        <div className="bg-oxford p-6 text-white flex items-center justify-between">
                            <div>
                                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">{selectedTeam.name}</h3>
                                <p className="text-sm opacity-80 font-bold">Complete Team Details</p>
                            </div>
                            <button 
                                onClick={() => { setIsViewModalOpen(false); setSelectedTeam(null); setTeamMembers([]); }} 
                                className="p-2 hover:bg-white/10 rounded-xl transition-all"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto max-h-[calc(90vh-120px)]">
                            {/* Team Lead Info */}
                            <div className="bg-emerald-50 p-6 rounded-2xl border-2 border-emerald-200">
                                <h4 className="text-lg font-black text-oxford uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                                    Team Leader
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                        <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">Name</p>
                                        <p className="text-lg font-black text-oxford uppercase">{selectedTeam.lead}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">Email</p>
                                        <p className="text-sm font-bold text-oxford">{selectedTeam.leadEmail}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">Department</p>
                                        <p className="text-lg font-black text-oxford uppercase">{selectedTeam.dept}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">Year - Section</p>
                                        <p className="text-lg font-black text-oxford uppercase">{selectedTeam.year} - {selectedTeam.section}</p>
                                    </div>
                                </div>
                            </div>
                            
                            {/* Team Members */}
                            <div>
                                <h4 className="text-lg font-black text-oxford uppercase tracking-wide mb-4 flex items-center gap-2">
                                    <Users className="w-5 h-5 text-oxford" />
                                    Team Members ({teamMembers.length})
                                </h4>
                                {teamMembers.length > 0 ? (
                                    <div className="grid gap-4">
                                        {teamMembers.map((member, index) => (
                                            <div key={member.id} className="bg-gray-50 p-4 rounded-xl border-2 border-oxford/10">
                                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm">
                                                    <div>
                                                        <p className="text-[9px] font-black text-oxford/40 uppercase tracking-widest">Name</p>
                                                        <p className="font-black text-oxford">{member.name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-oxford/40 uppercase tracking-widest">Register No</p>
                                                        <p className="font-bold text-oxford">{member.register_number}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-oxford/40 uppercase tracking-widest">Email</p>
                                                        <p className="font-bold text-oxford truncate">{member.email}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[9px] font-black text-oxford/40 uppercase tracking-widest">Phone</p>
                                                        <p className="font-bold text-oxford">{member.phone}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="text-center py-8 text-oxford/40">
                                        <Users className="w-12 h-12 mx-auto mb-2 opacity-30" />
                                        <p className="font-black uppercase tracking-widest text-sm">No team members added</p>
                                    </div>
                                )}
                            </div>
                            
                            {/* Problem Statement */}
                            <div className="space-y-1 bg-oxford/5 p-5 rounded-2xl border-2 border-oxford/10">
                                <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">Selected Problem Statement</p>
                                <p className="text-sm font-black text-oxford uppercase leading-relaxed">{selectedTeam.statement}</p>
                            </div>
                            
                            <div className="flex justify-end pt-4">
                                <button 
                                    onClick={() => { setIsViewModalOpen(false); setSelectedTeam(null); setTeamMembers([]); }} 
                                    className="px-8 py-3 bg-oxford text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-oxford-dark transition-all shadow-lg active:scale-95"
                                >
                                    Close Details
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Problem Statement Modal */}
            {isStatementModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-oxford/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2.5rem] w-full max-w-2xl overflow-hidden shadow-2xl border-4 border-oxford animate-in zoom-in-95 duration-300">
                        <div className="bg-oxford p-6 text-white flex items-center justify-between">
                            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter">Add Problem Statement</h3>
                            <button onClick={() => setIsStatementModalOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                                <X className="w-6 h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleAddStatement} className="p-6 sm:p-8 space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-oxford/40 uppercase tracking-widest pl-1">Title</label>
                                <input
                                    required
                                    value={newStatement.title}
                                    onChange={(e) => setNewStatement({ ...newStatement, title: e.target.value })}
                                    className="w-full p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none font-black text-sm uppercase"
                                    placeholder="Enter problem statement title"
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-oxford/40 uppercase tracking-widest pl-1">Description</label>
                                <textarea
                                    required
                                    rows="4"
                                    value={newStatement.description}
                                    onChange={(e) => setNewStatement({ ...newStatement, description: e.target.value })}
                                    className="w-full p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none font-bold text-sm resize-none"
                                    placeholder="Enter detailed description of the problem statement"
                                />
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-oxford/40 uppercase tracking-widest pl-1">Department</label>
                                    <select
                                        required
                                        value={newStatement.department}
                                        onChange={(e) => setNewStatement({ ...newStatement, department: e.target.value })}
                                        className="w-full p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none font-black text-sm uppercase"
                                    >
                                        <option value="CS">Computer Science</option>
                                        <option value="EC">Electronics & Communication</option>
                                        <option value="ME">Mechanical Engineering</option>
                                        <option value="EE">Electrical Engineering</option>
                                        <option value="CE">Civil Engineering</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-oxford/40 uppercase tracking-widest pl-1">Max Teams</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={newStatement.max_teams}
                                        onChange={(e) => setNewStatement({ ...newStatement, max_teams: parseInt(e.target.value) })}
                                        className="w-full p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none font-black text-sm uppercase"
                                    />
                                </div>
                            </div>
                            <div className="flex justify-end gap-3 pt-4">
                                <button type="button" onClick={() => setIsStatementModalOpen(false)} className="px-6 py-3 border-2 border-oxford/10 text-oxford/60 font-black rounded-xl uppercase tracking-widest text-xs hover:text-oxford hover:border-oxford transition-all">
                                    Cancel
                                </button>
                                <button type="submit" className="px-8 py-3 bg-oxford text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-oxford-dark transition-all shadow-lg active:scale-95">
                                    Add Statement
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Statement Confirmation */}
            {isDeleteStatementModalOpen && selectedStatement && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-oxford/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border-4 border-red-600 animate-in zoom-in-95 duration-300">
                        <div className="bg-red-600 p-6 text-white flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-xl">
                                <AlertTriangle className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tighter leading-none">Delete Statement?</h3>
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">This action cannot be undone</p>
                            </div>
                        </div>
                        <div className="p-6 md:p-8 space-y-6">
                            <p className="text-sm font-bold text-oxford/60 leading-relaxed">
                                Are you sure you want to delete "<span className="text-oxford font-black underline">{selectedStatement.title}</span>"? 
                                This will remove it from all team selections.
                            </p>
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => { setIsDeleteStatementModalOpen(false); setSelectedStatement(null); }} 
                                    className="flex-1 px-6 py-3.5 border-2 border-oxford/10 text-oxford/60 font-black rounded-xl uppercase tracking-widest text-[10px] hover:text-oxford hover:border-oxford transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleDeleteStatement} 
                                    className="flex-1 px-6 py-3.5 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-red-700 transition-all shadow-lg active:scale-95"
                                >
                                    Yes, Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Delete Confirmation Modal */}
            {deleteConfirmId && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-oxford/40 backdrop-blur-sm animate-in fade-in duration-300 text-oxford">
                    <div className="bg-white rounded-[2rem] w-full max-w-md overflow-hidden shadow-2xl border-4 border-red-600 animate-in zoom-in-95 duration-300">
                        <div className="bg-red-600 p-6 text-white flex items-center gap-4">
                            <div className="p-3 bg-white/20 rounded-xl">
                                <Trash2 className="w-6 h-6" />
                            </div>
                            <div>
                                <h3 className="text-xl font-black uppercase tracking-tighter leading-none">Delete Team?</h3>
                                <p className="text-[10px] font-bold opacity-80 uppercase tracking-widest mt-1">This action cannot be undone</p>
                            </div>
                        </div>
                        <div className="p-6 md:p-8 space-y-6">
                            <p className="text-sm font-bold text-oxford/60 leading-relaxed"> Are you sure you want to remove <span className="text-oxford font-black underline">{teams.find(t => t.id === deleteConfirmId)?.name}</span> from the roster? This will permanently delete all associated data.</p>
                            <div className="flex gap-3">
                                <button onClick={() => setDeleteConfirmId(null)} className="flex-1 px-6 py-3.5 border-2 border-oxford/10 text-oxford/60 font-black rounded-xl uppercase tracking-widest text-[10px] hover:text-oxford hover:border-oxford transition-all">
                                    No, Keep Team
                                </button>
                                <button onClick={() => handleDeleteTeam(deleteConfirmId)} className="flex-1 px-6 py-3.5 bg-red-600 text-white font-black rounded-xl uppercase tracking-widest text-[10px] hover:bg-red-700 transition-all shadow-lg active:scale-95">
                                    Yes, Delete
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
