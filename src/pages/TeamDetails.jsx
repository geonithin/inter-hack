import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, CheckCircle2, Mail, Hash, Calendar, FileText, ExternalLink, AlertCircle, Edit, Download, XCircle, Trash2, X } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TeamDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, getUserRole, user } = useAuth();
    const [team, setTeam] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const [submission, setSubmission] = useState(null);
    const [problemStatement, setProblemStatement] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [exporting, setExporting] = useState(false);
    
    // Evaluation state
    const [isEvaluationModalOpen, setIsEvaluationModalOpen] = useState(false);
    const [evaluationAction, setEvaluationAction] = useState(null);
    const [evaluationForm, setEvaluationForm] = useState({ facultyName: '', reason: '' });
    const [evaluationHistory, setEvaluationHistory] = useState([]);
    
    // Delete state
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    
    // Notification state
    const [notification, setNotification] = useState(null);

    const fetchTeamDetails = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch team details
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .select('*')
                .eq('id', id)
                .single();

            if (teamError) {
                throw teamError;
            }
            if (!teamData) throw new Error('Team not found');

            // Fetch team lead profile if lead_id exists
            let teamLeadProfile = null;
            if (teamData.lead_id) {
                const { data: leadData, error: leadError } = await supabase
                    .from('profiles')
                    .select('id, full_name, email')
                    .eq('id', teamData.lead_id)
                    .single();

                if (!leadError && leadData) {
                    teamLeadProfile = leadData;
                }
            }

            // Fetch problem statement if selected_statement_id exists
            let problemStatementData = null;
            if (teamData.selected_statement_id) {
                const { data: psData, error: psError } = await supabase
                    .from('problem_statements')
                    .select('*')
                    .eq('id', teamData.selected_statement_id)
                    .single();

                if (!psError && psData) {
                    problemStatementData = psData;
                }
            }

            // Combine team data with lead profile
            const enrichedTeamData = {
                ...teamData,
                profiles: teamLeadProfile
            };

            setTeam(enrichedTeamData);
            setProblemStatement(problemStatementData);

            // Fetch team members
            const { data: membersData, error: membersError } = await supabase
                .from('members')
                .select('*')
                .eq('team_id', id)
                .order('name');

            if (!membersError && membersData) {
                setTeamMembers(membersData);
            } else {
                setTeamMembers([]);
            }

            // Fetch team submission if exists
            const { data: submissionData, error: submissionError } = await supabase
                .from('submissions')
                .select('*')
                .eq('team_id', id)
                .order('created_at', { ascending: false })
                .limit(1);

            if (submissionError) {
                if (submissionError.message?.includes('relation "submissions" does not exist')) {
                    setError('Submissions table missing - please run the migration');
                } else if (submissionError.message?.includes('permission denied')) {
                    setError('Permission denied - check database policies');
                }
                setSubmission(null);
            } else if (submissionData && submissionData.length > 0) {
                setSubmission(submissionData[0]);
            } else {
                setSubmission(null);
            }

        } catch (error) {
            console.error('Error fetching team details:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [id]);
    
    const fetchEvaluationHistory = useCallback(async () => {
        try {
            const { data, error } = await supabase
                .from('team_evaluation_history')
                .select('*')
                .eq('team_id', id)
                .order('created_at', { ascending: false });
            
            if (error && error.code !== '42P01') {
                console.error('Error fetching evaluation history:', error);
                return;
            }
            
            setEvaluationHistory(data || []);
        } catch (error) {
            console.warn('Could not fetch evaluation history:', error.message);
            setEvaluationHistory([]);
        }
    }, [id]);
    
    const showNotification = (message, type = 'success') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 4000);
    };
    
    const openEvaluationModal = (action) => {
        setEvaluationAction(action);
        setEvaluationForm({
            facultyName: user?.user_metadata?.full_name || '',
            reason: ''
        });
        setIsEvaluationModalOpen(true);
    };
    
    const closeEvaluationModal = () => {
        setIsEvaluationModalOpen(false);
        setEvaluationAction(null);
        setEvaluationForm({ facultyName: '', reason: '' });
    };
    
    const handleStatusUpdate = async (e) => {
        e.preventDefault();
        
        if (!team || !evaluationAction) {
            showNotification('Invalid evaluation data', 'error');
            return;
        }
        
        if (!evaluationForm.facultyName?.trim()) {
            showNotification('Please enter your name', 'error');
            return;
        }
        
        if (!evaluationForm.reason?.trim() || evaluationForm.reason.trim().length < 10) {
            showNotification('Please enter a reason (minimum 10 characters)', 'error');
            return;
        }
        
        try {
            showNotification(`Updating team status to ${evaluationAction.toLowerCase()}...`, 'info');
            
            // Update team status
            const { data, error } = await supabase
                .from('teams')
                .update({ 
                    status: evaluationAction,
                    updated_at: new Date().toISOString()
                })
                .eq('id', id)
                .select('*');
            
            if (error) {
                throw new Error(`Failed to update status: ${error.message}`);
            }
            
            if (!data || data.length === 0) {
                throw new Error('Status update failed - no rows affected');
            }
            
            // Save evaluation history
            const { error: historyError } = await supabase
                .from('team_evaluation_history')
                .insert([{
                    team_id: id,
                    evaluated_by: user?.id,
                    faculty_name: evaluationForm.facultyName.trim(),
                    action: evaluationAction,
                    reason: evaluationForm.reason.trim()
                }]);
            
            if (historyError) {
                console.error('Error saving evaluation history:', historyError);
                showNotification('Status updated but history could not be saved', 'warning');
            }
            
            // Send notification to team lead
            if (team.lead_id) {
                try {
                    const notificationMessage = evaluationAction === 'Selected'
                        ? `Congratulations! Your team "${team.name}" has been selected for the hackathon.\\n\\nReason: ${evaluationForm.reason}\\n\\nKeep working on your solution!`
                        : `Your team "${team.name}" was not selected for this round.\\n\\nReason: ${evaluationForm.reason}\\n\\nThank you for your participation.`;
                    
                    await supabase.from('notifications').insert([{
                        recipient_id: team.lead_id,
                        recipient_type: 'lead',
                        title: evaluationAction === 'Selected' ? '🎉 Team Selected!' : 'Team Status Update',
                        message: notificationMessage,
                        type: evaluationAction === 'Selected' ? 'success' : 'info',
                        is_read: false,
                        sender_type: 'faculty',
                        team_id: id
                    }]);
                } catch (notifError) {
                    console.error('Notification error:', notifError);
                }
            }
            
            showNotification(`Team has been ${evaluationAction.toLowerCase()}!`, 'success');
            closeEvaluationModal();
            await fetchTeamDetails();
            await fetchEvaluationHistory();
        } catch (error) {
            console.error('Error updating status:', error);
            showNotification(`Failed to update team status: ${error.message}`, 'error');
        }
    };
    
    const handleResetToPending = async () => {
        if (!window.confirm(`Reset "${team.name}" back to Pending status? This will allow re-evaluation.`)) {
            return;
        }
        
        try {
            showNotification(`Resetting "${team.name}" to Pending...`, 'info');
            
            const { error } = await supabase
                .from('teams')
                .update({ 
                    status: 'Pending',
                    updated_at: new Date().toISOString()
                })
                .eq('id', id);
            
            if (error) {
                throw new Error(`Failed to reset status: ${error.message}`);
            }
            
            // Send notification to team lead
            if (team.lead_id) {
                try {
                    await supabase.from('notifications').insert([{
                        recipient_id: team.lead_id,
                        recipient_type: 'lead',
                        title: 'Team Status Reset',
                        message: `Your team "${team.name}" status has been reset to Pending. You may receive a new evaluation soon.`,
                        type: 'info',
                        is_read: false,
                        sender_type: 'faculty',
                        team_id: id
                    }]);
                } catch (notifError) {
                    console.error('Error sending notification:', notifError);
                }
            }
            
            showNotification(`"${team.name}" has been reset to Pending status`, 'success');
            await fetchTeamDetails();
        } catch (error) {
            console.error('Error resetting team:', error);
            showNotification(`Failed to reset team: ${error.message}`, 'error');
        }
    };
    
    const handleDeleteTeam = async () => {
        try {
            showNotification(`Deleting team "${team.name}"...`, 'info');
            
            // Delete team members first (cascade should handle this, but being explicit)
            await supabase.from('members').delete().eq('team_id', id);
            
            // Delete team
            const { error } = await supabase
                .from('teams')
                .delete()
                .eq('id', id);
            
            if (error) {
                throw new Error(`Failed to delete team: ${error.message}`);
            }
            
            showNotification(`Team "${team.name}" has been deleted successfully`, 'success');
            setTimeout(() => navigate('/faculty'), 1500);
        } catch (error) {
            console.error('Error deleting team:', error);
            showNotification(`Failed to delete team: ${error.message}`, 'error');
        }
    };

    const handleExportPDF = async () => {
        if (!team) return;
        
        setExporting(true);
        try {
            const doc = new jsPDF('p', 'mm', 'a4');
            
            doc.setFontSize(24);
            doc.setFont('helvetica', 'bold');
            doc.text('SMCE HACKATHON', 105, 20, { align: 'center' });
            
            doc.setFontSize(12);
            doc.setFont('helvetica', 'normal');
           doc.text('Team Details Report', 105, 28, { align: 'center' });
            
            doc.setFontSize(18);
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(0, 52, 89);
            doc.text(team.name, 105, 40, { align: 'center' });
            
            doc.setTextColor(0, 0, 0);
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'bold');
            const statusColor = team.status === 'Selected' ? [34, 197, 94] : 
                              team.status === 'Rejected' ? [239, 68, 68] : [251, 146, 60];
            doc.setTextColor(...statusColor);
            doc.text(`Status: ${team.status}`, 105, 48, { align: 'center' });
            doc.setTextColor(0, 0, 0);
            
            let yPos = 60;
            
            doc.setFontSize(14);
            doc.setFont('helvetica', 'bold');
            doc.setFillColor(0, 52, 89);
            doc.setTextColor(255, 255, 255);
            doc.rect(14, yPos, 182, 8, 'F');
            doc.text('TEAM LEADER', 16, yPos + 6);
            doc.setTextColor(0, 0, 0);
            yPos += 12;
            
            doc.setFontSize(10);
            doc.setFont('helvetica', 'normal');
            const leadInfo = [
                ['Name:', team?.profiles?.full_name || 'Lead information pending'],
                ['Email:', team?.profiles?.email || 'Email pending'],
                ['Department:', team.department || 'Department pending'],
                ['Year - Section:', `${team.year || 'Year pending'} - ${team.section || 'Section pending'}`]
            ];
            
            leadInfo.forEach(([label, value]) => {
                doc.setFont('helvetica', 'bold');
                doc.text(label, 16, yPos);
                doc.setFont('helvetica', 'normal');
                doc.text(value, 60, yPos);
                yPos += 7;
            });
            
            yPos += 5;
            
            if (teamMembers.length > 0) {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(0, 52, 89);
                doc.setTextColor(255, 255, 255);
                doc.rect(14, yPos, 182, 8, 'F');
                doc.text(`TEAM MEMBERS (${teamMembers.length})`, 16, yPos + 6);
                doc.setTextColor(0, 0, 0);
                yPos += 12;
                
                const memberTableData = teamMembers.map(member => [
                    member.name,
                    member.email,
                    member.department,
                    member.year
                ]);
                
                autoTable(doc, {
                    head: [['Name', 'Email', 'Department', 'Year']],
                    body: memberTableData,
                    startY: yPos,
                    theme: 'grid',
                    headStyles: {
                        fillColor: [0, 52, 89],
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
                    margin: { left: 14, right: 14 }
                });
                
                // Get the position after the table - use fallback if autoTable doesn't set lastAutoTable
                yPos = (doc.lastAutoTable && doc.lastAutoTable.finalY) ? doc.lastAutoTable.finalY + 10 : yPos + (memberTableData.length * 8) + 20;
            }
            
            if (problemStatement && yPos < 250) {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(0, 52, 89);
                doc.setTextColor(255, 255, 255);
                doc.rect(14, yPos, 182, 8, 'F');
                doc.text('PROBLEM STATEMENT', 16, yPos + 6);
                doc.setTextColor(0, 0, 0);
                yPos += 12;
                
                doc.setFontSize(11);
                doc.setFont('helvetica', 'bold');
                doc.text(problemStatement.title, 16, yPos, { maxWidth: 180 });
                yPos += 8;
                
                doc.setFontSize(9);
                doc.setFont('helvetica', 'italic');
                doc.text(`Department: ${problemStatement.department}`, 16, yPos);
                yPos += 7;
                
                doc.setFont('helvetica', 'normal');
                const descLines = doc.splitTextToSize(problemStatement.description, 180);
                doc.text(descLines, 16, yPos);
                yPos += (descLines.length * 5) + 10;
            }
            
            if (submission && yPos > 220) {
                doc.addPage();
                yPos = 20;
            }
            
            if (submission) {
                doc.setFontSize(14);
                doc.setFont('helvetica', 'bold');
                doc.setFillColor(0, 52, 89);
                doc.setTextColor(255, 255, 255);
                doc.rect(14, yPos, 182, 8, 'F');
                doc.text('IDEA SUBMISSION', 16, yPos + 6);
                doc.setTextColor(0, 0, 0);
                yPos += 12;
                
                doc.setFontSize(10);
                const submissionInfo = [
                    ['Title:', submission.title],
                    ['Submitted:', new Date(submission.submitted_at).toLocaleString()],
                    ['Status:', submission.status.replace('_', ' ').toUpperCase()]
                ];
                
                submissionInfo.forEach(([label, value]) => {
                    doc.setFont('helvetica', 'bold');
                    doc.text(label, 16, yPos);
                    doc.setFont('helvetica', 'normal');
                    doc.text(value, 60, yPos);
                    yPos += 7;
                });
                
                yPos += 3;
                doc.setFont('helvetica', 'bold');
                doc.text('Description:', 16, yPos);
                yPos += 5;
                doc.setFont('helvetica', 'normal');
                const descLines = doc.splitTextToSize(submission.description, 180);
                doc.text(descLines, 16, yPos);
                yPos += (descLines.length * 5) + 5;
                
                doc.setFont('helvetica', 'bold');
                doc.text('Technology Stack:', 16, yPos);
                yPos += 5;
                doc.setFont('helvetica', 'normal');
                doc.text(submission.tech_stack, 16, yPos);
                yPos += 7;
                
                if (submission.solution_link) {
                    doc.setFont('helvetica', 'bold');
                    doc.text('Solution Link:', 16, yPos);
                    yPos += 5;
                    doc.setFont('helvetica', 'normal');
                    doc.setTextColor(0, 0, 255);
                    doc.text(submission.solution_link, 16, yPos, { maxWidth: 180 });
                    doc.setTextColor(0, 0, 0);
                }
            }
            
            const pageCount = doc.internal.getNumberOfPages();
            for (let i = 1; i <= pageCount; i++) {
                doc.setPage(i);
                doc.setFontSize(8);
                doc.setFont('helvetica', 'normal');
                doc.setTextColor(128, 128, 128);
                doc.text(`Generated: ${new Date().toLocaleString()}`, 14, 287);
                doc.text(`Page ${i} of ${pageCount}`, 196, 287, { align: 'right' });
            }
            
            doc.save(`${team.name.replace(/[^a-z0-9]/gi, '_')}_Details.pdf`);
            
        } catch (error) {
            console.error('Error exporting PDF:', error);
            alert('Failed to export PDF. Please try again.');
        } finally {
            setExporting(false);
        }
    };

    useEffect(() => {
        // Verify user has faculty access
        if (!isAuthenticated() || (getUserRole() !== 'faculty' && getUserRole() !== 'admin')) {
            navigate('/unauthorized');
            return;
        }
        
        fetchTeamDetails();
        fetchEvaluationHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [id, isAuthenticated, getUserRole, navigate]);

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <div className="w-12 h-12 border-4 border-oxford border-t-transparent rounded-full animate-spin mx-auto" />
                    <p className="text-oxford font-black uppercase tracking-widest text-sm">Loading team details...</p>
                </div>
            </div>
        );
    }

    if (error || !team) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center space-y-4">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
                    <h2 className="text-2xl font-black text-oxford uppercase">Team Not Found</h2>
                    <p className="text-oxford/70">{error || 'The requested team could not be found.'}</p>
                    <button
                        onClick={() => navigate('/faculty')}
                        className="px-6 py-3 bg-oxford text-white font-black rounded-xl uppercase tracking-widest text-sm hover:bg-oxford-dark transition-all"
                    >
                        Back to Faculty Dashboard
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-oxford/5">
            {/* Header */}
            <div className="bg-white shadow-md border-b-4 border-oxford/20">
                <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-6">
                    {/* Back Button */}
                    <button
                        onClick={() => navigate('/faculty')}
                        className="mb-3 flex items-center gap-1.5 text-oxford/60 hover:text-oxford font-semibold text-xs sm:text-sm transition-all"
                    >
                        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        Back to Dashboard
                    </button>
                    
                    <div className="space-y-3">
                        {/* Team Name and Status */}
                        <div>
                            <h1 className="text-xl sm:text-3xl lg:text-4xl font-black text-oxford uppercase tracking-tight mb-2">
                                {team.name}
                            </h1>
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap text-xs sm:text-sm">
                                <div className={cn(
                                    "px-2.5 sm:px-3 py-1 rounded-full font-bold text-[10px] sm:text-xs uppercase tracking-wide border",
                                    team.status === 'Selected' ? "bg-green-50 text-green-700 border-green-200" :
                                        team.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-200" :
                                            "bg-amber-50 text-amber-700 border-amber-200"
                                )}>
                                    {team.status}
                                </div>
                                <span className="text-xs sm:text-sm text-oxford/50 font-medium">{team.department} | {team.year} - {team.section}</span>
                            </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex flex-wrap gap-2">
                            {/* Evaluation Buttons */}
                            <button
                                onClick={() => openEvaluationModal('Selected')}
                                className="flex-1 min-w-[110px] sm:flex-none px-3 sm:px-4 py-2 bg-green-600 text-white font-semibold rounded-md text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-green-700 transition-colors shadow-sm border border-green-700"
                            >
                                <CheckCircle2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">{team.status === 'Selected' ? 'Re-Select' : 'Select'}</span>
                                <span className="sm:hidden">Select</span>
                            </button>
                            <button
                                onClick={() => openEvaluationModal('Rejected')}
                                className="flex-1 min-w-[110px] sm:flex-none px-3 sm:px-4 py-2 bg-red-600 text-white font-semibold rounded-md text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-red-700 transition-colors shadow-sm border border-red-700"
                            >
                                <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                <span className="hidden sm:inline">{team.status === 'Rejected' ? 'Re-Reject' : 'Reject'}</span>
                                <span className="sm:hidden">Reject</span>
                            </button>
                            
                            {/* Secondary Actions - Grouped to stay together */}
                            <div className="flex gap-2 w-full sm:w-auto">
                                <button
                                    onClick={handleExportPDF}
                                    disabled={exporting}
                                    className={cn(
                                        "flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-oxford text-white font-semibold rounded-md text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-oxford/90 transition-colors shadow-sm border border-oxford-dark",
                                        exporting && "opacity-50 cursor-not-allowed"
                                    )}
                                >
                                    <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">{exporting ? 'Exporting...' : 'PDF'}</span>
                                </button>
                                <button
                                    onClick={() => setShowDeleteConfirm(true)}
                                    className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-red-600 text-white font-semibold rounded-md text-xs sm:text-sm flex items-center justify-center gap-1.5 hover:bg-red-700 transition-colors shadow-sm border border-red-700"
                                >
                                    <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                                    <span className="hidden sm:inline">Delete</span>
                                </button>
                                {team.status !== 'Pending' && (
                                    <button
                                        onClick={handleResetToPending}
                                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-amber-100 text-amber-700 font-semibold rounded-md text-xs sm:text-sm hover:bg-amber-200 transition-colors"
                                    >
                                        Reset
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
                {/* Evaluation History Section */}
                {evaluationHistory.length > 0 && (
                    <div className="mb-6 bg-white rounded-xl shadow-lg border border-oxford/10 p-6">
                        <h2 className="text-lg font-black text-oxford uppercase mb-4 flex items-center gap-2">
                            <FileText className="w-5 h-5" />
                            Evaluation History
                        </h2>
                        <div className="space-y-3">
                            {evaluationHistory.map((evaluation, idx) => (
                                <div key={idx} className={cn(
                                    "p-4 rounded-lg border-l-4",
                                    evaluation.action === 'Selected' 
                                        ? "bg-green-50 border-green-500" 
                                        : "bg-red-50 border-red-500"
                                )}>
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2 mb-2">
                                                <span className={cn(
                                                    "px-2 py-0.5 rounded text-xs font-black uppercase",
                                                    evaluation.action === 'Selected' 
                                                        ? "bg-green-600 text-white" 
                                                        : "bg-red-600 text-white"
                                                )}>
                                                    {evaluation.action}
                                                </span>
                                                <span className="text-xs text-oxford/60">
                                                    by <span className="font-bold">{evaluation.faculty_name}</span>
                                                </span>
                                            </div>
                                            <p className="text-sm text-oxford/80 mb-2">
                                                <span className="font-bold">Reason:</span> {evaluation.reason}
                                            </p>
                                            <p className="text-xs text-oxford/50">
                                                {new Date(evaluation.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
                
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
                    {/* Left Column - Team Info */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Team Lead Info */}
                        <div className="bg-white p-7 rounded-2xl shadow-xl border border-oxford/10 hover:shadow-2xl transition-shadow duration-300">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-oxford/5">
                                <div className="p-3 bg-gradient-to-br from-emerald-50 to-emerald-100 rounded-xl shadow-sm">
                                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                                </div>
                                <h2 className="text-xl font-black text-oxford uppercase tracking-wide">
                                    Team Leader
                                </h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-2">
                                        Full Name
                                    </p>
                                    <p className="text-lg font-black text-oxford uppercase">
                                        {team?.profiles?.full_name || 'Lead information pending'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-2">
                                        Email Address
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-oxford/60" />
                                        <p className="text-sm font-medium text-oxford">
                                            {team?.profiles?.email || 'Email pending'}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-2">
                                        Department
                                    </p>
                                    <p className="text-lg font-black text-oxford uppercase">
                                        {team.department || 'Department pending'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-2">
                                        Year - Section
                                    </p>
                                    <p className="text-lg font-black text-oxford uppercase">
                                        {team.year} - {team.section}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Team Members */}
                        <div className="bg-white p-7 rounded-2xl shadow-xl border border-oxford/10 hover:shadow-2xl transition-shadow duration-300">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-oxford/5">
                                <div className="p-3 bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl shadow-sm">
                                    <Users className="w-6 h-6 text-blue-600" />
                                </div>
                                <h2 className="text-xl font-black text-oxford uppercase tracking-wide">
                                    Team Members ({teamMembers.length})
                                </h2>
                            </div>
                            {teamMembers.length > 0 ? (
                                <div className="grid gap-4">
                                    {teamMembers.map((member) => (
                                        <div key={member.id} className="bg-gradient-to-br from-gray-50 to-oxford/5 p-5 rounded-xl border border-oxford/10 hover:border-oxford/20 transition-all duration-200 hover:shadow-md">
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">
                                                            Name
                                                        </p>
                                                        <p className="font-bold text-oxford text-sm">{member.name}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">
                                                            Email
                                                        </p>
                                                        <p className="font-medium text-oxford/80 text-xs break-words">{member.email}</p>
                                                    </div>
                                                </div>
                                                <div className="space-y-3">
                                                    <div>
                                                        <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">
                                                            Department
                                                        </p>
                                                        <p className="font-bold text-oxford text-sm uppercase">{member.department}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-oxford/40 uppercase tracking-widest">
                                                            Year
                                                        </p>
                                                        <p className="font-bold text-oxford text-sm">{member.year}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8 text-oxford/40">
                                    <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                    <p className="font-black uppercase tracking-widest text-sm">No team members added</p>
                                </div>
                            )}
                        </div>

                        {/* Problem Statement */}
                        {problemStatement && (
                            <div className="bg-white p-7 rounded-2xl shadow-xl border border-oxford/10 hover:shadow-2xl transition-shadow duration-300">
                                <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-oxford/5">
                                    <div className="p-3 bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl shadow-sm">
                                        <FileText className="w-6 h-6 text-purple-600" />
                                    </div>
                                    <h2 className="text-xl font-black text-oxford uppercase tracking-wide">
                                        Selected Problem Statement
                                    </h2>
                                </div>
                                <div className="space-y-5">
                                    <div>
                                        <h3 className="text-lg font-black text-oxford uppercase tracking-tight mb-3">
                                            {problemStatement.title}
                                        </h3>
                                        <span className="inline-block px-4 py-1.5 bg-gradient-to-r from-oxford to-oxford-dark text-white text-xs font-black rounded-full uppercase tracking-widest shadow-md">
                                            {problemStatement.department}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-3">
                                            Description
                                        </p>
                                        <p className="text-oxford/70 leading-relaxed text-[15px]">
                                            {problemStatement.description}
                                        </p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Right Column - Submission Details */}
                    <div className="lg:col-span-1 overflow-hidden">
                        <div className="bg-white p-7 rounded-2xl shadow-xl border border-oxford/10 sticky top-8 hover:shadow-2xl transition-shadow duration-300 overflow-hidden">
                            <div className="flex items-center gap-3 mb-6 pb-4 border-b-2 border-oxford/5">
                                <div className={cn(
                                    "p-3 rounded-xl shadow-sm",
                                    submission ? "bg-gradient-to-br from-green-50 to-green-100" : "bg-gradient-to-br from-gray-50 to-gray-100"
                                )}>
                                    <Edit className={cn(
                                        "w-6 h-6",
                                        submission ? "text-green-600" : "text-gray-400"
                                    )} />
                                </div>
                                <h2 className="text-xl font-black text-oxford uppercase tracking-wide">
                                    Idea Submission
                                </h2>
                            </div>

                            {submission ? (
                                <div className="space-y-6">
                                    {/* Submission Status */}
                                    <div className="bg-gradient-to-br from-green-50 to-green-100/50 border-2 border-green-200 p-5 rounded-xl shadow-sm">
                                        <div className="flex items-center gap-2 mb-2">
                                            <CheckCircle2 className="w-5 h-5 text-green-600" />
                                            <span className="font-black text-green-700 text-sm uppercase tracking-widest">
                                                Submitted
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 text-xs text-green-600">
                                            <Calendar className="w-4 h-4" />
                                            <span className="font-medium">
                                                {new Date(submission.submitted_at).toLocaleDateString()} at {new Date(submission.submitted_at).toLocaleTimeString()}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Idea Title */}
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-3">
                                            Idea Title
                                        </p>
                                        <h3 className="text-lg font-black text-oxford leading-tight" style={{ overflowWrap: 'break-word', wordBreak: 'break-all', maxWidth: '100%' }}>
                                            {submission.title}
                                        </h3>
                                    </div>

                                    {/* Solution Overview */}
                                    <div className="overflow-hidden">
                                        <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-3">
                                            Solution Overview
                                        </p>
                                        <p className="text-sm text-oxford/70 leading-relaxed" style={{ overflowWrap: 'break-word', wordBreak: 'break-all', maxWidth: '100%' }}>
                                            {submission.description}
                                        </p>
                                    </div>

                                    {/* Technology Stack */}
                                    <div>
                                        <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-3">
                                            Technology Stack
                                        </p>
                                        <div className="flex flex-wrap gap-2">
                                            {submission.tech_stack.split(',').map((tech, index) => (
                                                <span 
                                                    key={index}
                                                    className="px-3 py-1.5 bg-gradient-to-r from-oxford/10 to-oxford/15 text-oxford text-xs font-bold rounded-full border border-oxford/20 hover:border-oxford/30 transition-all hover:shadow-sm"
                                                >
                                                    {tech.trim()}
                                                </span>
                                            ))}
                                        </div>
                                    </div>

                                    {/* External Link */}
                                    {submission.solution_link && (
                                        <div>
                                            <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-3">
                                                External Link
                                            </p>
                                            <a
                                                href={submission.solution_link.startsWith('http') ? submission.solution_link : `https://${submission.solution_link}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 text-oxford hover:text-oxford-dark font-semibold text-sm break-all transition-all duration-200 hover:gap-3 group"
                                            >
                                                <ExternalLink className="w-4 h-4 shrink-0 group-hover:scale-110 transition-transform" />
                                                <span className="underline decoration-oxford/30 group-hover:decoration-oxford-dark">
                                                    {submission.solution_link.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                                                </span>
                                            </a>
                                        </div>
                                    )}

                                    {/* Submission Status */}
                                    <div>
                                        <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-3">
                                            Review Status
                                        </p>
                                        <span className={cn(
                                            "inline-block px-4 py-2 rounded-full text-xs font-black uppercase tracking-widest shadow-sm border-2",
                                            submission.status === 'accepted' ? "bg-green-100 text-green-700 border-green-200" :
                                                submission.status === 'rejected' ? "bg-red-100 text-red-700 border-red-200" :
                                                    submission.status === 'under_review' ? "bg-amber-100 text-amber-700 border-amber-200" :
                                                        "bg-blue-100 text-blue-700 border-blue-200"
                                        )}>
                                            {submission.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center py-8 text-oxford/40">
                                    {error?.includes('submissions') ? (
                                        <div className="space-y-4">
                                            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-left">
                                                <h4 className="font-bold text-amber-800 mb-2">🔧 Database Setup Required</h4>
                                                <p className="text-sm text-amber-700 mb-2">
                                                    The submissions system needs to be initialized.
                                                </p>
                                                <p className="text-xs text-amber-600">
                                                    Please contact your administrator to set up the submissions table.
                                                </p>
                                            </div>
                                            <div className="text-center py-4 text-oxford/40">
                                                <Edit className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                <p className="font-black uppercase tracking-widest text-sm">Database Setup Needed</p>
                                                <p className="text-xs text-oxford/30 mt-1">Contact administrator for assistance</p>
                                            </div>
                                        </div>
                                    ) : (
                                        <div>
                                            <Edit className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                            <p className="font-black uppercase tracking-widest text-sm">No Submission Yet</p>
                                            <p className="text-xs text-oxford/30 mt-1">Team hasn't submitted their idea</p>
                                        </div>
                                    )}
                                    </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
            
            {/* Evaluation Modal */}
            {isEvaluationModalOpen && evaluationAction && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg w-full max-w-md overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
                        <div className={cn(
                            "px-4 py-3 flex items-center justify-between border-b-2",
                            evaluationAction === 'Selected' 
                                ? "bg-green-50 border-green-200" 
                                : "bg-red-50 border-red-200"
                        )}>
                            <div className="flex items-center gap-2">
                                {evaluationAction === 'Selected' ? (
                                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                                ) : (
                                    <XCircle className="w-4 h-4 text-red-600" />
                                )}
                                <h3 className={cn(
                                    "text-sm font-black uppercase",
                                    evaluationAction === 'Selected' ? "text-green-700" : "text-red-700"
                                )}>
                                    {evaluationAction === 'Selected' ? 'Select' : 'Reject'}: {team.name}
                                </h3>
                            </div>
                            <button onClick={closeEvaluationModal} className="p-1 hover:bg-black/5 rounded transition-all">
                                <X className="w-4 h-4 text-oxford/60" />
                            </button>
                        </div>
                        
                        <form onSubmit={handleStatusUpdate} className="p-4 space-y-3">
                            <div>
                                <label className="block text-[9px] font-bold text-oxford/50 uppercase mb-1">Your Name *</label>
                                <input
                                    type="text"
                                    required
                                    value={evaluationForm.facultyName}
                                    onChange={(e) => setEvaluationForm({ ...evaluationForm, facultyName: e.target.value })}
                                    className="w-full px-3 py-2 border border-oxford/20 rounded focus:border-oxford focus:ring-1 focus:ring-oxford outline-none text-sm"
                                    placeholder="Enter your full name"
                                />
                            </div>
                            
                            <div>
                                <div className="flex items-center justify-between mb-1">
                                    <label className="text-[9px] font-bold text-oxford/50 uppercase">Reason *</label>
                                    <span className={cn(
                                        "text-[9px] font-bold",
                                        evaluationForm.reason.trim().length < 10 ? "text-red-500" : "text-green-600"
                                    )}>
                                        {evaluationForm.reason.trim().length}/10+
                                    </span>
                                </div>
                                <textarea
                                    required
                                    rows="3"
                                    value={evaluationForm.reason}
                                    onChange={(e) => setEvaluationForm({ ...evaluationForm, reason: e.target.value })}
                                    className={cn(
                                        "w-full px-3 py-2 border rounded focus:ring-1 outline-none text-sm resize-none",
                                        evaluationForm.reason.trim().length < 10 
                                            ? "border-red-300 focus:border-red-500 focus:ring-red-500" 
                                            : "border-oxford/20 focus:border-oxford focus:ring-oxford"
                                    )}
                                    placeholder={`Why ${evaluationAction === 'Selected' ? 'select' : 'reject'} this team? (min 10 chars)`}
                                />
                            </div>
                            
                            <div className="flex gap-2 pt-2">
                                <button 
                                    type="button" 
                                    onClick={closeEvaluationModal} 
                                    className="flex-1 px-4 py-2 border border-oxford/20 text-oxford/60 font-bold rounded text-xs uppercase hover:bg-oxford/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="submit"
                                    disabled={!evaluationForm.facultyName.trim() || evaluationForm.reason.trim().length < 10}
                                    className={cn(
                                        "flex-1 px-4 py-2 font-bold rounded text-xs uppercase transition-all",
                                        evaluationAction === 'Selected' 
                                            ? "bg-green-600 hover:bg-green-700 text-white" 
                                            : "bg-red-600 hover:bg-red-700 text-white",
                                        (!evaluationForm.facultyName.trim() || evaluationForm.reason.trim().length < 10)
                                            ? "opacity-50 cursor-not-allowed"
                                            : "shadow hover:shadow-md active:scale-95"
                                    )}
                                >
                                    {evaluationAction === 'Selected' ? 'Select' : 'Reject'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
            
            {/* Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="fixed inset-0 z-60 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-200">
                    <div className="bg-white rounded-lg w-full max-w-md overflow-hidden shadow-xl animate-in zoom-in-95 duration-200">
                        <div className="bg-red-600 px-4 py-3 flex items-center gap-3">
                            <Trash2 className="w-5 h-5 text-white" />
                            <h3 className="text-lg font-black text-white uppercase">Delete Team?</h3>
                        </div>
                        
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-oxford/80">
                                Are you sure you want to permanently delete <span className="font-black text-oxford">"{team.name}"</span>?
                            </p>
                            <p className="text-xs text-red-600 font-bold">
                                ⚠️ This action cannot be undone. All team data, members, and submissions will be permanently deleted.
                            </p>
                            
                            <div className="flex gap-3 pt-2">
                                <button 
                                    onClick={() => setShowDeleteConfirm(false)} 
                                    className="flex-1 px-4 py-2 border border-oxford/20 text-oxford/60 font-bold rounded text-sm uppercase hover:bg-oxford/5 transition-all"
                                >
                                    Cancel
                                </button>
                                <button 
                                    onClick={handleDeleteTeam} 
                                    className="flex-1 px-4 py-2 bg-red-600 text-white font-bold rounded text-sm uppercase hover:bg-red-700 transition-all shadow hover:shadow-md active:scale-95"
                                >
                                    Delete Team
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            {/* Notification Toast */}
            {notification && (
                <div className={cn(
                    "fixed bottom-6 right-6 z-100 p-4 rounded-lg shadow-2xl border-2 animate-in slide-in-from-bottom-4 fade-in duration-300 min-w-[300px]",
                    notification.type === 'success' ? "bg-green-50 border-green-200 text-green-800" :
                    notification.type === 'error' ? "bg-red-50 border-red-200 text-red-800" :
                    notification.type === 'info' ? "bg-blue-50 border-blue-200 text-blue-800" :
                    "bg-yellow-50 border-yellow-200 text-yellow-800"
                )}>
                    <div className="flex items-start gap-3">
                        {notification.type === 'success' && <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5" />}
                        {notification.type === 'error' && <XCircle className="w-5 h-5 text-red-600 mt-0.5" />}
                        {notification.type === 'info' && <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />}
                        {notification.type === 'warning' && <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />}
                        <p className="font-bold text-sm flex-1">{notification.message}</p>
                        <button 
                            onClick={() => setNotification(null)}
                            className="p-1 hover:bg-black/10 rounded transition-all"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}