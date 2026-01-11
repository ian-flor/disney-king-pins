/**
 * Disney King Pins - Admin Authentication Module
 * Handles Supabase Auth integration for secure admin login
 */

// ============================================
// Configuration
// ============================================

const SUPABASE_URL = 'https://qzbtatvwlpkemeziyfms.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_BsY8jGsfQjK6lW_-Bv9j9w_uXJSQxMO';

// Initialize Supabase client
let supabaseClient = null;

function initSupabase() {
    if (typeof window.supabase !== 'undefined' && SUPABASE_URL !== 'YOUR_SUPABASE_URL') {
        supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
        return true;
    }
    return false;
}

// ============================================
// Auth State
// ============================================

let currentSession = null;
let currentAdmin = null;

// ============================================
// Auth Detection (for invite/recovery links)
// ============================================

/**
 * Parse URL hash for auth tokens (invite link, password reset)
 * Supabase puts tokens in URL hash after redirect
 */
function parseAuthHash() {
    const hash = window.location.hash;
    if (!hash) return null;

    const params = new URLSearchParams(hash.substring(1));
    return {
        accessToken: params.get('access_token'),
        refreshToken: params.get('refresh_token'),
        type: params.get('type'), // 'invite', 'recovery', 'signup'
        error: params.get('error'),
        errorDescription: params.get('error_description')
    };
}

/**
 * Check if this is a first-time login (invite link)
 */
function isInviteFlow() {
    const authData = parseAuthHash();
    return authData && authData.type === 'invite';
}

/**
 * Check if this is a password recovery flow
 */
function isRecoveryFlow() {
    const authData = parseAuthHash();
    return authData && authData.type === 'recovery';
}

/**
 * Check if there's an auth error in URL
 */
function hasAuthError() {
    const authData = parseAuthHash();
    return authData && authData.error;
}

/**
 * Get auth error message
 */
function getAuthError() {
    const authData = parseAuthHash();
    if (authData && authData.error) {
        return authData.errorDescription || authData.error;
    }
    return null;
}

// ============================================
// Authentication Functions
// ============================================

/**
 * Sign in with email and password
 */
async function signIn(email, password) {
    if (!supabaseClient) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data, error } = await supabaseClient.auth.signInWithPassword({
            email: email.trim().toLowerCase(),
            password: password
        });

        if (error) {
            throw error;
        }

        // Verify user is in admin_users table
        const isAdmin = await verifyAdminStatus(data.user.id);
        if (!isAdmin) {
            await supabaseClient.auth.signOut();
            throw new Error('You are not authorized as an admin.');
        }

        currentSession = data.session;
        await updateLastLogin();

        return { success: true, session: data.session };
    } catch (error) {
        console.error('Sign in error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sign out current user
 */
async function signOut() {
    if (!supabaseClient) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { error } = await supabaseClient.auth.signOut();
        if (error) throw error;

        currentSession = null;
        currentAdmin = null;

        // Clear URL hash if present
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname);
        }

        return { success: true };
    } catch (error) {
        console.error('Sign out error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Set password for first-time login (invite flow) or recovery
 */
async function setPassword(newPassword) {
    if (!supabaseClient) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { data, error } = await supabaseClient.auth.updateUser({
            password: newPassword
        });

        if (error) throw error;

        // Update password_set_at in admin_users
        await supabaseClient
            .from('admin_users')
            .update({ password_set_at: new Date().toISOString() })
            .eq('auth_user_id', data.user.id);

        // Clear URL hash
        if (window.location.hash) {
            history.replaceState(null, '', window.location.pathname);
        }

        return { success: true, user: data.user };
    } catch (error) {
        console.error('Set password error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Request password reset email
 */
async function requestPasswordReset(email) {
    if (!supabaseClient) {
        return { success: false, error: 'Supabase not configured' };
    }

    try {
        const { error } = await supabaseClient.auth.resetPasswordForEmail(email.trim().toLowerCase(), {
            redirectTo: `${window.location.origin}/admin.html`
        });

        if (error) throw error;

        return { success: true };
    } catch (error) {
        console.error('Password reset error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current session
 */
async function getSession() {
    if (!supabaseClient) {
        return null;
    }

    try {
        const { data, error } = await supabaseClient.auth.getSession();
        if (error) throw error;

        if (data.session) {
            // Verify still an active admin
            const isAdmin = await verifyAdminStatus(data.session.user.id);
            if (!isAdmin) {
                await signOut();
                return null;
            }
            currentSession = data.session;
        }

        return data.session;
    } catch (error) {
        console.error('Get session error:', error);
        return null;
    }
}

/**
 * Listen for auth state changes
 */
function onAuthStateChange(callback) {
    if (!supabaseClient) {
        return { data: { subscription: { unsubscribe: () => {} } } };
    }

    return supabaseClient.auth.onAuthStateChange((event, session) => {
        console.log('Auth event:', event);
        currentSession = session;
        callback(event, session);
    });
}

// ============================================
// Admin Verification
// ============================================

/**
 * Verify user is in admin_users table and is active
 */
async function verifyAdminStatus(authUserId) {
    if (!supabaseClient) return false;

    try {
        const { data, error } = await supabaseClient
            .from('admin_users')
            .select('id, is_active')
            .eq('auth_user_id', authUserId)
            .single();

        if (error || !data) return false;
        return data.is_active === true;
    } catch (error) {
        console.error('Admin verification error:', error);
        return false;
    }
}

/**
 * Get current admin profile
 */
async function getAdminProfile() {
    if (!supabaseClient) return null;

    try {
        const session = await getSession();
        if (!session) return null;

        const { data, error } = await supabaseClient
            .from('admin_users')
            .select('*')
            .eq('auth_user_id', session.user.id)
            .single();

        if (error) throw error;
        currentAdmin = data;
        return data;
    } catch (error) {
        console.error('Get admin profile error:', error);
        return null;
    }
}

/**
 * Update last login timestamp
 */
async function updateLastLogin() {
    if (!supabase || !currentSession) return;

    try {
        await supabaseClient
            .from('admin_users')
            .update({ last_login_at: new Date().toISOString() })
            .eq('auth_user_id', currentSession.user.id);
    } catch (error) {
        console.error('Update last login error:', error);
    }
}

// ============================================
// Password Validation
// ============================================

/**
 * Validate password strength
 */
function validatePassword(password) {
    const errors = [];

    if (password.length < 8) {
        errors.push('Password must be at least 8 characters');
    }
    if (!/[A-Z]/.test(password)) {
        errors.push('Password must contain at least one uppercase letter');
    }
    if (!/[a-z]/.test(password)) {
        errors.push('Password must contain at least one lowercase letter');
    }
    if (!/[0-9]/.test(password)) {
        errors.push('Password must contain at least one number');
    }

    return {
        isValid: errors.length === 0,
        errors: errors
    };
}

// ============================================
// Check Configuration
// ============================================

function isConfigured() {
    return SUPABASE_URL !== 'YOUR_SUPABASE_URL' && SUPABASE_ANON_KEY !== 'YOUR_SUPABASE_ANON_KEY';
}

// ============================================
// Initialize on Load
// ============================================

// Initialize Supabase when script loads
const supabaseInitialized = initSupabase();

// ============================================
// Exports
// ============================================

window.AdminAuth = {
    supabase: supabaseClient,
    signIn,
    signOut,
    setPassword,
    requestPasswordReset,
    getSession,
    getAdminProfile,
    onAuthStateChange,
    isInviteFlow,
    isRecoveryFlow,
    hasAuthError,
    getAuthError,
    parseAuthHash,
    validatePassword,
    isConfigured,
    initSupabase
};
