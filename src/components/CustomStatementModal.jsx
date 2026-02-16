import { useState } from 'react';
import { X, FileText, Send, AlertCircle, CheckCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function CustomStatementModal({ isOpen, onClose, onSuccess, teamData }) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        department: teamData?.department || 'CSE'
    });
    
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState(null);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        setError(null);

        try {
            // Get current user
            const { data: { user }, error: authError } = await supabase.auth.getUser();
            if (authError) throw new Error(`Authentication error: ${authError.message}`);
            if (!user) throw new Error("No user session found. Please log in again.");

            // Get team ID
            const { data: team, error: teamError } = await supabase
                .from('teams')
                .select('id')
                .eq('lead_id', user.id)
                .maybeSingle();

            if (teamError) throw new Error(`Failed to fetch team: ${teamError.message}`);
            if (!team) throw new Error("No team found for your account. Please register a team first.");

            // Check if team already has a custom statement
            const { data: existingStatement, error: checkError } = await supabase
                .from('custom_problem_statements')
                .select('id')
                .eq('team_id', team.id)
                .maybeSingle();

            if (checkError && checkError.code !== 'PGRST116') {
                throw new Error(`Error checking existing statement: ${checkError.message}`);
            }

            if (existingStatement) {
                throw new Error('Your team already has a custom problem statement. You can only create one.');
            }

            // Create custom statement
            const { data: customStatement, error: insertError } = await supabase
                .from('custom_problem_statements')
                .insert([{
                    team_id: team.id,
                    title: formData.title.trim(),
                    description: formData.description.trim(),
                    department: formData.department
                }])
                .select()
                .single();

            if (insertError) {
                console.error('Insert error:', insertError);
                throw new Error(`Failed to create statement: ${insertError.message}`);
            }

            // Create notification for faculty
            try {
                const { error: notifError } = await supabase
                    .from('notifications')
                    .insert([{
                        recipient_type: 'faculty',
                        title: 'New Custom Statement Created',
                        message: `Team "${teamData?.name || 'Unknown'}" has created a custom problem statement: "${formData.title}". View it in the Custom Statements tab.`,
                        type: 'info',
                        is_read: false,
                        sender_type: 'system'
                    }]);

                if (notifError) {
                    console.error('Notification error:', notifError);
                }
            } catch (notifErr) {
                console.error('Failed to create notification:', notifErr);
            }

            // Success!
            if (onSuccess) {
                onSuccess(customStatement);
            }
            
            onClose();
        } catch (err) {
            console.error('Error creating custom statement:', err);
            setError(err.message || 'Failed to create custom statement');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-3 animate-in fade-in duration-200">
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[92vh] overflow-y-auto animate-in slide-in-from-bottom-4 duration-300">
                {/* Header */}
                <div className="sticky top-0 bg-gradient-to-r from-emerald-600 to-emerald-700 p-4 rounded-t-xl border-b-2 border-emerald-800 shadow-lg z-10">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2.5">
                            <div className="p-1.5 bg-white/10 rounded-lg">
                                <FileText className="w-5 h-5 text-white" />
                            </div>
                            <div>
                                <h2 className="text-lg font-black text-white uppercase tracking-tight">
                                    Create Own Statement
                                </h2>
                                <p className="text-[10px] text-white/70 font-bold uppercase tracking-widest mt-0.5">
                                    Define your custom problem
                                </p>
                            </div>
                        </div>
                        <button 
                            onClick={onClose}
                            className="p-1.5 hover:bg-white/10 rounded-lg transition-all"
                        >
                            <X className="w-4 h-4 text-white" />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <form onSubmit={handleSubmit} className="p-4 space-y-3.5">
                    {/* Info Banner */}
                    <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                            <p className="text-xs text-emerald-800 leading-relaxed">
                                Define your unique problem. You can start working on it immediately! <span className="font-bold">One statement per team.</span>
                            </p>
                        </div>
                    </div>

                    {/* Error Display */}
                    {error && (
                        <div className="bg-red-50 border border-red-200 rounded-lg p-2.5">
                            <div className="flex items-start gap-2">
                                <AlertCircle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
                                <p className="text-xs text-red-700 font-medium">{error}</p>
                            </div>
                        </div>
                    )}

                    {/* Form Fields */}
                    <div className="space-y-2.5">
                        {/* Department */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-oxford uppercase tracking-widest">
                                Department *
                            </label>
                            <select
                                required
                                value={formData.department}
                                onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                                className="w-full p-2.5 sm:p-3 border-2 border-oxford/10 rounded-lg focus:border-emerald-500 outline-none font-bold text-sm transition-all bg-white"
                            >
                                <option value="CSE">CSE</option>
                                <option value="AIDS">AIDS</option>
                                <option value="ECE">ECE</option>
                                <option value="EEE">EEE</option>
                                <option value="MECH">MECH</option>
                                <option value="CIVIL">CIVIL</option>
                                <option value="MBA">MBA</option>
                            </select>
                        </div>

                        {/* Problem Statement Title */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-oxford uppercase tracking-widest">
                                Problem Title *
                            </label>
                            <input
                                required
                                type="text"
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full p-2.5 sm:p-3 border-2 border-oxford/10 rounded-lg focus:border-emerald-500 outline-none font-bold text-sm transition-all"
                                placeholder="Smart Campus Energy Management"
                                maxLength={200}
                            />
                            <p className="text-[10px] text-oxford/40">
                                {formData.title.length}/200
                            </p>
                        </div>

                        {/* Problem Description */}
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-oxford uppercase tracking-widest">
                                Problem Description *
                            </label>
                            <textarea
                                required
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                rows={5}
                                className="w-full p-2.5 sm:p-3 border-2 border-oxford/10 rounded-lg focus:border-emerald-500 outline-none text-sm transition-all resize-none leading-relaxed"
                                placeholder="Describe the problem, why it matters, who benefits, and expected outcomes... (min 20 chars)"
                                minLength={20}
                            />
                            <p className="text-[10px] text-oxford/40">
                                {formData.description.length} chars (min 20)
                            </p>
                        </div>
                    </div>

                    {/* Warning */}
                    <div className="bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                        <div className="flex items-start gap-2">
                            <AlertCircle className="w-3.5 h-3.5 text-amber-600 mt-0.5 shrink-0" />
                            <p className="text-[10px] text-amber-700 leading-relaxed">
                                <span className="font-bold">Important:</span> Cannot modify after creation. Make sure details are accurate.
                            </p>
                        </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="flex-1 px-4 py-2.5 sm:py-3 border-2 border-oxford text-oxford rounded-lg font-black uppercase tracking-widest hover:bg-gray-50 transition-all disabled:opacity-50 disabled:cursor-not-allowed text-xs"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting || formData.description.length < 20}
                            className="flex-1 px-4 py-2.5 sm:py-3 bg-emerald-600 text-white rounded-lg font-black uppercase tracking-widest hover:bg-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-lg text-xs"
                        >
                            {isSubmitting ? (
                                'Creating...'
                            ) : (
                                <>
                                    <Send className="w-4 h-4" />
                                    Create
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
