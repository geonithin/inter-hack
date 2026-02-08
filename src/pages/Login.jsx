import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, ShieldCheck } from 'lucide-react';
import { cn, getSupabaseErrorMessage } from '../lib/utils';
import { useAuth } from '../hooks/useAuth';

export default function Login() {
    const navigate = useNavigate();
    const { signIn } = useAuth();
    const [role, setRole] = useState('lead'); // This is just for the UI toggle initial state
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            const { data, error } = await signIn(email, password, role);

            if (error) throw error;

            // Immediately show success - navigation will happen automatically
            console.log('Login successful - redirecting...');
            
        } catch (error) {
            console.error('Login error:', error);
            alert(error.message || getSupabaseErrorMessage(error));
            setIsLoading(false); // Only stop loading on error
        }
        // Don't set loading to false on success - let the auth state change handle it
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
                                <>
                                    <div className="w-5 h-5 sm:w-6 sm:h-6 border-4 border-white border-t-transparent rounded-full animate-spin" />
                                    <span className="ml-2">Signing you in...</span>
                                </>
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
