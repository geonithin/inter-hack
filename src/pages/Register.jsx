import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Trash2, PlusCircle, CheckCircle2 } from 'lucide-react';
import { cn, getSupabaseErrorMessage, ensureProfile } from '../lib/utils';
import { supabase } from '../lib/supabase';

export default function Register() {
    const navigate = useNavigate();
    const [teamData, setTeamData] = useState({
        name: '',
        department: '',
        year: '',
        section: '',
    });
    const [teamSize, setTeamSize] = useState(2);

    const [leadData, setLeadData] = useState({
        name: '',
        registerNumber: '',
        email: '',
        phone: '',
        password: '',
        confirmPassword: '',
    });

    const [members, setMembers] = useState([]);

    const handleMemberChange = (index, field, value) => {
        const newMembers = [...members];
        newMembers[index][field] = value;
        setMembers(newMembers);
    };

    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const checkUser = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setLeadData(prev => ({
                    ...prev,
                    name: user.user_metadata.full_name || user.user_metadata.name || '',
                    email: user.email || '',
                    // Password can be hidden/ignored if logged in via OAuth
                }));
            }
        };
        checkUser();
    }, []);

    // Auto-populate members array when team size changes
    useEffect(() => {
        const numMembersNeeded = teamSize - 1;
        if (members.length !== numMembersNeeded) {
            const newMembers = Array.from({ length: numMembersNeeded }, (_, i) =>
                members[i] || { name: '', registerNumber: '', email: '', phone: '', department: '', year: '', section: '' }
            );
            setMembers(newMembers);
        }
    }, [teamSize]);

    const handleGoogleAuth = async () => {
        setIsLoading(true);
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}/register`,
                    queryParams: {
                        access_type: 'offline',
                        prompt: 'select_account'
                    },
                    scopes: 'email profile'
                }
            });
            if (error) throw error;
        } catch (error) {
            console.error('Google Auth Error:', error);
            alert(`Google Authentication failed: ${error.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // 0. Check for existing session
        const { data: { user } } = await supabase.auth.getUser();

        // Strict Validation (only if not logged in via Google)
        if (!user && leadData.password !== leadData.confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        const allRegNumbers = [leadData.registerNumber, ...members.map(m => m.registerNumber)];
        if (allRegNumbers.some(n => n === '')) {
            alert("All registration numbers must be filled!");
            return;
        }

        const uniqueRegNumbers = new Set(allRegNumbers);
        if (uniqueRegNumbers.size !== allRegNumbers.length) {
            alert("Each team member (including Lead) must have a unique register number!");
            return;
        }

        const allEmails = [leadData.email, ...members.map(m => m.email)];
        if (new Set(allEmails).size !== allEmails.length) {
            alert("Each member must have a unique email!");
            return;
        }

        setIsLoading(true);
        try {
            // 1. Check for existing session (e.g. from Google Auth)
            let userId;
            const { data: { user } } = await supabase.auth.getUser();

            if (user) {
                userId = user.id;
                console.log('Using existing authenticated user:', user.email);
            } else {
                // 1. Sign up the Lead in Supabase Auth
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: leadData.email,
                    password: leadData.password,
                    options: {
                        data: {
                            full_name: leadData.name,
                            role: 'lead'
                        }
                    }
                });

                if (authError) throw authError;

                userId = authData.user?.id;
                if (!userId) throw new Error("Could not get User ID");
                
                // For new signups, wait a bit for the trigger to execute
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // 2. Ensure profile exists (fallback creation)
            const profile = await ensureProfile(supabase, { id: userId, email: leadData.email, user_metadata: { full_name: leadData.name, role: 'lead' } });

            // 3. Create Team
            const { data: teamRecord, error: teamError } = await supabase
                .from('teams')
                .insert([{
                    name: teamData.name,
                    department: teamData.department,
                    year: teamData.year,
                    section: teamData.section,
                    lead_id: userId
                }])
                .select()
                .single();

            if (teamError) throw teamError;

            // 4. Create Members
            if (members.length > 0) {
                const membersToInsert = members.map(m => ({
                    team_id: teamRecord.id,
                    name: m.name,
                    register_number: m.registerNumber,
                    email: m.email,
                    phone: m.phone,
                    department: m.department,
                    year: m.year,
                    section: m.section
                }));

                const { error: membersError } = await supabase
                    .from('members')
                    .insert(membersToInsert);

                if (membersError) throw membersError;
            }

            alert('Registration Successful! Please check your email for verification if enabled, or login now.');
            navigate('/login');
        } catch (error) {
            console.error('Registration error:', error);
            alert(getSupabaseErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto mt-8 mb-16 px-4 px-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl oxford-edge border-4">
                {/* Header */}
                <div className="bg-oxford p-4 sm:p-6 text-white flex items-center justify-between">
                    <div className="flex items-center space-x-4 sm:space-x-8">
                        {/* Logo Badge Container */}
                        <div className="bg-white p-1.5 sm:p-2.5 rounded-2xl shadow-xl flex items-center justify-center shrink-0">
                            <img src="/clg-logo.png" alt="Logo" className="w-10 h-10 sm:w-20 sm:h-20 object-contain" />
                        </div>
                        <div className="flex flex-col justify-center">
                            <h2 className="text-lg sm:text-3xl font-black uppercase tracking-tighter leading-none mb-1 sm:mb-1.5">Register Team</h2>
                            <p className="text-[9px] sm:text-base opacity-70 font-bold tracking-tight leading-none">Lead acts as account owner</p>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8">
                    <div className="space-y-8">
                            <div className="space-y-6">
                                <div className="bg-oxford/5 p-6 rounded-2xl border-2 border-oxford/10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h4 className="text-sm font-black text-oxford uppercase tracking-widest">New: Fast Registration</h4>
                                        <span className="bg-oxford text-white text-[8px] px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">Recommended</span>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleGoogleAuth}
                                        className="w-full flex items-center justify-center gap-3 bg-white border-2 border-oxford/10 py-3 rounded-xl hover:bg-gray-50 transition-all shadow-md active:scale-95 group"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                                        </svg>
                                        <span className="text-oxford font-black uppercase tracking-widest text-[10px]">Verify identity with Google</span>
                                    </button>
                                    <p className="text-[9px] text-oxford/40 font-bold text-center">Auto-verifies your email and simplifies registration</p>
                                </div>

                                <h3 className="text-lg font-bold text-oxford uppercase border-b-2 border-oxford/10 pb-2 flex items-center gap-2">
                                    <Users className="w-5 h-5" /> Team Specification
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-2">
                                        <label className="text-sm font-black text-oxford uppercase tracking-widest pl-1">Team Name</label>
                                        <input required value={teamData.name} onChange={(e) => setTeamData({ ...teamData, name: e.target.value })} className="w-full p-3 border-2 border-oxford/10 rounded-lg focus:border-oxford outline-none transition-all" placeholder="Enter team name" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs sm:text-sm font-black text-oxford uppercase tracking-widest pl-1">Department</label>
                                        <select required value={teamData.department} onChange={(e) => setTeamData({ ...teamData, department: e.target.value })} className="w-full p-3 sm:p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm sm:text-base">
                                            <option value="">Select Department</option>
                                            <option>Computer Science</option>
                                            <option>Electronics</option>
                                            <option>Mechanical</option>
                                            <option>Civil</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs sm:text-sm font-black text-oxford uppercase tracking-widest pl-1">Year</label>
                                        <select required value={teamData.year} onChange={(e) => setTeamData({ ...teamData, year: e.target.value })} className="w-full p-3 sm:p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm sm:text-base">
                                            <option value="">Select Year</option>
                                            <option>1st Year</option>
                                            <option>2nd Year</option>
                                            <option>3rd Year</option>
                                            <option>4th Year</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs sm:text-sm font-black text-oxford uppercase tracking-widest pl-1">Section</label>
                                        <input required value={teamData.section} onChange={(e) => setTeamData({ ...teamData, section: e.target.value })} className="w-full p-3 sm:p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm sm:text-base" placeholder="e.g. A, B, C" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs sm:text-sm font-black text-oxford uppercase tracking-widest pl-1">Total Team Size</label>
                                        <select
                                            required
                                            value={teamSize}
                                            onChange={(e) => setTeamSize(parseInt(e.target.value))}
                                            className="w-full p-3 sm:p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm sm:text-base bg-emerald-50/50 border-emerald-200"
                                        >
                                            {[2, 3, 4, 5].map(size => (
                                                <option key={size} value={size}>{size} Members (Lead + {size - 1} Others)</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-8 sm:space-y-10 bg-oxford/5 p-6 sm:p-12 rounded-2xl sm:rounded-3xl border-2 sm:border-4 border-oxford/10">
                                <h3 className="text-xl sm:text-2xl font-black text-oxford uppercase border-b-2 sm:border-b-4 border-oxford/20 pb-4 sm:pb-6 flex items-center gap-3 sm:gap-4">
                                    <CheckCircle2 className="w-6 h-6 sm:w-8 sm:h-8 text-oxford" /> Lead Details
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Lead Full Name</label>
                                        <input required value={leadData.name} onChange={(e) => setLeadData({ ...leadData, name: e.target.value })} className="w-full p-2.5 sm:p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none bg-white font-bold text-sm" placeholder="Lead Name" />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs sm:text-sm font-black text-oxford uppercase tracking-widest pl-1">Lead Register No</label>
                                        <input required value={leadData.registerNumber} onChange={(e) => setLeadData({ ...leadData, registerNumber: e.target.value })} className="w-full p-3 sm:p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none bg-white font-bold text-sm sm:text-base" placeholder="unique ID" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Lead Email</label>
                                        <input type="email" required value={leadData.email} onChange={(e) => setLeadData({ ...leadData, email: e.target.value })} className="w-full p-2.5 sm:p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none bg-white font-bold text-sm" placeholder="lead@college.edu" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Lead Phone</label>
                                        <input required value={leadData.phone} onChange={(e) => setLeadData({ ...leadData, phone: e.target.value })} className="w-full p-2.5 sm:p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none bg-white font-bold text-sm" placeholder="+91 00000" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Password</label>
                                        <input type="password" required value={leadData.password} onChange={(e) => setLeadData({ ...leadData, password: e.target.value })} className="w-full p-2.5 sm:p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none bg-white font-bold text-sm" placeholder="••••••••" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Confirm Password</label>
                                        <input type="password" required value={leadData.confirmPassword} onChange={(e) => setLeadData({ ...leadData, confirmPassword: e.target.value })} className="w-full p-2.5 sm:p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none bg-white font-bold text-sm" placeholder="••••••••" />
                                    </div>
                                </div>
                            </div>

                            {/* Team Members Section */}
                            {members.length > 0 && (
                                <div className="space-y-6 bg-oxford/5 p-6 rounded-2xl border-2 border-oxford/10">
                                    <h3 className="text-lg font-bold text-oxford uppercase border-b-2 border-oxford/10 pb-2 flex items-center gap-2">
                                        <Users className="w-5 h-5" /> Other Team Members
                                    </h3>
                                    <div className="space-y-6">
                                        {members.map((member, idx) => (
                                            <div key={idx} className="space-y-4 p-6 bg-white rounded-xl border-2 border-oxford/10">
                                                <h4 className="text-sm font-black text-oxford uppercase tracking-widest">Member {idx + 2}</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Full Name</label>
                                                        <input
                                                            required
                                                            value={member.name}
                                                            onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                                                            className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                            placeholder="Member Name"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Register No</label>
                                                        <input
                                                            required
                                                            value={member.registerNumber}
                                                            onChange={(e) => handleMemberChange(idx, 'registerNumber', e.target.value)}
                                                            className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                            placeholder="Unique ID"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Email</label>
                                                        <input
                                                            type="email"
                                                            required
                                                            value={member.email}
                                                            onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                                                            className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                            placeholder="email@college.edu"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Phone</label>
                                                        <input
                                                            required
                                                            value={member.phone}
                                                            onChange={(e) => handleMemberChange(idx, 'phone', e.target.value)}
                                                            className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                            placeholder="+91 00000"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Department</label>
                                                        <input
                                                            required
                                                            value={member.department}
                                                            onChange={(e) => handleMemberChange(idx, 'department', e.target.value)}
                                                            className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                            placeholder="e.g. CSE"
                                                        />
                                                    </div>
                                                    <div className="grid grid-cols-2 gap-4">
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Year</label>
                                                            <input
                                                                required
                                                                value={member.year}
                                                                onChange={(e) => handleMemberChange(idx, 'year', e.target.value)}
                                                                className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                                placeholder="Year"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Section</label>
                                                            <input
                                                                required
                                                                value={member.section}
                                                                onChange={(e) => handleMemberChange(idx, 'section', e.target.value)}
                                                                className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                                placeholder="Sec"
                                                            />
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            <div className="flex justify-end pt-4">
                                <button
                                    type="submit"
                                    disabled={isLoading}
                                    className="bg-oxford text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-oxford-dark transition-all shadow-xl active:scale-95 text-sm flex items-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed"
                                >
                                    {isLoading ? (
                                        <>
                                            <div className="w-5 h-5 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                            <span>Processing...</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-5 h-5" />
                                            <span>Register Team</span>
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            </div>
        );

}
