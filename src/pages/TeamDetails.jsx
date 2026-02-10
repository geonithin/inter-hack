import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Users, CheckCircle2, Mail, Hash, Calendar, FileText, ExternalLink, AlertCircle, Edit, Download } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function TeamDetails() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { isAuthenticated, getUserRole } = useAuth();
    const [team, setTeam] = useState(null);
    const [teamMembers, setTeamMembers] = useState([]);
    const [submission, setSubmission] = useState(null);
    const [problemStatement, setProblemStatement] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [exporting, setExporting] = useState(false);
    
    // Quick test function to check database connectivity
    const testDatabase = async () => {
        try {
            console.log('🧪 Testing database connection...');
            const { data: profileTest } = await supabase.from('profiles').select('id').limit(1);
            console.log('✅ Profiles table accessible:', profileTest?.length || 0);
            
            const { data: teamsTest } = await supabase.from('teams').select('id, name').limit(3);
            console.log('✅ Teams table accessible:', teamsTest?.length || 0, teamsTest);
            
            const { data: submissionsTest, error: subError } = await supabase.from('submissions').select('*').limit(3);
            console.log('🎯 Submissions table test:', { count: submissionsTest?.length || 0, error: subError?.message, data: submissionsTest });
        } catch (e) {
            console.error('💥 Database test failed:', e);
        }
    };

    const fetchTeamDetails = useCallback(async () => {
        try {
            setLoading(true);
            setError(null);

            // Fetch team details with problem statement and lead profile
            const { data: teamData, error: teamError } = await supabase
                .from('teams')
                .select(`
                    *,
                    problem_statements(*),
                    profiles!teams_lead_id_fkey(full_name, email)
                `)
                .eq('id', id)
                .single();

            if (teamError) throw teamError;
            if (!teamData) throw new Error('Team not found');

            setTeam(teamData);
            setProblemStatement(teamData.problem_statements);

            // Fetch team members
            const { data: membersData, error: membersError } = await supabase
                .from('members')
                .select('*')
                .eq('team_id', id)
                .order('name');

            if (membersError) throw membersError;
            setTeamMembers(membersData || []);

            // Fetch team submission if exists - with comprehensive debugging
            console.log('🔍 Starting submission fetch for team_id:', id, 'type:', typeof id);
            
            // Test 1: Check if submissions table exists
            try {
                const { count, error: countError } = await supabase
                    .from('submissions')
                    .select('*', { count: 'exact', head: true });
                console.log('📊 Submissions table check - count:', count, 'error:', countError);
            } catch (e) {
                console.log('⚠️ Table check failed:', e.message);
            }
            
            // Test 2: Get all submissions (to check if table has any data at all)
            const { data: allSubmissions, error: allError } = await supabase
                .from('submissions')
                .select('*')
                .limit(10);
            console.log('📝 All submissions in table:', allSubmissions?.length || 0, 'error:', allError?.message);
            
            // Test 3: Check team existence and get team details
            const { data: teamCheck, error: teamCheckError } = await supabase
                .from('teams')
                .select('id, name')
                .eq('id', id)
                .single();
            console.log('👥 Team exists check:', { teamCheck, teamCheckError });
            
            // Test 4: Main submission query
            const { data: submissionData, error: submissionError } = await supabase
                .from('submissions')
                .select('*')
                .eq('team_id', id);

            console.log('🎯 Final submission query result:', { 
                submissionData, 
                submissionError,
                teamId: id,
                foundCount: submissionData?.length || 0
            });
            
            if (submissionError) {
                console.warn('❌ Error fetching submission:', submissionError);
                if (submissionError.message?.includes('relation "submissions" does not exist')) {
                    console.error('🚫 CRITICAL: Submissions table does not exist!');
                    setError('Submissions table missing - please run the migration');
                } else if (submissionError.message?.includes('permission denied')) {
                    console.error('🔒 CRITICAL: Permission denied - check RLS policies');
                    setError('Permission denied - check database policies');
                }
            } else if (submissionData && submissionData.length > 0) {
                console.log('✅ SUCCESS: Found submission:', submissionData[0]);
                setSubmission(submissionData[0]);
            } else {
                console.log('ℹ️ INFO: No submissions found for team:', id);
                setSubmission(null);
            }

        } catch (error) {
            console.error('Error fetching team details:', error);
            setError(error.message);
        } finally {
            setLoading(false);
        }
    }, [id]);

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
                ['Name:', team.profiles?.full_name || 'Unknown'],
                ['Email:', team.profiles?.email || 'Not provided'],
                ['Department:', team.department || 'Unknown'],
                ['Year - Section:', `${team.year} - ${team.section}`]
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

        // Run database test first
        testDatabase();
        
        fetchTeamDetails();
    }, [id, isAuthenticated, getUserRole, navigate, fetchTeamDetails]);

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
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                    <div className="flex items-center justify-between flex-wrap gap-4">
                        <div>
                            <h1 className="text-3xl sm:text-4xl font-black text-oxford uppercase tracking-tight mb-1">
                                {team.name}
                            </h1>
                            <p className="text-sm text-oxford/50 font-bold uppercase tracking-widest">
                                Comprehensive Team Details
                            </p>
                        </div>
                        <div className="flex items-center gap-3">
                            <button
                                onClick={handleExportPDF}
                                disabled={exporting}
                                className={cn(
                                    "px-6 py-3 bg-gradient-to-r from-oxford to-oxford-dark text-white font-black rounded-xl uppercase tracking-widest text-xs hover:shadow-lg transition-all flex items-center gap-2",
                                    exporting && "opacity-50 cursor-not-allowed"
                                )}
                            >
                                <Download className="w-4 h-4" />
                                {exporting ? 'Exporting...' : 'Export as PDF'}
                            </button>
                        <div className={cn(
                            "px-5 py-2.5 rounded-full font-black text-xs uppercase tracking-widest border-2 shadow-sm transition-all",
                            team.status === 'Selected' ? "bg-green-50 text-green-700 border-green-300 shadow-green-100" :
                                team.status === 'Rejected' ? "bg-red-50 text-red-700 border-red-300 shadow-red-100" :
                                    "bg-amber-50 text-amber-700 border-amber-300 shadow-amber-100"
                        )}>
                            <div className={cn(
                                "inline-block w-2.5 h-2.5 rounded-full mr-2 animate-pulse",
                                team.status === 'Selected' ? "bg-green-500" :
                                    team.status === 'Rejected' ? "bg-red-500" :
                                        "bg-amber-500"
                            )} />
                            {team.status}
                        </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
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
                                        {team.profiles?.full_name || 'Unknown'}
                                    </p>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-2">
                                        Email Address
                                    </p>
                                    <div className="flex items-center gap-2">
                                        <Mail className="w-4 h-4 text-oxford/60" />
                                        <p className="text-sm font-medium text-oxford">
                                            {team.profiles?.email || 'Not provided'}
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-2">
                                        Department
                                    </p>
                                    <p className="text-lg font-black text-oxford uppercase">
                                        {team.department || 'Unknown'}
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
                                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
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
                                                    <p className="font-medium text-oxford/80 text-xs">{member.email}</p>
                                                </div>
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
                    <div className="lg:col-span-1">
                        <div className="bg-white p-7 rounded-2xl shadow-xl border border-oxford/10 sticky top-8 hover:shadow-2xl transition-shadow duration-300">
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
                                    <div>
                                        <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-3">
                                            Idea Title
                                        </p>
                                        <h3 className="text-lg font-black text-oxford leading-tight">
                                            {submission.title}
                                        </h3>
                                    </div>

                                    {/* Solution Overview */}
                                    <div>
                                        <p className="text-xs font-black text-oxford/40 uppercase tracking-widest mb-3">
                                            Solution Overview
                                        </p>
                                        <p className="text-sm text-oxford/70 leading-relaxed">
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
                                                <h4 className="font-bold text-amber-800 mb-2">🔧 Setup Required</h4>
                                                <p className="text-sm text-amber-700 mb-2">
                                                    The submissions table needs to be created in your database.
                                                </p>
                                                <p className="text-xs text-amber-600">
                                                    Please run the migration in <code>supabase/migrations/20260210_fix_submissions_table.sql</code> in your Supabase SQL editor.
                                                </p>
                                            </div>
                                            <div className="text-center py-4 text-oxford/40">
                                                <Edit className="w-12 h-12 mx-auto mb-3 opacity-30" />
                                                <p className="font-black uppercase tracking-widest text-sm">Database Setup Needed</p>
                                                <p className="text-xs text-oxford/30 mt-1">See SUBMISSIONS_SETUP.md for instructions</p>
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
        </div>
    );
}