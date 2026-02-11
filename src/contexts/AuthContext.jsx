import { createContext, useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { ensureProfile } from '../lib/utils';

const AuthContext = createContext({});

// Export the context for the useAuth hook  
export { AuthContext };

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [initialized, setInitialized] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  // Initialize auth state on mount - optimized for speed
  useEffect(() => {
    const initializeAuth = async () => {
      try {
        console.log('Initializing auth...');
        
        // Get initial session with longer timeout for reliability
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Error getting session:', error);
          setLoading(false);
          setInitialized(true);
          return;
        }

        if (session?.user) {
          console.log('Session found, loading user:', session.user.id);
          // IMPORTANT: Wait for session to be fully handled before marking initialized
          await handleUserSession(session.user);
        } else {
          console.log('No session found');
          // No session - we can load immediately
          setLoading(false);
        }
        
      } catch (error) {
        console.error('Error initializing auth:', error);
        // Don't block the UI for auth errors - fail fast
        setLoading(false);
      } finally {
        setInitialized(true);
      }
    };

    initializeAuth();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session?.user?.id);

        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            // Don't await - let it run in background for faster UI response
            handleUserSession(session.user);
          }
        } else if (event === 'SIGNED_OUT') {
          console.log('SIGNED_OUT event received');
          setUser(null);
          setProfile(null);
          setLoading(false);
          
          // Clear localStorage
          localStorage.removeItem('isLoggedIn');
          localStorage.removeItem('userRole');
          localStorage.removeItem('facultyData');
          
          console.log('Auth state cleared on SIGNED_OUT');
        }
        
        // Always set loading to false quickly for better UX
        if (initialized) {
          setLoading(false);
        }
      }
    );

    return () => {
      subscription.unsubscribe();
    };
  }, [initialized]);

  const ensureProfileFast = async (user) => {
    try {
      console.log('Fetching profile for user:', user.id, user.email);
      
      // First, try to get existing profile with shorter timeout
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      // Increase timeout for more reliable profile fetch
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 3000)
      );
      
      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]);
      
      if (profile) {
        console.log('✅ Profile found:', {
          id: profile.id,
          email: profile.email,
          role: profile.role
        });
        return profile;
      }
      
      console.warn('Profile not found, error:', error);
      
      // If no profile found, try to create it quickly
      if (error && (error.code === 'PGRST116' || error.message.includes('timeout'))) {
        console.log('Creating new profile...');
        const { data: newProfile, error: insertError } = await supabase
          .from('profiles')
          .insert({
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
            role: user.user_metadata?.role || 'lead'
          })
          .select()
          .single();
          
        if (insertError) {
          console.error('Profile creation failed:', insertError);
          // Return basic profile as fallback
          return {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
            role: user.user_metadata?.role || 'lead'
          };
        }
        
        console.log('✅ New profile created:', newProfile);
        return newProfile;
      }
      
      throw error;
    } catch (error) {
      console.error('Profile sync failed, using fallback:', error);
      // Always return a basic profile to avoid blocking login
      return {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
        role: user.user_metadata?.role || 'lead'
      };
    }
  };

  const handleUserSession = async (user) => {
    try {
      console.log('Handling user session...', user.id);
      
      // Set user immediately
      setUser(user);
      
      // Fetch actual profile from database (WAIT for this)
      const actualProfile = await ensureProfileFast(user);
      
      if (actualProfile) {
        console.log('Profile loaded:', {
          userId: actualProfile.id,
          email: actualProfile.email,
          role: actualProfile.role
        });
        setProfile(actualProfile);
      } else {
        // Fallback to user metadata if profile fetch fails
        const fallbackProfile = {
          id: user.id,
          email: user.email,
          full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
          role: user.user_metadata?.role || 'lead'
        };
        console.warn('Using fallback profile:', fallbackProfile);
        setProfile(fallbackProfile);
      }
      
      // Clear any old localStorage values
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userRole');
      
      // Stop loading after profile is set
      setLoading(false);
      
    } catch (error) {
      console.error('Error handling user session:', error);
      setLoading(false);
      // Don't sign out - create fallback profile
      const fallbackProfile = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
        role: user.user_metadata?.role || 'lead'
      };
      setProfile(fallbackProfile);
    }
  };

  const handleSignOut = () => {
    setUser(null);
    setProfile(null);
    
    // Clear localStorage
    localStorage.removeItem('isLoggedIn');
    localStorage.removeItem('userRole');
    localStorage.removeItem('facultyData');
    
    console.log('User signed out');
  };

  const signIn = async (email, password, role = 'lead') => {
    try {
      // Handle faculty login differently (hybrid approach for now)
      if (role === 'faculty') {
        return await handleFacultyLogin(email, password);
      }

      // Regular user login
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) throw error;

      // Auth state change will handle the rest
      return { data, error: null };
    } catch (error) {
      console.error('Sign in error:', error);
      return { data: null, error };
    }
  };

  const handleFacultyLogin = async (email, password) => {
    try {
      console.log('🎓 Starting faculty login for:', email);
      
      // PRODUCTION: Use Supabase Auth for all faculty
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        console.error('❌ Auth error:', authError);
        throw authError;
      }

      if (!authData?.user) {
        throw new Error('Authentication failed');
      }

      console.log('✅ Auth successful, checking profile...');

      // Check if user has faculty role in profiles table
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      console.log('Profile check result:', {
        found: !!profileData,
        role: profileData?.role,
        error: profileError?.code
      });

      if (profileError && profileError.code !== 'PGRST116') {
        console.error('Profile check error:', profileError);
      }

      // If no profile exists, check faculty table
      if (!profileData || !profileData.role) {
        console.log('⚠️ No profile found, checking faculty table...');
        
        const { data: facultyRecord, error: facultyError } = await supabase
          .from('faculty')
          .select('id')
          .eq('email', email)
          .eq('is_active', true)
          .maybeSingle();
        
        console.log('Faculty table check:', {
          found: !!facultyRecord,
          error: facultyError?.message
        });
        
        if (facultyError) {
          console.error('Faculty check error:', facultyError);
        }
        
        if (!facultyRecord) {
          console.error('❌ Not found in faculty table');
          await supabase.auth.signOut();
          throw new Error('Not authorized as faculty member. Please contact admin or use student login.');
        }
        
        // Create/update profile with faculty role
        console.log('📝 Creating faculty profile...');
        const { data: upsertData, error: upsertError } = await supabase
          .from('profiles')
          .upsert({
            id: authData.user.id,
            email: email,
            role: 'faculty',
            full_name: authData.user.user_metadata?.full_name || email.split('@')[0],
            updated_at: new Date().toISOString()
          }, { onConflict: 'id' })
          .select()
          .single();
        
        if (upsertError) {
          console.error('❌ Profile creation error:', upsertError);
        } else {
          console.log('✅ Faculty profile created:', upsertData);
        }
      } else if (profileData.role !== 'faculty' && profileData.role !== 'admin') {
        console.error('❌ User has wrong role:', profileData.role);
        await supabase.auth.signOut();
        throw new Error('Not authorized as faculty member. Please use the student/team lead login.');
      } else {
        console.log('✅ Faculty role verified:', profileData.role);
      }

      // Fetch faculty data for additional info
      const { data: facultyData } = await supabase
        .from('faculty')
        .select('id, faculty_id, name, email, department')
        .eq('email', email)
        .eq('is_active', true)
        .single();

      // Store faculty info if available
      if (facultyData) {
        console.log('📋 Faculty data loaded:', facultyData);
        localStorage.setItem('facultyData', JSON.stringify(facultyData));
      }

      console.log('✅ Faculty login complete! Auth state will update automatically.');
      // Auth state change handler will set user and profile automatically
      return { data: authData, error: null };
    } catch (error) {
      console.error('❌ Faculty login error:', error.message);
      return { data: null, error };
    }
  };

  const signUp = async (email, password, options = {}) => {
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: options.full_name || '',
            role: options.role || 'lead'
          }
        }
      });

      if (error) throw error;

      return { data, error: null };
    } catch (error) {
      console.error('Sign up error:', error);
      return { data: null, error };
    }
  };

  const signOut = async () => {
    try {
      console.log('Starting signOut process...');
      setIsLoggingOut(true);
      
      // Clear local state first for immediate UI response
      setUser(null);
      setProfile(null);
      setLoading(false);
      
      // Clear localStorage
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userRole');
      localStorage.removeItem('facultyData');
      
      console.log('Local state cleared');
      
      // Handle Supabase logout
      const { error } = await supabase.auth.signOut();
      
      if (error && !error.message.includes('User not logged in')) {
        console.error('Supabase sign out error:', error);
      } else {
        console.log('Supabase signOut completed');
      }
      
      return { error: null };
    } catch (error) {
      console.error('Sign out error:', error);
      // Still clear local state even if there's an error
      setUser(null);
      setProfile(null);
      setLoading(false);
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userRole');
      localStorage.removeItem('facultyData');
      return { error };
    } finally {
      // Reset logout flag after a delay to allow navigation
      setTimeout(() => {
        setIsLoggingOut(false);
      }, 500);
    }
  };

  const refreshSession = async () => {
    try {
      const { data, error } = await supabase.auth.refreshSession();
      if (error) throw error;
      return { data, error: null };
    } catch (error) {
      console.error('Refresh session error:', error);
      return { data: null, error };
    }
  };

  // Helper functions
  const isAuthenticated = () => {
    const result = !!(user && profile);
    return result;
  };

  const getUserRole = () => {
    const role = profile?.role || null;
    return role;
  };

  const isRole = (role) => {
    return profile?.role === role;
  };

  const canAccess = (requiredRole) => {
    if (!isAuthenticated()) return false;
    
    const userRole = getUserRole();
    
    // Admin can access everything
    if (userRole === 'admin') return true;
    
    // Check specific role access
    if (requiredRole === 'faculty') {
      return userRole === 'faculty' || userRole === 'admin';
    }
    
    if (requiredRole === 'lead') {
      return userRole === 'lead' || userRole === 'admin';
    }
    
    return userRole === requiredRole;
  };

  const value = {
    // State
    user,
    profile,
    loading,
    initialized,
    isLoggingOut,
    
    // Auth functions
    signIn,
    signUp,
    signOut,
    refreshSession,
    
    // Helper functions
    isAuthenticated,
    getUserRole,
    isRole,
    canAccess
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export default AuthProvider;