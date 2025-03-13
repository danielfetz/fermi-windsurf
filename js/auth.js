/**
 * Auth module for handling user authentication
 */
const Auth = (function() {
    // Current user data
    let currentUser = null;
    let elementsInitialized = false;

    // Wait for ELEMENTS to be defined
    window.addEventListener('ELEMENTS_READY', function() {
        elementsInitialized = true;
        initEventListeners();
    });

    // Event handlers
    const onAuthStateChange = (callback) => {
        // Set up Supabase auth state subscriber
        if (!window.supabase || !window.supabase.auth) {
            console.error('Supabase not initialized properly');
            return { data: { subscription: { unsubscribe: () => {} } } };
        }
        
        const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
            if (event === 'SIGNED_IN' && session) {
                getUserProfile(session.user.id).then(profile => {
                    currentUser = {
                        id: session.user.id,
                        email: session.user.email,
                        username: profile ? profile.username : session.user.email,
                        isGuest: profile ? profile.is_guest : false
                    };
                    
                    if (callback) callback(currentUser);
                });
            } else if (event === 'SIGNED_OUT') {
                currentUser = null;
                if (callback) callback(null);
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

    // Initialize DOM event listeners
    const initEventListeners = () => {
        if (!window.ELEMENTS) {
            console.error('ELEMENTS not defined. Unable to initialize event listeners.');
            return;
        }
        
        // Auth tab switching
        document.querySelectorAll('.auth-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                const tabName = tab.getAttribute('data-tab');
                
                // Update active tab
                document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                
                // Show active content
                document.querySelectorAll('.auth-content').forEach(content => {
                    content.classList.remove('active');
                    if (content.id === `${tabName}-form`) {
                        content.classList.add('active');
                    }
                });
            });
        });
        
        // Register form submission
        if (window.ELEMENTS.registerBtn) {
            window.ELEMENTS.registerBtn.addEventListener('click', async () => {
                const username = document.getElementById('register-username').value.trim();
                const email = document.getElementById('register-email').value.trim();
                const password = document.getElementById('register-password').value;
                
                if (!username || !email || !password) {
                    alert('Please fill in all fields');
                    return;
                }
                
                window.ELEMENTS.registerBtn.disabled = true;
                window.ELEMENTS.registerBtn.textContent = 'Registering...';
                
                const result = await Auth.register(email, password, username);
                
                window.ELEMENTS.registerBtn.disabled = false;
                window.ELEMENTS.registerBtn.textContent = 'Register';
                
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
        }
        
        // Login form submission
        if (window.ELEMENTS.loginBtn) {
            window.ELEMENTS.loginBtn.addEventListener('click', async () => {
                const email = document.getElementById('login-email').value.trim();
                const password = document.getElementById('login-password').value;
                
                if (!email || !password) {
                    alert('Please fill in all fields');
                    return;
                }
                
                window.ELEMENTS.loginBtn.disabled = true;
                window.ELEMENTS.loginBtn.textContent = 'Logging in...';
                
                const result = await Auth.login(email, password);
                
                window.ELEMENTS.loginBtn.disabled = false;
                window.ELEMENTS.loginBtn.textContent = 'Login';
                
                if (!result.success) {
                    alert(`Login failed: ${result.error}`);
                }
            });
        }
        
        // Guest user form submission
        if (window.ELEMENTS.guestBtn) {
            window.ELEMENTS.guestBtn.addEventListener('click', async () => {
                const username = document.getElementById('guest-username').value.trim();
                
                if (!username) {
                    alert('Please enter a username');
                    return;
                }
                
                window.ELEMENTS.guestBtn.disabled = true;
                window.ELEMENTS.guestBtn.textContent = 'Creating guest account...';
                
                const result = await Auth.createGuestUser(username);
                
                window.ELEMENTS.guestBtn.disabled = false;
                window.ELEMENTS.guestBtn.textContent = 'Play as Guest';
                
                if (result) {
                    // Guest account created, update UI
                    alert(`Guest account created! You can now play as ${result.username}.`);
                } else {
                    alert('Failed to create guest account. Please try again.');
                }
            });
        }
        
        // Logout button
        if (window.ELEMENTS.logoutBtn) {
            window.ELEMENTS.logoutBtn.addEventListener('click', async () => {
                const result = await Auth.logout();
                
                if (!result.success) {
                    alert(`Logout failed: ${result.error}`);
                }
            });
        }
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
