import { useState } from 'react';
import { Send, FileText, CheckCircle, AlertCircle } from 'lucide-react';
import { cn } from '../lib/utils';
import { supabase } from '../lib/supabase';

export default function SubmissionForm({ problemStatement, onCancel, onSubmitSuccess }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        techStack: '',
        solutionLink: '',
    });

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSubmitted, setIsSubmitted] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);

        try {
            // Get current user with error handling
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) throw new Error(`Authentication error: ${authError.message}`);
            if (!user) throw new Error("No user session found. Please log in again.");

            console.log('Current user ID:', user.id);

            // Fetch team ID with improved error handling
            const { data: team, error: teamError } = await supabase
                .from('teams')
                .select('id, name, lead_id')
                .eq('lead_id', user.id)
                .maybeSingle();

            if (teamError) {
                console.error('Team fetch error:', teamError);
                throw new Error(`Failed to fetch team: ${teamError.message}`);
            }
            
            if (!team) {
                throw new Error("No team found for your account. Please register a team first.");
            }

            console.log('Team found:', { id: team.id, name: team.name, lead_id: team.lead_id });

            // Prepare submission data
            const submissionData = {
                team_id: team.id,
                statement_id: problemStatement.id,
                title: formData.title.trim(),
                description: formData.description.trim(),
                tech_stack: formData.techStack.trim(),
                solution_link: formData.solutionLink.trim() || null,
            };

            console.log('Submitting data:', submissionData);

            // Insert submission with detailed error handling
            const { data: insertedData, error: submitError } = await supabase
                .from('submissions')
                .insert([submissionData])
                .select()
                .maybeSingle();

            if (submitError) {
                console.error('Submit error details:', {
                    code: submitError.code,
                    message: submitError.message,
                    details: submitError.details,
                    hint: submitError.hint
                });
                
                // Provide user-friendly error messages
                let errorMessage = 'Submission failed';
                if (submitError.code === '42501') {
                    errorMessage = 'Permission denied. Please ensure you are logged in as a team lead.';
                } else if (submitError.code === '23505') {
                    errorMessage = 'You have already submitted for this problem statement.';
                } else {
                    errorMessage = `${errorMessage}: ${submitError.message}`;
                }
                
                throw new Error(errorMessage);
            }

            if (!insertedData) {
                throw new Error('Submission was processed but no confirmation received. Please check your dashboard.');
            }

            console.log('Submission successful:', insertedData);
            setIsSubmitted(true);
            
            // Create submission notification
            try {
                const { error: notificationError } = await supabase
                    .from('notifications')
                    .insert([{
                        recipient_id: user.id,
                        recipient_type: 'lead',
                        title: 'Submission Received!',
                        message: `Your team "${team.name}" has successfully submitted the solution for problem statement: "${problemStatement.title}". Your submission is now under review by the faculty.`,
                        type: 'success',
                        is_read: false,
                        sender_type: 'system',
                        team_id: team.id
                    }]);

                if (notificationError) {
                    console.error('Error creating submission notification:', notificationError);
                }
            } catch (notifError) {
                console.error('Notification error:', notifError);
                // Don't fail the submission if notification fails
            }
            
            // Call the success callback with the submission data
            if (onSubmitSuccess) {
                onSubmitSuccess(insertedData);
            }
        } catch (error) {
            console.error('Submission error:', error);
            alert(error.message || 'Failed to submit. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (isSubmitted) {
        return (
            <div className="text-center py-12 space-y-4">
                <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle className="w-10 h-10 text-white" />
                </div>
                <h3 className="text-2xl font-bold text-oxford uppercase">Idea Submitted!</h3>
                <p className="text-oxford/60 max-w-sm mx-auto">Your team's idea has been successfully recorded. You will be notified of the results through the dashboard.</p>
                <button
                    onClick={onCancel}
                    className="bg-oxford text-white px-8 py-3 rounded-lg font-bold uppercase tracking-widest"
                >
                    Return to Dashboard
                </button>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-in slide-in-from-bottom-4 duration-500">
            <div className="bg-oxford/5 p-4 sm:p-6 rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-oxford/10 space-y-1.5 sm:space-y-2">
                <p className="text-[9px] sm:text-xs font-black text-oxford uppercase opacity-50 tracking-[0.2em]">Submitting for Problem Statement:</p>
                <h4 className="text-lg sm:text-2xl font-black text-oxford uppercase tracking-tighter leading-tight">{problemStatement.title}</h4>
            </div>

            <form onSubmit={handleSubmit} className="space-y-10">
                <div className="space-y-2">
                    <label className="text-sm font-black text-oxford uppercase tracking-widest pl-2">Idea Title</label>
                    <input
                        required
                        value={formData.title}
                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                        className="w-full p-2.5 sm:p-3.5 border-2 sm:border-4 border-oxford/10 rounded-xl sm:rounded-2xl focus:border-oxford outline-none font-bold text-sm sm:text-base transition-all shadow-sm"
                        placeholder="Give your idea a catchy name"
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-black text-oxford uppercase tracking-widest pl-2">Detailed Solution Overview</label>
                    <textarea
                        required
                        value={formData.description}
                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                        rows={5}
                        className="w-full p-2.5 sm:p-3.5 border-2 sm:border-4 border-oxford/10 rounded-xl sm:rounded-2xl focus:border-oxford outline-none font-bold text-[10px] sm:text-sm transition-all shadow-sm"
                        placeholder="Describe how you plan to solve the problem..."
                    />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Technology Stack</label>
                        <input
                            required
                            value={formData.techStack}
                            onChange={(e) => setFormData({ ...formData, techStack: e.target.value })}
                            className="w-full p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none font-bold transition-all"
                            placeholder="e.g. React, Node.js"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">External Links (Optional)</label>
                        <input
                            value={formData.solutionLink}
                            onChange={(e) => setFormData({ ...formData, solutionLink: e.target.value })}
                            className="w-full p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none font-bold transition-all"
                            placeholder="GitHub or Figma link"
                        />
                    </div>
                </div>

                <div className="pt-8 flex flex-col sm:flex-row gap-6">
                    <button
                        type="button"
                        onClick={onCancel}
                        className="flex-1 border-2 border-oxford text-oxford py-4 rounded-xl font-black uppercase tracking-widest hover:bg-gray-50 transition-all shadow-lg active:scale-95 text-xs"
                    >
                        Cancel
                    </button>
                    <button
                        type="submit"
                        disabled={isSubmitting}
                        className="flex-1 bg-oxford text-white py-4 rounded-xl font-black uppercase tracking-widest hover:bg-oxford-dark transition-all flex items-center justify-center gap-3 shadow-xl active:scale-95 text-xs"
                    >
                        {isSubmitting ? "Processing..." : <><Send className="w-5 h-5" /> Final submission</>}
                    </button>
                </div>
            </form>

            <div className="flex items-start gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5" />
                <p className="text-[10px] text-amber-700 font-medium leading-relaxed">
                    Important: Once submitted, you cannot edit your idea. Please ensure all details are correct before hitting Final Submit.
                </p>
            </div>
        </div>
    );
}
