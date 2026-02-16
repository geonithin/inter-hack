import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserPlus, Users, Trash2, CheckCircle2 } from 'lucide-react';
import { getSupabaseErrorMessage, ensureProfile } from '../lib/utils';
import { supabase } from '../lib/supabase';

export default function Register() {
    const navigate = useNavigate();
    const [teamData, setTeamData] = useState({
        name: '',
        department: '',
        year: '',
        section: '',
    });
    // Fixed team size - no more than 2 members allowed (1 lead + 1 member)

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

    // Initialize exactly 1 member (since team size is fixed at 2)
    useEffect(() => {
        if (members.length === 0) {
            setMembers([{ name: '', registerNumber: '', email: '', phone: '', department: '', year: '', section: '' }]);
        }
    }, [members.length]);



    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (leadData.password !== leadData.confirmPassword) {
            alert("Passwords do not match!");
            return;
        }

        // Check if any member has partial data (some fields filled but not all)
        const hasPartialMemberData = members.some(m => {
            const hasAnyData = m.name || m.registerNumber || m.email || m.phone;
            const hasCompleteData = m.name && m.name.trim() !== '' && 
                                   m.registerNumber && m.registerNumber.trim() !== '' &&
                                   m.email && m.email.trim() !== '' &&
                                   m.phone && m.phone.trim() !== '';
            return hasAnyData && !hasCompleteData;
        });

        if (hasPartialMemberData) {
            alert("Please complete all member details (Name, Register Number, Email, and Phone are required) or leave all fields empty to register without a team member.");
            return;
        }

        // Filter valid members (those with name and register number filled)
        const validMembers = members.filter(m => 
            m.name && m.name.trim() !== '' && 
            m.registerNumber && m.registerNumber.trim() !== ''
        );

        const allRegNumbers = [leadData.registerNumber, ...validMembers.map(m => m.registerNumber)];
        const uniqueRegNumbers = new Set(allRegNumbers);
        if (uniqueRegNumbers.size !== allRegNumbers.length) {
            alert("Each team member (including Lead) must have a unique register number!");
            return;
        }

        const allEmails = [leadData.email, ...validMembers.map(m => m.email).filter(e => e && e.trim() !== '')];
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
            // Filter out empty members (must have both name and register number)
            const validMembers = members.filter(m => 
                m.name && m.name.trim() !== '' && 
                m.registerNumber && m.registerNumber.trim() !== ''
            );

            if (validMembers.length > 0) {
                console.log('Creating team members...');
                const membersToInsert = validMembers.map(m => ({
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
            } else {
                console.log('No valid members to insert (team lead only)');
            }

            // 5. Create welcome notification
            console.log('Creating welcome notification...');
            try {
                const { error: notificationError } = await supabase
                    .from('notifications')
                    .insert([{
                        recipient_id: userId,
                        recipient_type: 'lead',
                        title: 'Welcome to SMCE Hackathon!',
                        message: `Congratulations ${teamData.name}! Your team has been successfully registered for the hackathon. You can now browse and select problem statements from your dashboard.`,
                        type: 'info',
                        is_read: false,
                        sender_type: 'system',
                        team_id: teamRecord.id
                    }]);

                if (notificationError) {
                    console.error('Error creating welcome notification:', notificationError);
                    // Don't throw error here as registration succeeded
                } else {
                    console.log('Welcome notification created successfully');
                }
            } catch (error) {
                console.error('Welcome notification error:', error);
                // Don't throw error here as registration succeeded
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
        <div className="max-w-5xl mx-auto mt-8 mb-16 px-6 animate-in fade-in slide-in-from-bottom-6 duration-300">
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
                                            <option value="AIDS">Artificial Intelligence and Data Science</option>
                                            <option value="CIVIL">Civil Engineering</option>
                                            <option value="CSE">Computer Science and Engineering</option>
                                            <option value="ECE">Electronics and Communication Engineering</option>
                                            <option value="EEE">Electrical and Electronics Engineering</option>
                                            <option value="MBA">Master of Business Administration</option>
                                            <option value="MECH">Mechanical Engineering</option>
                                             
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs sm:text-sm font-black text-oxford uppercase tracking-widest pl-1">Year</label>
                                        <select required value={teamData.year} onChange={(e) => setTeamData({ ...teamData, year: e.target.value })} className="w-full p-3 sm:p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm sm:text-base">
                                            <option value="">Select Year</option>
                                            <option value="1">1st Year</option>
                                            <option value="2">2nd Year</option>
                                            <option value="3">3rd Year</option>
                                            <option value="4">4th Year</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-xs sm:text-sm font-black text-oxford uppercase tracking-widest pl-1">Section</label>
                                        <input required value={teamData.section} onChange={(e) => setTeamData({ ...teamData, section: e.target.value })} className="w-full p-3 sm:p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm sm:text-base" placeholder="e.g. A, B, C" />
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
                                        <input required value={leadData.registerNumber} onChange={(e) => setLeadData({ ...leadData, registerNumber: e.target.value })} className="w-full p-3 sm:p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none bg-white font-bold text-sm sm:text-base" placeholder="Enter your register number" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Lead Email</label>
                                        <input type="email" required value={leadData.email} onChange={(e) => setLeadData({ ...leadData, email: e.target.value })} className="w-full p-2.5 sm:p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none bg-white font-bold text-sm" placeholder="Enter your email" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Lead Phone</label>
                                        <input required value={leadData.phone} onChange={(e) => setLeadData({ ...leadData, phone: e.target.value })} className="w-full p-2.5 sm:p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none bg-white font-bold text-sm" placeholder="+91 0000000000" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Password</label>
                                        <input type="password" required value={leadData.password} onChange={(e) => setLeadData({ ...leadData, password: e.target.value })} className="w-full p-2.5 sm:p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none bg-white font-bold text-sm" placeholder="Enter 6 digit password" />
                                    </div>
                                    <div className="space-y-1.5">
                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Confirm Password</label>
                                        <input type="password" required value={leadData.confirmPassword} onChange={(e) => setLeadData({ ...leadData, confirmPassword: e.target.value })} className="w-full p-2.5 sm:p-3.5 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none bg-white font-bold text-sm" placeholder="Confirm Password" />
                                    </div>
                                </div>
                            </div>

                            {/* Team Member Section */}
                            <div className="space-y-6 bg-oxford/5 p-6 rounded-2xl border-2 border-oxford/10">
                                <h3 className="text-lg font-bold text-oxford uppercase border-b-2 border-oxford/10 pb-2 flex items-center gap-2">
                                    <Users className="w-5 h-5" /> Team Member (Optional)
                                </h3>
                                <p className="text-xs text-oxford/60 font-semibold -mt-2">Leave empty to register as a solo team</p>
                                <div className="space-y-6">
                                    {members.slice(0, 1).map((member, idx) => (
                                        <div key={idx} className="space-y-4 p-6 bg-white rounded-xl border-2 border-oxford/10">
                                            <h4 className="text-sm font-black text-oxford uppercase tracking-widest">Member 2</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Full Name</label>
                                                        <input
                                                            value={member.name}
                                                            onChange={(e) => handleMemberChange(idx, 'name', e.target.value)}
                                                            className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                            placeholder="Member Name"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Register No</label>
                                                        <input
                                                            value={member.registerNumber}
                                                            onChange={(e) => handleMemberChange(idx, 'registerNumber', e.target.value)}
                                                            className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                            placeholder="Enter your register number"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Email</label>
                                                        <input
                                                            type="email"
                                                            value={member.email}
                                                            onChange={(e) => handleMemberChange(idx, 'email', e.target.value)}
                                                            className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                            placeholder="Enter your email here"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Phone</label>
                                                        <input
                                                            value={member.phone}
                                                            onChange={(e) => handleMemberChange(idx, 'phone', e.target.value)}
                                                            className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                            placeholder="+91 0000000000"
                                                        />
                                                    </div>
                                                    <div className="space-y-2">
                                                        <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Department</label>
                                                        <input
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
                                                                value={member.year}
                                                                onChange={(e) => handleMemberChange(idx, 'year', e.target.value)}
                                                                className="w-full p-3 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm"
                                                                placeholder="Year"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-xs font-black text-oxford uppercase tracking-widest pl-1">Section</label>
                                                            <input
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
