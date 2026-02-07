import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Trash2, PlusCircle, CheckCircle2 } from 'lucide-react';
import { cn, getSupabaseErrorMessage, ensureProfile } from '../lib/utils';
import { supabase } from '../lib/supabase';

export default function Register() {
    const navigate = useNavigate();
    const [step, setStep] = useState(1);
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
    const [editingMemberIndex, setEditingMemberIndex] = useState(null);


    const handleMemberChange = (index, field, value) => {
        const newMembers = [...members];
        newMembers[index][field] = value;
        setMembers(newMembers);
    };

    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (leadData.password !== leadData.confirmPassword) {
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
            console.log('Starting registration process...', { teamData, leadData });
            
            // 1. Create new user account
            console.log('Creating new user account...');
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

            if (authError) {
                console.error('Auth signup error:', authError);
                throw authError;
            }

            const userId = authData.user?.id;
            if (!userId) throw new Error("Could not get User ID");
            
            console.log('New user created with ID:', userId);
            
            // Wait for the trigger to execute
            await new Promise(resolve => setTimeout(resolve, 1000));

            // 2. Ensure profile exists (fallback creation)
            console.log('Ensuring profile exists for user:', userId);
            const profile = await ensureProfile(supabase, { 
                id: userId, 
                email: leadData.email, 
                user_metadata: { 
                    full_name: leadData.name, 
                    role: 'lead' 
                } 
            });
            console.log('Profile ensured:', profile);

            // 3. Create Team
            console.log('Creating team record...');
            const teamInsertData = {
                name: teamData.name,
                department: teamData.department,
                year: teamData.year,
                section: teamData.section,
                lead_id: userId,
                lead_name: leadData.name,
                lead_email: leadData.email,
                lead_register_number: leadData.registerNumber,
                lead_phone: leadData.phone
            };
            console.log('Team data to insert:', teamInsertData);
            
            const { data: teamRecord, error: teamError } = await supabase
                .from('teams')
                .insert([teamInsertData])
                .select()
                .single();

            if (teamError) {
                console.error('Team creation error:', teamError);
                throw teamError;
            }
            
            console.log('Team created successfully:', teamRecord);

            // 4. Create Members
            if (members.length > 0) {
                console.log('Creating team members...');
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

                console.log('Members data to insert:', membersToInsert);
                
                const { error: membersError } = await supabase
                    .from('members')
                    .insert(membersToInsert);

                if (membersError) {
                    console.error('Members creation error:', membersError);
                    throw membersError;
                }
                console.log('Members created successfully');
            }

            console.log('Registration completed successfully!');
            alert('Registration Successful! You can now login with your credentials.');
            navigate('/login');
        } catch (error) {
            console.error('Registration error:', error);
            alert(`Registration failed: ${getSupabaseErrorMessage(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-5xl mx-auto mt-8 mb-16 px-4 px-6 animate-in fade-in slide-in-from-bottom-6 duration-700">
            <div className="bg-white rounded-2xl overflow-hidden shadow-2xl oxford-edge border-4">
                {/* Progress Bar */}
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
                    <div className="hidden sm:flex items-center space-x-6">
                        <div className={cn("flex items-center space-x-3", step === 1 ? "opacity-100" : "opacity-50")}>
                            <span className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-sm font-black">1</span>
                            <span className="text-sm font-black uppercase tracking-widest">Lead & Team</span>
                        </div>
                        <div className="w-12 h-px bg-white/30" />
                        <div className={cn("flex items-center space-x-3", step === 2 ? "opacity-100" : "opacity-50")}>
                            <span className="w-8 h-8 rounded-full border-2 border-white flex items-center justify-center text-sm font-black">2</span>
                            <span className="text-sm font-black uppercase tracking-widest">Members</span>
                        </div>
                    </div>
                </div>

                <form onSubmit={handleSubmit} className="p-4 sm:p-6 lg:p-8">
                    {step === 1 ? (
                        <div className="space-y-8">
                            <div className="space-y-6">
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

                            <div className="flex justify-end pt-4">
                                <button
                                    type="button"
                                    onClick={() => {
                                        const numMembersNeeded = teamSize - 1;
                                        if (members.length !== numMembersNeeded) {
                                            const newMembers = Array.from({ length: numMembersNeeded }, (_, i) =>
                                                members[i] || { name: '', registerNumber: '', email: '', phone: '', department: '', year: '', section: '' }
                                            );
                                            setMembers(newMembers);
                                        }
                                        setStep(2);
                                    }}
                                    className="bg-oxford text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest hover:bg-oxford-dark transition-all shadow-xl active:scale-95 text-sm"
                                >
                                    Next: Other Members
                                </button>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {editingMemberIndex === null ? (
                                <div className="space-y-8 animate-in fade-in duration-500">
                                    <div className="flex flex-col md:flex-row md:items-center justify-between border-b-2 sm:border-b-4 border-oxford pb-3 sm:pb-4 gap-4">
                                        <h3 className="text-base sm:text-lg md:text-2xl font-black text-oxford uppercase tracking-tighter leading-tight">Step 2: Other Team Members ({members.length}/{teamSize - 1})</h3>
                                    </div>

                                    <div className="space-y-6 min-h-[300px] flex flex-col">
                                        {members.length === 0 ? (
                                            <div className="flex-1 flex flex-col items-center justify-center p-12 text-center border-4 border-dashed border-oxford/10 rounded-3xl bg-gray-50/50 space-y-4">
                                                <div className="p-3 sm:p-6 bg-oxford/5 rounded-full">
                                                    <img src="/clg-logo.png" alt="SMCE Logo" className="w-16 h-16 sm:w-20 sm:h-20 object-contain opacity-20" />
                                                </div>
                                                <p className="text-oxford/40 font-black uppercase text-sm sm:text-base tracking-[0.2em]">Add your team member here</p>
                                                <p className="text-oxford/30 text-sm font-bold uppercase">Teams can have up to 5 members total (including lead)</p>
                                            </div>
                                        ) : (
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                                                {members.map((member, idx) => (
                                                    <div
                                                        key={idx}
                                                        onClick={() => setEditingMemberIndex(idx)}
                                                        className="p-4 sm:p-6 rounded-2xl border-2 border-oxford/10 bg-white hover:border-oxford transition-all cursor-pointer group relative shadow-md"
                                                    >
                                                        <div className="absolute top-2 right-2 md:top-3 md:right-3">
                                                            <div className={cn(
                                                                "p-1 rounded-full",
                                                                member.name && member.registerNumber ? "bg-emerald-100 text-emerald-600" : "bg-amber-100 text-amber-600"
                                                            )}>
                                                                <CheckCircle2 className="w-4 h-4" />
                                                            </div>
                                                        </div>
                                                        <div className="space-y-1 md:space-y-2">
                                                            <p className="text-[8px] md:text-[9px] font-black text-oxford/40 uppercase tracking-[0.2em]">Team Member {idx + 2}</p>
                                                            <h4 className="text-base sm:text-lg md:text-xl font-black text-oxford uppercase truncate">{member.name || "Unnamed Member"}</h4>
                                                            <div className="pt-1 flex flex-wrap gap-1 md:gap-2">
                                                                <span className="text-[8px] font-black bg-oxford/5 text-oxford px-2 py-0.5 rounded-full uppercase tracking-widest">{member.department || "No Dept"}</span>
                                                                <span className="text-[8px] font-black bg-oxford/5 text-oxford px-2 py-0.5 rounded-full uppercase tracking-widest">{member.registerNumber || "No ID"}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>

                                    <div className="flex flex-col sm:flex-row items-center justify-between pt-8 sm:pt-10 border-t-4 border-oxford/10 gap-4 sm:gap-0">
                                        <button type="button" onClick={() => setStep(1)} className="w-full sm:w-auto text-oxford font-black uppercase text-sm sm:text-base hover:underline tracking-widest transition-all text-center sm:text-left order-2 sm:order-1">Back to Step 1</button>
                                        <button
                                            type="submit"
                                            disabled={isLoading}
                                            className="w-full sm:w-auto bg-oxford text-white px-8 sm:px-12 py-4 sm:py-5 rounded-2xl font-black uppercase tracking-[0.2em] hover:bg-oxford-dark flex items-center justify-center space-x-3 shadow-2xl active:scale-95 transition-all text-sm sm:text-base order-1 sm:order-2 disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            {isLoading ? (
                                                <div className="w-5 h-5 sm:w-6 sm:h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6" />
                                            )}
                                            <span>{isLoading ? 'Processing...' : 'Finalize Registration'}</span>
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <div className="space-y-8 animate-in slide-in-from-right-8 duration-500">
                                    <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-4 border-oxford pb-4 sm:pb-6 gap-4">
                                        <div className="space-y-1">
                                            <p className="text-[10px] sm:text-sm font-black text-oxford/40 uppercase tracking-widest leading-none">Editing Details</p>
                                            <h3 className="text-xl sm:text-3xl font-black text-oxford uppercase tracking-tighter leading-tight">Team Member {editingMemberIndex + 2}</h3>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEditingMemberIndex(null)}
                                            className="w-full sm:w-auto px-6 sm:px-8 py-3 sm:py-4 bg-oxford text-white rounded-xl font-black uppercase tracking-widest hover:bg-oxford-dark shadow-xl active:scale-95 transition-all text-[10px] sm:text-sm"
                                        >
                                            Save & Return
                                        </button>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                        <div className="space-y-2">
                                            <label className="text-sm font-black text-oxford uppercase tracking-widest pl-2">Full Name</label>
                                            <input
                                                required
                                                value={members[editingMemberIndex].name}
                                                onChange={(e) => handleMemberChange(editingMemberIndex, 'name', e.target.value)}
                                                className="w-full p-4 text-lg border-2 border-oxford/10 rounded-2xl focus:border-oxford outline-none bg-white font-bold"
                                                placeholder="Member Name"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-black text-oxford uppercase tracking-widest pl-2">Register Number</label>
                                            <input
                                                required
                                                value={members[editingMemberIndex].registerNumber}
                                                onChange={(e) => handleMemberChange(editingMemberIndex, 'registerNumber', e.target.value)}
                                                className="w-full p-4 text-lg border-2 border-oxford/10 rounded-2xl focus:border-oxford outline-none bg-white font-bold"
                                                placeholder="Unique ID"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-black text-oxford uppercase tracking-widest pl-2">Email ID</label>
                                            <input
                                                type="email"
                                                required
                                                value={members[editingMemberIndex].email}
                                                onChange={(e) => handleMemberChange(editingMemberIndex, 'email', e.target.value)}
                                                className="w-full p-4 text-lg border-2 border-oxford/10 rounded-2xl focus:border-oxford outline-none bg-white font-bold"
                                                placeholder="email@college.edu"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-black text-oxford uppercase tracking-widest pl-2">Phone Number</label>
                                            <input
                                                required
                                                value={members[editingMemberIndex].phone}
                                                onChange={(e) => handleMemberChange(editingMemberIndex, 'phone', e.target.value)}
                                                className="w-full p-4 text-lg border-2 border-oxford/10 rounded-2xl focus:border-oxford outline-none bg-white font-bold"
                                                placeholder="+91 00000 00000"
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-black text-oxford uppercase tracking-widest pl-2">Department</label>
                                            <input
                                                required
                                                value={members[editingMemberIndex].department}
                                                onChange={(e) => handleMemberChange(editingMemberIndex, 'department', e.target.value)}
                                                className="w-full p-4 text-lg border-2 border-oxford/10 rounded-2xl focus:border-oxford outline-none bg-white font-bold"
                                                placeholder="e.g. CSE, ECE"
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div className="space-y-2">
                                                <label className="text-sm font-black text-oxford uppercase tracking-widest pl-2">Year</label>
                                                <input
                                                    required
                                                    value={members[editingMemberIndex].year}
                                                    onChange={(e) => handleMemberChange(editingMemberIndex, 'year', e.target.value)}
                                                    className="w-full p-4 text-lg border-2 border-oxford/10 rounded-2xl focus:border-oxford outline-none bg-white font-bold"
                                                    placeholder="Year"
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-sm font-black text-oxford uppercase tracking-widest pl-2">Section</label>
                                                <input
                                                    required
                                                    value={members[editingMemberIndex].section}
                                                    onChange={(e) => handleMemberChange(editingMemberIndex, 'section', e.target.value)}
                                                    className="w-full p-4 text-lg border-2 border-oxford/10 rounded-2xl focus:border-oxford outline-none bg-white font-bold"
                                                    placeholder="Sec"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-oxford/5 p-4 sm:p-8 rounded-3xl border-4 border-oxford/10 flex flex-col sm:flex-row items-center justify-between gap-4 sm:gap-0">
                                        <div className="flex items-center gap-3 sm:gap-4 w-full sm:w-auto">
                                            <div className="w-10 h-10 sm:w-12 sm:h-12 bg-oxford/10 rounded-full flex items-center justify-center shrink-0">
                                                <CheckCircle2 className="w-5 h-5 sm:w-6 sm:h-6 text-oxford" />
                                            </div>
                                            <div>
                                                <p className="font-black text-oxford uppercase text-base sm:text-lg leading-tight">Changes Autosaved</p>
                                                <p className="text-[10px] sm:text-sm text-oxford/60 font-bold uppercase">All details are instantly captured</p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setEditingMemberIndex(null)}
                                            className="w-full sm:w-auto text-oxford font-black uppercase hover:underline text-xs sm:text-sm tracking-widest sm:tracking-normal py-2 sm:py-0 border-t-2 border-oxford/5 sm:border-0 pt-4 sm:pt-0"
                                        >
                                            Return to summary
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </form>
            </div>
        </div>
    );

}
