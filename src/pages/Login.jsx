import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ShieldCheck } from 'lucide-react';
import { cn, getSupabaseErrorMessage, ensureProfile } from '../lib/utils';
import { supabase } from '../lib/supabase';

export default function Login() {
    const navigate = useNavigate();
    const [role, setRole] = useState('lead'); // This is just for the UI toggle initial state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            // Handle faculty login differently - check against faculty table
            if (role === 'faculty') {
                // Check if it's faculty ID format (FAC001) or email
                const isFacultyId = /^FAC\d+$/.test(email.toUpperCase());
                
                let query = supabase.from('faculty').select('*').eq('is_active', true);
                
                if (isFacultyId) {
                    query = query.eq('faculty_id', email.toUpperCase());
                } else {
                    query = query.eq('email', email);
                }
                
                const { data: facultyData, error: facultyError } = await query.single();
                
                if (facultyError || !facultyData) {
                    throw new Error('Invalid faculty credentials');
                }
                
                // Simple password check (in production, this should be hashed)
                if (facultyData.password !== password) {
                    throw new Error('Invalid faculty credentials');
                }
                
                // Set session data for faculty
                localStorage.setItem('isLoggedIn', 'true');
                localStorage.setItem('userRole', 'faculty');
                localStorage.setItem('facultyData', JSON.stringify(facultyData));
                
                navigate('/faculty');
                return;
            }
            
            // Handle regular user login with Supabase auth
            const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (authError) throw authError;

            // Ensure profile exists and get user role
            const profile = await ensureProfile(supabase, authData.user);
            
            localStorage.setItem('isLoggedIn', 'true');
            localStorage.setItem('userRole', profile.role);

            if (profile.role === 'faculty' || profile.role === 'admin') {
                navigate('/faculty');
            } else {
                navigate('/dashboard');
            }
        } catch (error) {
            console.error('Login error:', error);
            alert(error.message || getSupabaseErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex items-center justify-center min-h-[50vh] animate-in zoom-in-95 duration-200">
            <div className="max-w-lg w-full p-4 sm:p-8 oxford-edge rounded-2xl sm:rounded-3xl space-y-6 sm:space-y-8 bg-white shadow-2xl">
                <div className="text-center space-y-1.5 sm:space-y-3">
                    <h2 className="text-xl sm:text-3xl font-black text-oxford uppercase tracking-tighter">Dashboard Login</h2>
                    <p className="text-[10px] sm:text-xs text-oxford/40 font-black uppercase tracking-[0.2em]">Select your access level to proceed</p>
                </div>

                <div className="flex bg-gray-50 p-1 sm:p-1.5 rounded-xl sm:rounded-2xl border-2 border-oxford/10">
                    <button
                        onClick={() => setRole('lead')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-black text-[9px] sm:text-xs uppercase tracking-widest transition-all",
                            role === 'lead' ? "bg-oxford text-white shadow-xl" : "text-oxford/40 hover:text-oxford/60"
                        )}
                    >
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Team Lead
                    </button>
                    <button
                        onClick={() => setRole('faculty')}
                        className={cn(
                            "flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 rounded-lg sm:rounded-xl font-black text-[9px] sm:text-xs uppercase tracking-widest transition-all",
                            role === 'faculty' ? "bg-oxford text-white shadow-xl" : "text-oxford/40 hover:text-oxford/60"
                        )}
                    >
                        <ShieldCheck className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> Faculty
                    </button>
                </div>

                <div className="space-y-4">
                    <form className="space-y-4 sm:space-y-6" onSubmit={handleSubmit}>
                        <div className="space-y-2">
                            <label className="text-[9px] sm:text-[10px] font-black text-oxford uppercase tracking-widest pl-1 opacity-60">
                                {role === 'lead' ? 'Team Lead Email ID' : 'Faculty ID / Email'}
                            </label>
                            <input
                                required
                                type={role === 'faculty' ? 'text' : 'email'}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                className="w-full p-3 sm:p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm sm:text-base placeholder:opacity-30"
                                placeholder={role === 'lead' ? 'lead@college.edu' : 'FAC001 or faculty@college.edu'}
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[9px] sm:text-[10px] font-black text-oxford uppercase tracking-widest pl-1 opacity-60">Password</label>
                            <input
                                required
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                className="w-full p-3 sm:p-4 border-2 border-oxford/10 rounded-xl focus:border-oxford outline-none transition-all font-bold text-sm sm:text-base placeholder:opacity-30"
                                placeholder="••••••••"
                            />
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={cn(
                                "w-full text-white font-black py-3.5 sm:py-4.5 rounded-xl sm:rounded-2xl transition-all shadow-xl uppercase tracking-[0.2em] text-[10px] sm:text-xs mt-2 active:scale-95 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed",
                                role === 'lead' ? "bg-oxford hover:bg-oxford-dark" : "bg-emerald-600 hover:bg-emerald-700"
                            )}
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 sm:w-6 sm:h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                            ) : (
                                'Proceed with Email'
                            )}
                        </button>
                    </form>

                    <div className="pt-4 border-t border-oxford/5 text-center">
                        <p className="text-[8px] sm:text-[9px] text-oxford/40 font-black uppercase tracking-[0.2em] leading-loose">
                            Authorized Access Only <br />
                            <span className="text-oxford/20">Security Logging Enabled</span>
                        </p>
                    </div>
                </div>
            </div>
        </div>
    );
}
