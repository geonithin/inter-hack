import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
    return twMerge(clsx(inputs))
}

// Enhanced error handling utility for Supabase errors
export function getSupabaseErrorMessage(error) {
    if (!error) return 'An unknown error occurred';
    
    const message = error.message || error.toString();
    
    // User-friendly error messages
    if (message.includes('confirmation email')) {
        return 'Registration successful! You can now login with your credentials.';
    }
    if (message.includes('already registered') || message.includes('already exists')) {
        return 'Account already exists. Please try logging in instead.';
    }
    if (message.includes('Invalid login credentials')) {
        return 'Invalid email or password. Please check your credentials.';
    }
    if (message.includes('duplicate key') || message.includes('unique constraint')) {
        return 'Some information is already in use. Please check registration numbers and emails.';
    }
    if (message.includes('permission') || message.includes('policy')) {
        return 'Access denied. Please contact administrator.';
    }
    
    return message;
}

// Utility to wait for profile creation with retry
export async function waitForProfile(supabase, userId, maxRetries = 5) {
    for (let i = 0; i < maxRetries; i++) {
        const { data: profile, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
            
        if (profile) return profile;
        if (error && !error.message.includes('row')) throw error;
        
        // Wait progressively longer on each retry
        await new Promise(resolve => setTimeout(resolve, (i + 1) * 500));
    }
    
    throw new Error('Profile not found after multiple attempts');
}

// Utility to ensure user profile exists
export async function ensureProfile(supabase, user) {
    try {
        const profile = await waitForProfile(supabase, user.id, 3);
        return profile;
    } catch (error) {
        // Try to create profile manually as fallback
        console.warn('Profile not found, creating manually...');
        
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
            
        if (insertError) throw insertError;
        return newProfile;
    }
}
