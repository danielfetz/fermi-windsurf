/**
 * Lobby module for handling game listing and creation
 */
const Lobby = (function() {
    // Store available games
    let games = [];
    
    // Initialize lobby
    const init = () => {
        // Get initial games list
        fetchGames();
        
        // Set up real-time subscription for games
        subscribeToGames();
        
        // Set up event listeners
        setupEventListeners();
    };
    
    // Fetch available games from the database
    const fetchGames = async () => {
        try {
            const { data, error } = await supabase
                .from('games')
                .select('*')
                .eq('status', 'waiting')
                .order('created_at', { ascending: false });
                
            if (error) throw error;
            
            games = data || [];
            renderGamesList();
        } catch (error) {
            console.error('Error fetching games:', error);
        }
    };
    
    // Subscribe to real-time updates for games
    const subscribeToGames = () => {
        const subscription = supabase
            .channel('public:games')
            .on('postgres_changes', { 
                event: '*', 
                schema: 'public', 
                table: 'games' 
            }, payload => {
                handleGameUpdate(payload);
            })
            .subscribe();
            
        return subscription;
    };
    
    // Handle game updates from real-time subscription
    const handleGameUpdate = (payload) => {
        const { eventType, new: newGame, old: oldGame } = payload;
        
        if (eventType === 'INSERT') {
            // Add new game to list if it's in waiting status
            if (newGame.status === 'waiting') {
                games.unshift(newGame);
                renderGamesList();
            }
        } else if (eventType === 'UPDATE') {
            // Update existing game
            const index = games.findIndex(g => g.id === newGame.id);
            
            if (index !== -1) {
                // If game is no longer waiting, remove it
                if (newGame.status !== 'waiting') {
                    games.splice(index, 1);
                } else {
                    // Otherwise update it
                    games[index] = newGame;
                }
                renderGamesList();
            }
        } else if (eventType === 'DELETE') {
            // Remove deleted game
            const index = games.findIndex(g => g.id === oldGame.id);
            
            if (index !== -1) {
                games.splice(index, 1);
                renderGamesList();
            }
        }
    };
    
    // Render games list
    const renderGamesList = () => {
        const gamesList = ELEMENTS.gamesList;
        
        if (games.length === 0) {
            gamesList.innerHTML = '<div class="empty-state">No games available. Create one to start playing!</div>';
            return;
        }
        
        gamesList.innerHTML = '';
        
        games.forEach(game => {
            const gameEl = document.createElement('div');
            gameEl.classList.add('game-item');
            
            const currentPlayers = game.players ? Object.keys(game.players).length : 0;
            
            gameEl.innerHTML = `
                <div class="game-info">
                    <h3>${game.name}</h3>
                    <div>
                        <span class="players-count">${currentPlayers}/${game.max_players} players</span>
                        ${game.enable_meta_game ? '<span class="meta-badge">Meta-Game</span>' : ''}
                    </div>
                </div>
                <button class="btn primary-btn join-game-btn" data-id="${game.id}">Join Game</button>
            `;
            
            gamesList.appendChild(gameEl);
        });
        
        // Add join game button event listeners
        document.querySelectorAll('.join-game-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const gameId = btn.dataset.id;
                joinGame(gameId);
            });
        });
    };
    
    // Join a game
    const joinGame = async (gameId) => {
        try {
            const user = Auth.getCurrentUser();
            
            if (!user) {
                alert('You must be logged in to join a game');
                return;
            }
            
            // Get the game
            const { data: game, error: gameError } = await supabase
                .from('games')
                .select('*')
                .eq('id', gameId)
                .single();
                
            if (gameError) throw gameError;
            
            // Check if game is full
            const currentPlayers = game.players ? Object.keys(game.players).length : 0;
            if (currentPlayers >= game.max_players) {
                alert('This game is full');
                return;
            }
            
            // Add player to game
            const players = game.players || {};
            
            // If player is already in the game, just enter the game room
            if (players[user.id]) {
                Game.enterGame(gameId);
                return;
            }
            
            // Add player to game
            players[user.id] = {
                id: user.id,
                username: user.username,
                chips: game.starting_chips,
                state: PLAYER_STATES.ACTIVE,
                folded_questions: [],
                correct_predictions: 0
            };
            
            // Update game with new player
            const { error: updateError } = await supabase
                .from('games')
                .update({
                    players: players
                })
                .eq('id', gameId);
                
            if (updateError) throw updateError;
            
            // Enter game room
            Game.enterGame(gameId);
        } catch (error) {
            console.error('Error joining game:', error);
            alert('Failed to join game. Please try again.');
        }
    };
    
    // Create a new game
    const createGame = async () => {
        try {
            const user = Auth.getCurrentUser();
            
            if (!user) {
                alert('You must be logged in to create a game');
                return;
            }
            
            // Get form values
            const name = ELEMENTS.gameName.value;
            const startingChips = parseInt(ELEMENTS.startingChips.value);
            const minPlayers = parseInt(ELEMENTS.minPlayers.value);
            const maxPlayers = parseInt(ELEMENTS.maxPlayers.value);
            const guessTime = parseInt(ELEMENTS.guessTime.value);
            const enableMetaGame = ELEMENTS.enableMetaGame.checked;
            const numQuestions = parseInt(ELEMENTS.numQuestions.value);
            
            // Validate inputs
            if (!name) {
                alert('Please enter a game name');
                return;
            }
            
            if (isNaN(startingChips) || startingChips < 100) {
                alert('Starting chips must be at least 100');
                return;
            }
            
            if (isNaN(minPlayers) || minPlayers < 2) {
                alert('Minimum players must be at least 2');
                return;
            }
            
            if (isNaN(maxPlayers) || maxPlayers < minPlayers) {
                alert('Maximum players must be at least equal to minimum players');
                return;
            }
            
            if (isNaN(guessTime) || guessTime < 30) {
                alert('Guess time must be at least 30 seconds');
                return;
            }
            
            if (isNaN(numQuestions) || numQuestions < 1) {
                alert('Number of questions must be at least 1');
                return;
            }
            
            // Generate a random invite code
            const inviteCode = generateInviteCode();
            
            // Fetch random questions
            const questions = await fetchRandomQuestions(numQuestions);
            
            // Create game
            const { data, error } = await supabase
                .from('games')
                .insert({
                    name,
                    creator_id: user.id,
                    status: 'waiting',
                    state: GAME_STATES.WAITING,
                    starting_chips: startingChips,
                    min_players: minPlayers,
                    max_players: maxPlayers,
                    guess_time: guessTime,
                    enable_meta_game: enableMetaGame,
                    num_questions: numQuestions,
                    invite_code: inviteCode,
                    questions,
                    players: {
                        [user.id]: {
                            id: user.id,
                            username: user.username,
                            chips: startingChips,
                            state: PLAYER_STATES.ACTIVE,
                            folded_questions: [],
                            correct_predictions: 0
                        }
                    }
                })
                .select();
                
            if (error) throw error;
            
            // Close modal
            ELEMENTS.createGameModal.classList.add('hidden');
            
            // Show invite code to game creator
            alert(`Game created! Invite code: ${inviteCode}`);
            
            // Join the created game
            joinGame(data[0].id);
        } catch (error) {
            console.error('Error creating game:', error);
            alert('Failed to create game. Please try again.');
        }
    };
    
    // Generate a random 6-character invite code
    const generateInviteCode = () => {
        const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Removed confusing characters (0/O, 1/I)
        let result = '';
        for (let i = 0; i < 6; i++) {
            result += characters.charAt(Math.floor(Math.random() * characters.length));
        }
        return result;
    };
    
    // Join game by invite code
    const joinGameByInviteCode = async () => {
        try {
            const inviteCode = ELEMENTS.inviteCode.value.toUpperCase();
            
            if (!inviteCode || inviteCode.length !== 6) {
                alert('Please enter a valid 6-character invite code');
                return;
            }
            
            // Get current user or check for guest login
            let user = Auth.getCurrentUser();
            
            if (!user) {
                // No user logged in, show guest login section
                ELEMENTS.guestLoginContainer.classList.remove('hidden');
                
                const guestUsername = ELEMENTS.guestUsername.value.trim();
                if (!guestUsername) {
                    // No guest username provided
                    return;
                }
                
                // Create guest user
                user = await Auth.createGuestUser(guestUsername);
                if (!user) {
                    return;
                }
            }
            
            // Find game by invite code
            const { data: games, error } = await supabase
                .from('games')
                .select('*')
                .eq('invite_code', inviteCode);
                
            if (error) throw error;
            
            if (!games || games.length === 0) {
                alert('Game not found. Please check the invite code and try again.');
                return;
            }
            
            const game = games[0];
            
            // Check if game is still accepting players
            if (game.status !== 'waiting') {
                alert('This game is no longer accepting players.');
                return;
            }
            
            // Check if game is full
            const currentPlayers = game.players ? Object.keys(game.players).length : 0;
            if (currentPlayers >= game.max_players) {
                alert('This game is full');
                return;
            }
            
            // Add player to game if not already in it
            const players = game.players || {};
            
            // If player is already in the game, just enter the game room
            if (players[user.id]) {
                // Hide modal
                ELEMENTS.joinGameModal.classList.add('hidden');
                Game.enterGame(game.id);
                return;
            }
            
            // Add player to game
            players[user.id] = {
                id: user.id,
                username: user.username,
                chips: game.starting_chips,
                state: PLAYER_STATES.ACTIVE,
                folded_questions: [],
                correct_predictions: 0
            };
            
            // Update game with new player
            const { error: updateError } = await supabase
                .from('games')
                .update({
                    players: players
                })
                .eq('id', game.id);
                
            if (updateError) throw updateError;
            
            // Hide modal
            ELEMENTS.joinGameModal.classList.add('hidden');
            
            // Enter game room
            Game.enterGame(game.id);
        } catch (error) {
            console.error('Error joining game by invite code:', error);
            alert('Failed to join game. Please try again.');
        }
    };
    
    // Fetch random questions
    const fetchRandomQuestions = async (count) => {
        try {
            // Try to get random questions from database
            const { data, error } = await supabase
                .from('questions')
                .select()
                .limit(100);  // Get a lot of questions to sample from
                
            if (error) throw error;
            
            if (data && data.length >= count) {
                // We have enough questions, shuffle and take random subset
                const shuffled = [...data].sort(() => 0.5 - Math.random());
                return shuffled.slice(0, count);
            } else {
                // Not enough questions in database, use defaults
                return generateDefaultQuestions(count);
            }
        } catch (error) {
            console.error('Error fetching questions:', error);
            return generateDefaultQuestions(count);
        }
    };
    
    // Generate default questions if database fetch fails
    const generateDefaultQuestions = (count) => {
        const defaultQuestions = [
            {
                question: "How many piano tuners are there in Chicago?",
                answer: 125,
                hint1: "The population of Chicago is about 2.7 million",
                hint2: "The average piano tuner services about 200 pianos per year",
                category: "population",
                difficulty: "medium"
            },
            {
                question: "How many sheets of paper are used in the U.S. annually?",
                answer: 10000000000,
                hint1: "There are about 330 million people in the U.S.",
                hint2: "The average office worker uses about 10,000 sheets per year",
                category: "consumption",
                difficulty: "medium"
            },
            {
                question: "How many grains of sand would it take to cover Manhattan?",
                answer: 1000000000000000,
                hint1: "Manhattan is about 59 square kilometers",
                hint2: "A grain of sand is about 0.5mm in diameter",
                category: "physical",
                difficulty: "hard"
            },
            {
                question: "How many heartbeats does the average person have in their lifetime?",
                answer: 2500000000,
                hint1: "The average heart rate is about 70 beats per minute",
                hint2: "The average human lifespan is about 75 years",
                category: "biology",
                difficulty: "easy"
            },
            {
                question: "How many pizzas are consumed in the U.S. each day?",
                answer: 3000000,
                hint1: "Americans eat about 350 slices of pizza per second",
                hint2: "The average pizza has 8 slices",
                category: "food",
                difficulty: "medium"
            },
            {
                question: "How many commercial flights take off worldwide each day?",
                answer: 100000,
                hint1: "There are about 20,000 commercial aircraft in service",
                hint2: "The average commercial aircraft performs 3-5 flights per day",
                category: "transportation",
                difficulty: "medium"
            },
            {
                question: "How many breaths will you take in your lifetime?",
                answer: 500000000,
                hint1: "The average person breathes about 12-20 times per minute",
                hint2: "The average human lifespan is about 75 years",
                category: "biology",
                difficulty: "easy"
            },
            {
                question: "How many words are in all Harry Potter books combined?",
                answer: 1084170,
                hint1: "There are 7 Harry Potter books",
                hint2: "The average novel has about 90,000 words",
                category: "literature",
                difficulty: "medium"
            },
            {
                question: "How many stars are in our galaxy?",
                answer: 100000000000,
                hint1: "Our galaxy is the Milky Way",
                hint2: "The diameter of the Milky Way is about 100,000 light years",
                category: "astronomy",
                difficulty: "hard"
            },
            {
                question: "How many seconds have passed since the year 1900?",
                answer: 3800000000,
                hint1: "There are 86,400 seconds in a day",
                hint2: "There are about 365.25 days in a year",
                category: "time",
                difficulty: "easy"
            }
        ];
        
        // Shuffle and select the requested number of questions
        const shuffled = [...defaultQuestions].sort(() => 0.5 - Math.random());
        return shuffled.slice(0, count);
    };
    
    // Toggle create game modal
    const toggleCreateGameModal = (show) => {
        if (show) {
            ELEMENTS.createGameModal.classList.remove('hidden');
            // Reset form to defaults
            ELEMENTS.gameName.value = '';
            ELEMENTS.startingChips.value = DEFAULT_GAME_CONFIG.startingChips;
            ELEMENTS.minPlayers.value = DEFAULT_GAME_CONFIG.minPlayers;
            ELEMENTS.maxPlayers.value = DEFAULT_GAME_CONFIG.maxPlayers;
            ELEMENTS.guessTime.value = DEFAULT_GAME_CONFIG.guessTime;
            ELEMENTS.enableMetaGame.checked = DEFAULT_GAME_CONFIG.enableMetaGame;
            ELEMENTS.numQuestions.value = DEFAULT_GAME_CONFIG.numQuestions;
        } else {
            ELEMENTS.createGameModal.classList.add('hidden');
        }
    };
    
    // Toggle join game modal
    const toggleJoinGameModal = (show) => {
        if (show) {
            ELEMENTS.joinGameModal.classList.remove('hidden');
            ELEMENTS.inviteCode.value = '';
            ELEMENTS.guestUsername.value = '';
            
            // Show guest login section if not logged in
            if (!Auth.isAuthenticated()) {
                ELEMENTS.guestLoginContainer.classList.remove('hidden');
            } else {
                ELEMENTS.guestLoginContainer.classList.add('hidden');
            }
        } else {
            ELEMENTS.joinGameModal.classList.add('hidden');
        }
    };
    
    // Set up event listeners
    const setupEventListeners = () => {
        // Create game button
        ELEMENTS.createGameBtn.addEventListener('click', () => toggleCreateGameModal(true));
        
        // Join game by invite button
        ELEMENTS.joinGameByInviteBtn.addEventListener('click', () => toggleJoinGameModal(true));
        
        // Create game modal close and cancel buttons
        document.querySelectorAll('.close-modal-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal');
                if (modal) {
                    modal.classList.add('hidden');
                }
            });
        });
        
        ELEMENTS.cancelCreateGame.addEventListener('click', () => toggleCreateGameModal(false));
        ELEMENTS.cancelJoinByInvite.addEventListener('click', () => toggleJoinGameModal(false));
        
        // Create game submit button
        ELEMENTS.confirmCreateGame.addEventListener('click', createGame);
        
        // Join by invite code submit button
        ELEMENTS.confirmJoinByInvite.addEventListener('click', joinGameByInviteCode);
        
        // Invite code input auto-uppercase
        ELEMENTS.inviteCode.addEventListener('input', (e) => {
            e.target.value = e.target.value.toUpperCase();
        });
        
        // When typing in guest username field, also update the invite code join button state
        ELEMENTS.guestUsername.addEventListener('input', () => {
            const inviteCode = ELEMENTS.inviteCode.value.trim();
            const guestUsername = ELEMENTS.guestUsername.value.trim();
            ELEMENTS.confirmJoinByInvite.disabled = !inviteCode || (!Auth.isAuthenticated() && !guestUsername);
        });
    };
    
    // Return public methods
    return {
        init,
        fetchGames,
        joinGame,
        createGame,
        fetchRandomQuestions,
        generateDefaultQuestions
    };
})();
