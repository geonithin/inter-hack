import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Users, FileText, CheckCircle2, XCircle, Search, Filter, ArrowUpRight, Edit, Trash2, X, Plus, AlertTriangle } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function FacultyDashboard() {
    const { isAuthenticated, getUserRole, user } = useAuth();
    const navigate = useNavigate();
    const [searchQuery, setSearchQuery] = useState('');
    const [deptFilter, setDeptFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [notification, setNotification] = useState(null);
    const [exporting, setExporting] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [isViewModalOpen, setIsViewModalOpen] = useState(false);
    const [isStatementModalOpen, setIsStatementModalOpen] = useState(false);
    const [isDeleteStatementModalOpen, setIsDeleteStatementModalOpen] = useState(false);
    const [selectedTeam, setSelectedTeam] = useState(null);
    const [selectedStatement, setSelectedStatement] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const [deleteConfirmId, setDeleteConfirmId] = useState(null);
    const [openStatusDropdown, setOpenStatusDropdown] = useState(null);
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
        // Protected route already verified authentication and faculty role
        // Just fetch data if we have a user
        if (user) {
            console.log('Faculty dashboard loading for user:', user.id);
            fetchData();
        } else {
            // If no user yet, wait for auth to initialize
            console.log('Waiting for user authentication...');
            setIsLoading(true);
        }
    }, [user]);
    
    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            // Check if clicked element is not part of any status dropdown
            if (!event.target.closest('.status-dropdown-container')) {
                setOpenStatusDropdown(null);
            }
        };
        
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);
    
    const fetchData = async () => {
        setIsLoading(true);
        setError(null);
        try {
            
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
            
            setProblemStatements(statementsData);
            
            // Fetch teams with problem statement info and profiles join
            let teamsData = [];
            try {
                const { data, error: teamsError } = await supabase
                    .from('teams')
                    .select(`
                        *,
                        problem_statements(title, department),
                        profiles!teams_lead_id_fkey(full_name, email)
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
                lead: t.profiles?.full_name || 'Unknown', // Use joined profile name
                leadEmail: t.profiles?.email || 'N/A', // Use joined profile email
                statement: t.problem_statements?.title || 'Not Selected',
                status: t.status || 'Pending',
                dept: t.department || t.problem_statements?.department || 'N/A', // Use team department first
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
    
    const handleAddStatement = async (e) => {
        e.preventDefault();
        try {
            // Verify user has faculty role before attempting insert
            const userRole = getUserRole();
            if (userRole !== 'faculty' && userRole !== 'admin') {
                showNotification('You do not have permission to add problem statements', 'error');
                return;
            }

            // Validate input data
            if (!newStatement.title?.trim()) {
                showNotification('Title is required', 'error');
                return;
            }
            if (newStatement.title.trim().length === 0) {
                showNotification('Title cannot be empty', 'error');
                return;
            }
            if (!newStatement.description?.trim()) {
                showNotification('Description is required', 'error');
                return;
            }
            if (newStatement.description.trim().length <= 20) {
                showNotification('Description must be at least 21 characters long', 'error');
                return;
            }
            if (!newStatement.department) {
                showNotification('Department is required', 'error');
                return;
            }
            if (!newStatement.max_teams || newStatement.max_teams < 1) {
                showNotification('Max teams must be at least 1', 'error');
                return;
            }
            if (newStatement.max_teams > 10) {
                showNotification('Max teams cannot exceed 10', 'error');
                return;
            }

            // Prepare data that matches problem_statements table structure
            const statementData = {
                title: newStatement.title.trim(),
                description: newStatement.description.trim(),
                department: newStatement.department,
                max_teams: parseInt(newStatement.max_teams, 10),
                is_active: true
            };

            console.log('Inserting problem statement:', statementData);
            console.log('User role:', userRole);
            console.log('User ID:', user?.id);

            const { data, error } = await supabase
                .from('problem_statements')
                .insert([statementData])
                .select();
                
            if (error) {
                console.error('Insert error details:', error);
                console.error('Error code:', error.code);
                console.error('Error message:', error.message);
                console.error('Error details:', error.details);
                console.error('Error hint:', error.hint);
                
                // Handle specific error codes
                if (error.code === '42501') {
                    showNotification(
                        'Permission denied. Run complete_production_setup.sql in Supabase SQL Editor to set up RLS policies.', 
                        'error'
                    );
                } else if (error.code === '42P01') {
                    showNotification(
                        'Table does not exist. Run complete_production_setup.sql to create required tables.', 
                        'error'
                    );
                } else if (error.message?.includes('JWT')) {
                    showNotification(
                        'Authentication error. Please log out and log back in with Supabase Auth credentials.', 
                        'error'
                    );
                } else if (error.message?.includes('policy')) {
                    showNotification(
                        'RLS policy blocking insert. Run complete_production_setup.sql to fix policies.', 
                        'error'
                    );
                } else if (error.code === '23505') {
                    showNotification(
                        'A problem statement with this title already exists.', 
                        'error'
                    );
                } else if (error.code === '23502') {
                    showNotification(
                        `Required field missing: ${error.message}`, 
                        'error'
                    );
                } else if (error.code === '23514') {
                    // Check constraint violation
                    if (error.message?.includes('description')) {
                        showNotification(
                            'Description must be at least 21 characters long', 
                            'error'
                        );
                    } else if (error.message?.includes('title')) {
                        showNotification(
                            'Title cannot be empty', 
                            'error'
                        );
                    } else if (error.message?.includes('max_teams')) {
                        showNotification(
                            'Max teams must be between 1 and 10', 
                            'error'
                        );
                    } else {
                        showNotification(
                            `Validation error: ${error.message}`, 
                            'error'
                        );
                    }
                } else {
                    showNotification(
                        `Database error: ${error.message || 'Unknown error'}. Check console for details.`, 
                        'error'
                    );
                }
                return;
            }
            
            console.log('Problem statement added successfully:', data);
            showNotification('Problem statement added successfully!', 'success');
            await fetchData();
            setIsStatementModalOpen(false);
            setNewStatement({ title: '', description: '', department: 'CS', max_teams: 3 });
        } catch (error) {
            console.error('Error adding statement:', error);
            showNotification(
                'Failed to add problem statement: ' + (error.message || 'Unknown error') + '. Check console for details.', 
                'error'
            );
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
                showNotification(`Cannot delete: ${teamsUsingStatement.length} team(s) have selected this statement.`, 'error');
                return;
            }
            
            const { error } = await supabase
                .from('problem_statements')
                .update({ is_active: false })
                .eq('id', selectedStatement.id);
                
            if (error) throw error;
            
            showNotification('Problem statement deleted successfully!', 'success');
            await fetchData();
            setIsDeleteStatementModalOpen(false);
            setSelectedStatement(null);
        } catch (error) {
            console.error('Error deleting statement:', error);
            showNotification('Failed to delete problem statement', 'error');
        }
    };

    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };

    const handleStatusUpdate = async (teamId, newStatus) => {
        try {
            console.log('Updating status for team:', teamId, 'to:', newStatus);
            
            // Debug: Check current user authentication details
            console.log('=== DEBUGGING STATUS UPDATE ===');
            try {
                const { data: debugInfo, error: debugError } = await supabase.rpc('debug_current_user');
                if (debugError) {
                    console.error('Debug function error:', debugError);
                } else {
                    console.log('Debug - Current user info:', debugInfo);
                }
            } catch (debugError) {
                console.log('Debug function call failed:', debugError);
            }
            
            // Check Supabase auth status
            const { data: { user: currentUser } } = await supabase.auth.getUser();
            console.log('Supabase auth user:', currentUser);
            
            // Test basic database connectivity
            const { data: testData, error: testError } = await supabase
                .from('teams')
                .select('id, name, status')
                .limit(1);
            console.log('Basic database test:', { testData, testError });
            
            console.log('=== END DEBUGGING ===');
            
            // Find the team being updated
            const teamBeingUpdated = teams.find(t => t.id === teamId);
            console.log('Team being updated:', teamBeingUpdated);
            
            if (!teamBeingUpdated) {
                throw new Error('Team not found');
            }
            
            // Optimistic update - update local state immediately
            setTeams(prevTeams => 
                prevTeams.map(team => 
                    team.id === teamId ? { ...team, status: newStatus } : team
                )
            );
            
            // Show immediate feedback
            const statusColor = newStatus === 'Selected' ? 'success' : 
                              newStatus === 'Rejected' ? 'error' : 'warning';
            showNotification(
                `Team "${teamBeingUpdated?.name}" status is being updated to ${newStatus.toLowerCase()}...`, 
                'info'
            );

            // Update in database with better error handling
            console.log('Updating team status in database...');
            console.log('Current user from auth context:', user);
            console.log('Team ID type:', typeof teamId, 'Team ID value:', teamId);
            console.log('New status:', newStatus);
            
            // First, let's check if we can select this team before updating
            console.log('Testing SELECT access first...');
            const { data: selectTest, error: selectError } = await supabase
                .from('teams')
                .select('*')
                .eq('id', teamId);
            console.log('Select test result:', { selectTest, selectError, canReadTeam: !!selectTest?.length });
            
            // Now try the update
            console.log('Attempting UPDATE operation...');
            const updateStart = Date.now();
            const { data, error, status, statusText } = await supabase
                .from('teams')
                .update({ 
                    status: newStatus,
                    updated_at: new Date().toISOString()
                })
                .eq('id', teamId)
                .select('*'); // Return the updated row to confirm it worked

            const updateTime = Date.now() - updateStart;
            console.log('Update operation completed in', updateTime, 'ms');
            console.log('Update response details:', { 
                data, 
                error, 
                status, 
                statusText,
                dataCount: data?.length,
                hasData: !!data,
                isArray: Array.isArray(data)
            });

            if (error) {
                console.error('Database update error:', error);
                console.error('Error details:', {
                    code: error.code,
                    message: error.message,
                    details: error.details,
                    hint: error.hint
                });
                throw new Error(`Failed to update status: ${error.message}`);
            }
            
            if (!data || data.length === 0) {
                console.error('No rows updated - this suggests RLS policy is blocking the update');
                console.error('Update operation returned empty data despite no error');
                
                // Additional debugging queries
                const { data: allTeams } = await supabase.from('teams').select('id, name, status').limit(5);
                console.log('Sample of all teams we can see:', allTeams);
                
                throw new Error('Status update failed - no rows were affected (RLS policy issue)');
            }
            
            console.log('Team status updated successfully in database:', data[0]);

            // Show success notification
            showNotification(
                `Team "${teamBeingUpdated?.name}" has been ${newStatus.toLowerCase()}!`, 
                statusColor
            );

            // Refresh data to ensure consistency with database
            setTimeout(fetchData, 1000); // Small delay to ensure all DB operations complete
            
        } catch (error) {
            console.error('Error updating status:', error);
            showNotification(`Failed to update team status: ${error.message}`, 'error');
            
            // Revert optimistic update on error
            await fetchData();
        }
    };

    const handleDeleteTeam = async (id) => {
        try {
            const teamToDelete = teams.find(t => t.id === id);
            
            // Delete team members first
            await supabase.from('members').delete().eq('team_id', id);
            
            // Then delete the team
            const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', id);

            if (error) throw error;

            showNotification(`Team "${teamToDelete?.name}" has been deleted successfully`, 'success');
            await fetchData();
            setDeleteConfirmId(null);
            setIsViewModalOpen(false);
            setSelectedTeam(null);
        } catch (error) {
            console.error('Error deleting team:', error);
            showNotification('Failed to delete team', 'error');
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

            showNotification(`Team "${selectedTeam.name}" has been updated successfully`, 'success');
            setIsEditModalOpen(false);
            setSelectedTeam(null);
            await fetchData();
        } catch (error) {
            console.error('Error updating team:', error);
            showNotification('Failed to update team', 'error');
        }
    };

    const handleExport = async () => {
        setExporting(true);
        try {
            // Create new PDF document
            const doc = new jsPDF('l', 'mm', 'a4'); // landscape, millimeters, A4
            
            // Add title
            doc.setFontSize(20);
            doc.setFont('helvetica', 'bold');
            doc.text('SMCE Hackathon - Team Data Report', 14, 20);
            
            // Add generation date
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 28);
            
            // Prepare table data
            const tableData = teams.map(team => [
                team.name || 'N/A',
                team.lead || 'N/A', // Use correct field from processed data
                team.dept || 'N/A',
                `${team.year || 'N/A'} - ${team.section || 'N/A'}`,
                team.leadEmail || 'N/A', // Use correct field from processed data
                team.status || 'Pending'
            ]);
            
            // Add table
            autoTable(doc, {
                head: [['Team Name', 'Team Lead', 'Department', 'Year-Section', 'Email', 'Status']],
                body: tableData,
                startY: 35,
                theme: 'grid',
                headStyles: {
                    fillColor: [0, 52, 89], // oxford color in RGB
                    textColor: 255,
                    fontStyle: 'bold',
                    fontSize: 10
                },
                bodyStyles: {
                    fontSize: 9
                },
                alternateRowStyles: {
                    fillColor: [245, 245, 245]
                },
                columnStyles: {
                    0: { cellWidth: 45 },
                    1: { cellWidth: 40 },
                    2: { cellWidth: 25 },
                    3: { cellWidth: 30 },
                    4: { cellWidth: 55 },
                    5: { cellWidth: 25 }
                },
                margin: { left: 14, right: 14 }
            });
            
            // Add footer with statistics
            const finalY = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY : 35;
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            doc.text(`Total Teams: ${teams.length}`, 14, finalY + 15);
            doc.text(`Selected: ${teams.filter(t => t.status === 'Selected').length}`, 14, finalY + 22);
            doc.text(`Pending: ${teams.filter(t => t.status === 'Pending').length}`, 14, finalY + 29);
            doc.text(`Rejected: ${teams.filter(t => t.status === 'Rejected').length}`, 14, finalY + 36);
            
            // Save the PDF
            doc.save(`SMCE_Hackathon_Teams_${new Date().toISOString().split('T')[0]}.pdf`);
            
            showNotification('Team data exported successfully as PDF!', 'success');
        } catch (error) {
            console.error('Error exporting PDF:', error);
            showNotification('Failed to export PDF', 'error');
        } finally {
            setExporting(false);
        }
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

    // Emergency fallback for debugging
    if (typeof isAuthenticated !== 'function') {
        return (
            <div className="flex flex-col items-center justify-center min-h-screen bg-red-50 p-8">
                <div className="bg-white p-6 rounded-xl border-2 border-red-200">
                    <h2 className="text-red-700 font-bold text-xl mb-4">Authentication Context Error</h2>
                    <p className="text-red-600 mb-4">The authentication context is not properly initialized.</p>
                    <button 
                        onClick={() => window.location.href = '/login'} 
                        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                    >
                        Go to Login
                    </button>
                </div>
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4 animate-in fade-in duration-200">
                <div className="w-12 h-12 sm:w-16 sm:h-16 border-4 sm:border-8 border-oxford border-t-transparent rounded-full animate-spin" />
                <p className="text-oxford font-black uppercase tracking-[0.2em] text-xs sm:text-sm">Fetching Team Roster...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6 animate-in fade-in duration-200">
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
        const matchesDept = deptFilter === '' || team.department === deptFilter;
        const matchesStatus = statusFilter === '' || team.status === statusFilter;
        return matchesSearch && matchesDept && matchesStatus;
    });
    
    const filteredStatements = problemStatements.filter(statement => {
        const matchesSearch = statement.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
            statement.department.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesDept = deptFilter === '' || statement.department === deptFilter;
        return matchesSearch && matchesDept;
    });

    return (
        <div className="space-y-6 sm:space-y-8 animate-in fade-in duration-300">
            {/* Header Section */}
            <div className="relative overflow-hidden bg-gradient-to-br from-white via-gray-50 to-white rounded-3xl border-2 border-oxford/10 shadow-xl p-8 mb-8">
                {/* Background Pattern */}
                <div className="absolute inset-0 opacity-5">
                    <div className="absolute -top-4 -right-4 w-20 h-20 bg-oxford rounded-full"></div>
                    <div className="absolute top-6 -left-6 w-12 h-12 bg-oxford rounded-full"></div>
                    <div className="absolute bottom-4 right-16 w-8 h-8 bg-oxford rounded-full"></div>
                </div>
                
                <div className="relative flex flex-col lg:flex-row lg:items-center justify-between gap-6">
                    <div className="space-y-4">
                        <div className="flex items-center gap-4">
                            <div className="p-3 bg-oxford/10 backdrop-blur-sm rounded-xl border border-oxford/20">
                                <Users className="w-8 h-8 text-oxford" />
                            </div>
                            <div>
                                <h1 className="text-2xl sm:text-4xl font-black text-oxford uppercase tracking-tight">Faculty Portal</h1>
                                <p className="text-sm text-oxford/60 font-medium mt-1">Institutional Oversight & Management</p>
                            </div>
                        </div>
                        
                        <div className="flex items-center gap-3 pl-16">
                            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                            <span className="text-xs text-oxford/70 font-semibold">
                                Real-time Monitoring Active
                            </span>
                        </div>
                    </div>
                    
                    <div className="flex flex-col sm:flex-row items-end gap-4">
                        {/* View Toggle */}
                        <div className="flex bg-white/80 backdrop-blur-sm p-1.5 rounded-2xl border-2 border-oxford/15 shadow-lg">
                            <button
                                onClick={() => setCurrentView('teams')}
                                className={cn(
                                    "px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center gap-2",
                                    currentView === 'teams' 
                                        ? "bg-oxford text-white shadow-lg transform scale-105" 
                                        : "text-oxford/50 hover:text-oxford hover:bg-oxford/5"
                                )}
                            >
                                <Users className="w-4 h-4" />
                                Teams
                            </button>
                            <button
                                onClick={() => setCurrentView('statements')}
                                className={cn(
                                    "px-6 py-3 rounded-xl font-black text-sm uppercase tracking-widest transition-all flex items-center gap-2",
                                    currentView === 'statements' 
                                        ? "bg-oxford text-white shadow-lg transform scale-105" 
                                        : "text-oxford/50 hover:text-oxford hover:bg-oxford/5"
                                )}
                            >
                                <FileText className="w-4 h-4" />
                                Statements
                            </button>
                        </div>
                    </div>
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
                        <AlertTriangle className="w-6 h-6 text-blue-600 mt-1 shrink-0" />
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
            <div className="flex flex-col lg:flex-row gap-4 justify-between items-center bg-gray-50 p-3 rounded-4xl border-2 border-oxford/10">
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
                        <div className="flex gap-2">
                            <select
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                                className="px-4 py-2.5 bg-white border-2 border-oxford/5 rounded-xl text-oxford font-black text-[9px] uppercase tracking-widest focus:border-oxford outline-none cursor-pointer"
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
                                className="px-4 py-2.5 bg-white border-2 border-oxford/5 rounded-xl text-oxford font-black text-[9px] uppercase tracking-widest focus:border-oxford outline-none cursor-pointer"
                            >
                                <option value="">All Status</option>
                                <option value="Pending">Pending</option>
                                <option value="Selected">Selected</option>
                                <option value="Rejected">Rejected</option>
                            </select>
                        </div>
                    ) : (
                        <div className="flex gap-2">
                            <select
                                value={deptFilter}
                                onChange={(e) => setDeptFilter(e.target.value)}
                                className="px-4 py-2.5 bg-white border-2 border-oxford/5 rounded-xl text-oxford font-black text-[9px] uppercase tracking-widest focus:border-oxford outline-none cursor-pointer"
                            >
                                <option value="">All Departments</option>
                                <option value="CS">Computer Science</option>
                                <option value="EC">Electronics</option>
                                <option value="ME">Mechanical</option>
                                <option value="CE">Civil</option>
                                <option value="EE">Electrical</option>
                            </select>
                            <button
                                onClick={() => setIsStatementModalOpen(true)}
                                className="px-6 py-2.5 bg-oxford text-white rounded-xl font-black text-[9px] uppercase tracking-widest hover:bg-oxford-dark transition-all shadow-lg flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Add Statement
                            </button>
                        </div>
                    )}
                </div>
            </div>

            {/* Main Content - Conditional based on view */}
            {currentView === 'teams' ? (
                <div className="oxford-edge rounded-[2.5rem] overflow-hidden bg-white shadow-2xl border-transparent">
                    <div className="overflow-x-auto text-[10px] sm:text-xs">
                        <table className="w-full text-left border-collapse">
                            <thead className="bg-oxford text-white border-b-4 border-oxford">
                                <tr className="font-black uppercase tracking-[0.2em]">
                                    <th className="p-5">Team Info</th>
                                    <th className="p-5 border-l-2 border-white/10">Lead Details</th>
                                    <th className="p-5 border-l-2 border-white/10">Chosen Statement</th>
                                    <th className="p-5 border-l-2 border-white/10 text-center">Status</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y-2 divide-oxford/10">
                                {filteredTeams.length > 0 ? filteredTeams.map((team) => (
                                    <tr key={team.id} className="hover:bg-oxford/2 transition-colors group">
                                        <td className="p-5 sm:p-6">
                                            <button 
                                                onClick={() => navigate(`/faculty/team/${team.id}`)}
                                                className="text-left w-full hover:bg-oxford/5 rounded-lg p-2 -m-2 transition-all group/name"
                                            >
                                                <p className="font-black text-oxford uppercase tracking-tight group-hover/name:text-oxford-dark group-hover/name:underline transition-all cursor-pointer">
                                                    {team.name}
                                                </p>
                                                <p className="text-[9px] font-black text-oxford/40 uppercase tracking-widest mt-0.5">
                                                    {team.dept} | {team.year} - {team.section}
                                                </p>
                                            </button>
                                        </td>
                                        <td className="p-5 sm:p-6 border-l-2 border-oxford/10">
                                            <p className="font-black text-oxford uppercase tracking-tight">{team.lead}</p>
                                            <p className="text-[9px] font-black text-oxford/40 mt-0.5">{team.leadEmail}</p>
                                        </td>
                                        <td className="p-5 sm:p-6 border-l-2 border-oxford/10">
                                            <p className="font-black text-oxford uppercase tracking-tight line-clamp-2 max-w-62.5">{team.statement}</p>
                                        </td>
                                        <td className="p-5 sm:p-6 border-l-2 border-oxford/10 text-center">
                                            <div className="relative status-dropdown-container">
                                                <button 
                                                    onClick={() => setOpenStatusDropdown(openStatusDropdown === team.id ? null : team.id)}
                                                    className={cn(
                                                        "inline-flex items-center gap-2 px-4 py-2 rounded-full border-2 font-black uppercase text-[9px] tracking-widest cursor-pointer hover:scale-105 transition-all",
                                                        team.status === 'Selected' ? "bg-green-50 text-green-700 border-green-200 hover:bg-green-100" :
                                                            team.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200 hover:bg-red-100" :
                                                                "bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100"
                                                    )}
                                                >
                                                    <div className={cn(
                                                        "w-1.5 h-1.5 rounded-full animate-pulse",
                                                        team.status === 'Selected' ? "bg-green-500" :
                                                            team.status === 'Rejected' ? "bg-red-500" :
                                                                "bg-amber-500"
                                                    )} />
                                                    {team.status}
                                                </button>
                                                
                                                {openStatusDropdown === team.id && (
                                                    <div className="absolute top-full left-1/2 transform -translate-x-1/2 mt-2 bg-white border-2 border-oxford/10 rounded-xl shadow-lg z-50 min-w-30">
                                                        {['Pending', 'Selected', 'Rejected'].map((status) => (
                                                            <button
                                                                key={status}
                                                                onClick={() => {
                                                                    handleStatusUpdate(team.id, status);
                                                                    setOpenStatusDropdown(null);
                                                                }}
                                                                className={cn(
                                                                    "w-full px-4 py-3 text-left text-[10px] font-black uppercase tracking-widest hover:bg-oxford/5 first:rounded-t-lg last:rounded-b-lg transition-all",
                                                                    team.status === status ? "bg-oxford/10 text-oxford" : "text-oxford/70 hover:text-oxford"
                                                                )}
                                                            >
                                                                <div className="flex items-center gap-2">
                                                                    <div className={cn(
                                                                        "w-2 h-2 rounded-full",
                                                                        status === 'Selected' ? "bg-green-500" :
                                                                            status === 'Rejected' ? "bg-red-500" :
                                                                                "bg-amber-500"
                                                                    )} />
                                                                    {status}
                                                                </div>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="4" className="p-12 text-center text-oxford/40">
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
                <div className="oxford-edge rounded-[2.5rem] overflow-hidden bg-white shadow-2xl border-transparent">
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
                                        <tr key={statement.id} className="hover:bg-oxford/2 transition-colors group">
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
                    {exporting ? 'Exporting...' : 'Export Team Data (PDF)'}
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
                            
                            {/* Action Buttons */}
                            <div className="flex flex-col sm:flex-row justify-between gap-4 pt-6 border-t-2 border-oxford/10">
                                <div className="flex gap-3">
                                    <button 
                                        onClick={() => { setIsEditModalOpen(true); }}
                                        className="px-6 py-3 bg-amber-500 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-amber-600 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                                    >
                                        <Edit className="w-4 h-4" />
                                        Edit Team
                                    </button>
                                    <button 
                                        onClick={() => setDeleteConfirmId(selectedTeam.id)}
                                        className="px-6 py-3 bg-red-500 text-white font-black rounded-xl uppercase tracking-widest text-xs hover:bg-red-600 transition-all shadow-lg active:scale-95 flex items-center gap-2"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                        Delete Team
                                    </button>
                                </div>
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
                <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-oxford/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white rounded-2xl sm:rounded-[2.5rem] w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border-2 sm:border-4 border-oxford animate-in zoom-in-95 duration-300">
                        <div className="bg-oxford p-4 sm:p-6 text-white flex items-center justify-between sticky top-0 z-10">
                            <h3 className="text-base sm:text-xl md:text-2xl font-black uppercase tracking-tighter">Add Problem Statement</h3>
                            <button 
                                onClick={() => setIsStatementModalOpen(false)} 
                                className="p-1.5 sm:p-2 hover:bg-white/10 rounded-lg sm:rounded-xl transition-all flex-shrink-0"
                                aria-label="Close modal"
                            >
                                <X className="w-5 h-5 sm:w-6 sm:h-6" />
                            </button>
                        </div>
                        <form onSubmit={handleAddStatement} className="p-4 sm:p-6 md:p-8 space-y-4 sm:space-y-6">
                            <div className="space-y-2">
                                <label className="text-[9px] sm:text-[10px] font-black text-oxford/40 uppercase tracking-widest pl-1">Title</label>
                                <input
                                    required
                                    value={newStatement.title}
                                    onChange={(e) => setNewStatement({ ...newStatement, title: e.target.value })}
                                    className="w-full p-2.5 sm:p-3.5 border-2 border-oxford/10 rounded-lg sm:rounded-xl focus:border-oxford outline-none font-black text-xs sm:text-sm uppercase"
                                    placeholder="Enter problem statement title"
                                />
                            </div>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between pl-1">
                                    <label className="text-[9px] sm:text-[10px] font-black text-oxford/40 uppercase tracking-widest">Description</label>
                                    <span className={cn(
                                        "text-[9px] sm:text-[10px] font-bold",
                                        newStatement.description.trim().length < 21 ? "text-red-500" : "text-emerald-500"
                                    )}>
                                        {newStatement.description.trim().length}/21+ chars
                                    </span>
                                </div>
                                <textarea
                                    required
                                    rows="4"
                                    value={newStatement.description}
                                    onChange={(e) => setNewStatement({ ...newStatement, description: e.target.value })}
                                    className={cn(
                                        "w-full p-2.5 sm:p-3.5 border-2 rounded-lg sm:rounded-xl focus:border-oxford outline-none font-bold text-xs sm:text-sm resize-none",
                                        newStatement.description.trim().length < 21 ? "border-red-300" : "border-oxford/10"
                                    )}
                                    placeholder="Enter detailed description (minimum 21 characters required)"
                                />
                                {newStatement.description.trim().length > 0 && newStatement.description.trim().length < 21 && (
                                    <p className="text-[9px] sm:text-[10px] text-red-500 font-bold pl-1">
                                        ⚠️ Need {21 - newStatement.description.trim().length} more character{21 - newStatement.description.trim().length !== 1 ? 's' : ''}
                                    </p>
                                )}
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                                <div className="space-y-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-oxford/40 uppercase tracking-widest pl-1">Department</label>
                                    <select
                                        required
                                        value={newStatement.department}
                                        onChange={(e) => setNewStatement({ ...newStatement, department: e.target.value })}
                                        className="w-full p-2.5 sm:p-3.5 border-2 border-oxford/10 rounded-lg sm:rounded-xl focus:border-oxford outline-none font-black text-xs sm:text-sm uppercase"
                                    >
                                        <option value="CS">Computer Science</option>
                                        <option value="EC">Electronics & Communication</option>
                                        <option value="ME">Mechanical Engineering</option>
                                        <option value="EE">Electrical Engineering</option>
                                        <option value="CE">Civil Engineering</option>
                                    </select>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[9px] sm:text-[10px] font-black text-oxford/40 uppercase tracking-widest pl-1">Max Teams (1-10)</label>
                                    <input
                                        required
                                        type="number"
                                        min="1"
                                        max="10"
                                        value={newStatement.max_teams}
                                        onChange={(e) => setNewStatement({ ...newStatement, max_teams: parseInt(e.target.value) })}
                                        className={cn(
                                            "w-full p-2.5 sm:p-3.5 border-2 rounded-lg sm:rounded-xl focus:border-oxford outline-none font-black text-xs sm:text-sm uppercase",
                                            (newStatement.max_teams < 1 || newStatement.max_teams > 10) ? "border-red-300" : "border-oxford/10"
                                        )}
                                    />
                                    {(newStatement.max_teams < 1 || newStatement.max_teams > 10) && (
                                        <p className="text-[9px] sm:text-[10px] text-red-500 font-bold pl-1">
                                            ⚠️ Must be between 1 and 10
                                        </p>
                                    )}
                                </div>
                            </div>
                            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 pt-4">
                                <button 
                                    type="button" 
                                    onClick={() => setIsStatementModalOpen(false)} 
                                    className="w-full sm:w-auto px-4 sm:px-6 py-2.5 sm:py-3 border-2 border-oxford/10 text-oxford/60 font-black rounded-lg sm:rounded-xl uppercase tracking-widest text-[10px] sm:text-xs hover:text-oxford hover:border-oxford transition-all order-2 sm:order-1"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit" 
                                    className="w-full sm:w-auto px-6 sm:px-8 py-2.5 sm:py-3 bg-oxford text-white font-black rounded-lg sm:rounded-xl uppercase tracking-widest text-[10px] sm:text-xs hover:bg-oxford-dark transition-all shadow-lg active:scale-95 order-1 sm:order-2"
                                >
                                    Add Statement
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Delete Statement Confirmation */}
            {isDeleteStatementModalOpen && selectedStatement && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-oxford/40 backdrop-blur-sm animate-in fade-in duration-300">
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
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-oxford/40 backdrop-blur-sm animate-in fade-in duration-300 text-oxford">
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
            
            {/* Notification Toast */}
            {notification && (
                <div className={cn(
                    "fixed bottom-6 right-6 z-100 p-4 rounded-xl shadow-2xl border-2 animate-in slide-in-from-bottom-4 fade-in duration-300",
                    notification.type === 'success' ? "bg-green-50 border-green-200 text-green-800" :
                    notification.type === 'error' ? "bg-red-50 border-red-200 text-red-800" :
                    "bg-yellow-50 border-yellow-200 text-yellow-800"
                )}>
                    <div className="flex items-center gap-3">
                        {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                        {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-600" />}
                        {notification.type === 'warning' && <AlertTriangle className="w-5 h-5 text-yellow-600" />}
                        <p className="font-black text-sm uppercase tracking-wide">{notification.message}</p>
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
