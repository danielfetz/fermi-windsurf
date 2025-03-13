/**
 * Auth module for handling user authentication
 */
const Auth = (function() {
    // Current user data
    let currentUser = null;

    // Event handlers
    const onAuthStateChange = (callback) => {
        // Set up Supabase auth state subscriber
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                getUserProfile(session.user.id).then(profile => {
                    currentUser = {
                        id: session.user.id,
                        email: session.user.email,
                        username: profile?.username || session.user.email,
                        chips: profile?.chips || 0,
                        isGuest: profile?.isGuest || false
                    };
                    callback(currentUser);
                });
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                callback(null);
            }
        });

        // Check if already logged in
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (session) {
                getUserProfile(session.user.id).then(profile => {
                    currentUser = {
                        id: session.user.id,
                        email: session.user.email,
                        username: profile?.username || session.user.email,
                        chips: profile?.chips || 0,
                        isGuest: profile?.isGuest || false
                    };
                    callback(currentUser);
                });
            }
        });

        return authListener;
    };

    // Get user profile from database
    const getUserProfile = async (userId) => {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (error) {
            console.error('Error fetching user profile:', error);
            return null;
        }
        
        return data;
    };

    // Create or update user profile
    const upsertUserProfile = async (profile) => {
        const { data, error } = await supabase
            .from('profiles')
            .upsert(profile)
            .select();
        
        if (error) {
            console.error('Error updating user profile:', error);
            return null;
        }
        
        return data;
    };

    // Register new user
    const register = async (email, password, username) => {
        try {
            // Register with Supabase Auth
            const { data: { user }, error } = await supabase.auth.signUp({
                email,
                password,
            });
            
            if (error) throw error;
            
            // Create user profile
            if (user) {
                await upsertUserProfile({
                    id: user.id,
                    username,
                    email,
                    chips: 0,
                    created_at: new Date(),
                    isGuest: false
                });
            }
            
            return { success: true, user };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, error: error.message };
        }
    };

    // Login user
    const login = async (email, password) => {
        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            
            if (error) throw error;
            
            return { success: true, user: data.user };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, error: error.message };
        }
    };

    // Create guest user
    const createGuestUser = async (username) => {
        try {
            if (!username || username.trim() === '') {
                alert('Please enter a username');
                return null;
            }
            
            // Generate a random email and password for the guest
            const randomId = Math.random().toString(36).substring(2, 15);
            const email = `guest_${randomId}@fermipoker.guest`;
            const password = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
            
            // Sign up with Supabase Auth
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
            });
            
            if (error) throw error;
            
            // Create guest profile
            if (data.user) {
                await upsertUserProfile({
                    id: data.user.id,
                    username,
                    email,
                    chips: 0,
                    created_at: new Date(),
                    isGuest: true
                });
                
                // Return current user without waiting for auth state change
                return {
                    id: data.user.id,
                    email,
                    username,
                    chips: 0,
                    isGuest: true
                };
            }
            
            return null;
        } catch (error) {
            console.error('Guest creation error:', error);
            alert('Failed to create guest account. Please try again.');
            return null;
        }
    };

    // Logout user
    const logout = async () => {
        try {
            const { error } = await supabase.auth.signOut();
            
            if (error) throw error;
            
            return { success: true };
        } catch (error) {
            console.error('Logout error:', error);
            return { success: false, error: error.message };
        }
    };

    // Get current user
    const getCurrentUser = () => {
        return currentUser;
    };

    // Check if user is authenticated
    const isAuthenticated = () => {
        return !!currentUser;
    };

    // Return public methods
    return {
        onAuthStateChange,
        register,
        login,
        logout,
        getCurrentUser,
        isAuthenticated,
        getUserProfile,
        upsertUserProfile,
        createGuestUser
    };
})();

// Set up authentication UI
document.addEventListener('DOMContentLoaded', () => {
    // Tab switching
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const tabName = btn.dataset.tab;
            
            // Update active tab button
            tabBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            
            // Show selected tab content
            tabContents.forEach(content => {
                content.classList.remove('active');
                if (content.id === `${tabName}-form`) {
                    content.classList.add('active');
                }
            });
        });
    });
    
    // Register form submission
    ELEMENTS.registerBtn.addEventListener('click', async () => {
        const username = document.getElementById('register-username').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const password = document.getElementById('register-password').value;
        
        if (!username || !email || !password) {
            alert('Please fill in all fields');
            return;
        }
        
        ELEMENTS.registerBtn.disabled = true;
        ELEMENTS.registerBtn.textContent = 'Registering...';
        
        const result = await Auth.register(email, password, username);
        
        ELEMENTS.registerBtn.disabled = false;
        ELEMENTS.registerBtn.textContent = 'Register';
        
        if (result.success) {
            // Registration successful, switch to login tab if not auto-logged in
            if (!Auth.isAuthenticated()) {
                alert('Registration successful! Please check your email to verify your account before logging in.');
                document.querySelector('.tab-btn[data-tab="login"]').click();
            }
        } else {
            alert(`Registration failed: ${result.error}`);
        }
    });
    
    // Login form submission
    ELEMENTS.loginBtn.addEventListener('click', async () => {
        const email = document.getElementById('login-email').value.trim();
        const password = document.getElementById('login-password').value;
        
        if (!email || !password) {
            alert('Please fill in all fields');
            return;
        }
        
        ELEMENTS.loginBtn.disabled = true;
        ELEMENTS.loginBtn.textContent = 'Logging in...';
        
        const result = await Auth.login(email, password);
        
        ELEMENTS.loginBtn.disabled = false;
        ELEMENTS.loginBtn.textContent = 'Login';
        
        if (!result.success) {
            alert(`Login failed: ${result.error}`);
        }
    });
    
    // Guest user form submission
    ELEMENTS.guestBtn.addEventListener('click', async () => {
        const username = document.getElementById('guest-username').value.trim();
        
        if (!username) {
            alert('Please enter a username');
            return;
        }
        
        ELEMENTS.guestBtn.disabled = true;
        ELEMENTS.guestBtn.textContent = 'Creating guest account...';
        
        const result = await Auth.createGuestUser(username);
        
        ELEMENTS.guestBtn.disabled = false;
        ELEMENTS.guestBtn.textContent = 'Play as Guest';
        
        if (result) {
            // Guest account created, update UI
            alert(`Guest account created! You can now play as ${result.username}.`);
            // Update UI to reflect guest user
        } else {
            alert('Failed to create guest account. Please try again.');
        }
    });
    
    // Logout button
    ELEMENTS.logoutBtn.addEventListener('click', async () => {
        const result = await Auth.logout();
        
        if (!result.success) {
            alert(`Logout failed: ${result.error}`);
        }
    });
});
