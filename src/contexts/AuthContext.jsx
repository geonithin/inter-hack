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
        // Reduce timeout for faster loading
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Auth initialization timeout')), 1000)
        );
        
        const authPromise = (async () => {
          // Get initial session
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('Error getting session:', error);
            return;
          }

          if (session?.user) {
            // Don't await - let user session load in background for faster UI
            handleUserSession(session.user);
          } else {
            // No session - we can load immediately
            setLoading(false);
          }
        })();
        
        // Race between auth check and timeout
        await Promise.race([authPromise, timeoutPromise]);
        
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

  // Fast profile creation with optimized retry
  const ensureProfileFast = async (user) => {
    try {
      // First, try to get existing profile with shorter timeout
      const profilePromise = supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      // Increase timeout for more reliable profile fetch
      const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Profile fetch timeout')), 2000)
      );
      
      const { data: profile, error } = await Promise.race([profilePromise, timeoutPromise]);
        
      if (profile) return profile;
      
      // If no profile found, try to create it quickly
      if (error && (error.code === 'PGRST116' || error.message.includes('timeout'))) {
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
          console.warn('Profile creation failed:', insertError);
          // Return basic profile as fallback
          return {
            id: user.id,
            email: user.email,
            full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
            role: user.user_metadata?.role || 'lead'
          };
        }
        
        return newProfile;
      }
      
      throw error;
    } catch (error) {
      console.warn('Profile sync failed, using fallback:', error);
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
      // Set user immediately for faster UI response
      setUser(user);
      setLoading(false); // Stop loading immediately
      
      // Create a basic profile from user data to avoid waiting
      const basicProfile = {
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || user.email.split('@')[0],
        role: user.user_metadata?.role || 'lead'
      };
      
      setProfile(basicProfile);
      
      // Clear any old localStorage values
      localStorage.removeItem('isLoggedIn');
      localStorage.removeItem('userRole');
      localStorage.removeItem('facultyData');
      
      console.log('User session established:', { 
        userId: user.id, 
        role: basicProfile.role,
        email: user.email 
      });
      
      // Fetch/ensure actual profile in background (non-blocking)
      ensureProfileFast(user).then(actualProfile => {
        if (actualProfile && actualProfile.role !== basicProfile.role) {
          setProfile(actualProfile);
        }
      }).catch(error => {
        console.warn('Background profile sync failed:', error);
        // Don't throw - user is already logged in with basic profile
      });
      
    } catch (error) {
      console.error('Error handling user session:', error);
      // If we can't get profile, sign out the user
      await supabase.auth.signOut();
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
      // PRODUCTION: Use Supabase Auth for all faculty
      const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (authError) {
        throw authError;
      }

      if (!authData?.user) {
        throw new Error('Authentication failed');
      }

      // Verify user is faculty by checking their profile role
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', authData.user.id)
        .single();

      if (profileError) {
        console.error('Profile check error:', profileError);
        // Don't fail login if profile check fails, auth state will handle it
      }

      if (profileData && profileData.role !== 'faculty') {
        await supabase.auth.signOut();
        throw new Error('Not authorized as faculty member. Please use the student/team lead login.');
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
        localStorage.setItem('facultyData', JSON.stringify(facultyData));
      }

      // Auth state change handler will set user and profile automatically
      return { data: authData, error: null };
    } catch (error) {
      console.error('Faculty login error:', error);
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