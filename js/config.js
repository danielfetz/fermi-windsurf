// Supabase configuration
const SUPABASE_URL = '%SUPABASE_URL%';
const SUPABASE_KEY = '%SUPABASE_KEY%';

// Ensure Supabase is available globally 
if (typeof supabase === 'undefined' && typeof window.supabase !== 'undefined') {
    window.supabase = window.supabase;
} else if (typeof supabase === 'undefined') {
    console.error('Supabase SDK not loaded! Please include the Supabase script in the HTML.');
    // Create a dummy client to prevent errors
    window.supabase = {
        createClient: function() {
            return {
                auth: {
                    onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } })
                }
            };
        }
    };
}

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// UI Elements will be initialized after DOM is loaded
let ELEMENTS = {};

// Initialize UI elements when DOM is ready
function initUIElements() {
    ELEMENTS = {
        // Auth elements
        authContainer: document.getElementById('auth-container'),
        loginForm: document.getElementById('login-form'),
        registerForm: document.getElementById('register-form'),
        loginBtn: document.getElementById('login-btn'),
        registerBtn: document.getElementById('register-btn'),
        guestBtn: document.getElementById('guest-btn'),
        logoutBtn: document.getElementById('logout-btn'),
        userDisplayName: document.getElementById('user-display-name'),
        
        // Lobby elements
        lobbyContainer: document.getElementById('lobby-container'),
        createGameBtn: document.getElementById('create-game-btn'),
        refreshGamesBtn: document.getElementById('refresh-games-btn'),
        gamesList: document.getElementById('games-list'),
        joinGameByCodeBtn: document.getElementById('join-game-by-code-btn'),
        
        // Create game modal
        createGameModal: document.getElementById('create-game-modal'),
        closeCreateGameBtn: document.querySelector('#create-game-modal .close-modal-btn'),
        createGameForm: document.getElementById('create-game-form'),
        gameNameInput: document.getElementById('game-name'),
        startingChipsInput: document.getElementById('starting-chips'),
        minPlayersInput: document.getElementById('min-players'),
        maxPlayersInput: document.getElementById('max-players'),
        guessTimeInput: document.getElementById('guess-time'),
        enableMetaGameInput: document.getElementById('enable-meta-game'),
        numQuestionsInput: document.getElementById('num-questions'),
        createGameSubmitBtn: document.getElementById('create-game-submit-btn'),
        
        // Join game modal
        joinGameModal: document.getElementById('join-game-modal'),
        closeJoinGameBtn: document.querySelector('#join-game-modal .close-modal-btn'),
        inviteCodeInput: document.getElementById('invite-code'),
        guestUsernameInput: document.getElementById('guest-username'),
        joinGameSubmitBtn: document.getElementById('join-game-submit-btn'),
        
        // Game room elements
        gameRoomContainer: document.getElementById('game-room-container'),
        gameRoomName: document.getElementById('game-room-name'),
        gameStatus: document.getElementById('game-status'),
        playersList: document.getElementById('players-list'),
        leaveGameBtn: document.getElementById('leave-game-btn'),
        
        // Game states
        waitingScreen: document.getElementById('waiting-screen'),
        currentPlayers: document.getElementById('current-players'),
        minRequiredPlayers: document.getElementById('min-required-players'),
        startGameBtn: document.getElementById('start-game-btn'),
        
        // Question phase
        questionPhase: document.getElementById('question-phase'),
        questionText: document.getElementById('question-text'),
        questionCounterText: document.getElementById('question-counter-text'),
        lowerBoundInput: document.getElementById('lower-bound'),
        upperBoundInput: document.getElementById('upper-bound'),
        submitGuessBtn: document.getElementById('submit-guess-btn'),
        questionTimer: document.getElementById('question-timer'),
        
        // Betting phases
        bettingPhase1: document.getElementById('betting-phase-1'),
        bettingPhase2: document.getElementById('betting-phase-2'),
        bettingPhase3: document.getElementById('betting-phase-3'),
        bettingPlayersList: document.getElementById('betting-players-list'),
        hintText1: document.getElementById('hint-text-1'),
        hintText2: document.getElementById('hint-text-2'),
        chipCount: document.getElementById('chip-count'),
        betAmount: document.getElementById('bet-amount'),
        betSlider: document.getElementById('bet-slider'),
        callBtn: document.getElementById('call-btn'),
        raiseBtn: document.getElementById('raise-btn'),
        allInBtn: document.getElementById('all-in-btn'),
        foldBtn: document.getElementById('fold-btn'),
        betTimer: document.getElementById('bet-timer'),
        
        // Reveal phase
        revealPhase: document.getElementById('reveal-phase'),
        correctAnswer: document.getElementById('correct-answer'),
        revealPlayersList: document.getElementById('reveal-players-list'),
        
        // Game over
        gameOver: document.getElementById('game-over'),
        gameOverTitle: document.getElementById('game-over-title'),
        finalRankings: document.getElementById('final-rankings'),
        returnToLobbyBtn: document.getElementById('return-to-lobby-btn'),
        
        // Chat
        chatMessages: document.getElementById('chat-messages'),
        chatInput: document.getElementById('chat-input'),
        sendChatBtn: document.getElementById('send-chat-btn')
    };
    
    window.ELEMENTS = ELEMENTS;
    
    // Dispatch an event to notify other modules that ELEMENTS are ready
    window.dispatchEvent(new Event('ELEMENTS_READY'));
}

// Game configuration defaults
const DEFAULT_GAME_CONFIG = {
    startingChips: 1000,
    minPlayers: 2,
    maxPlayers: 6,
    guessTime: 60, // seconds
    enableMetaGame: false,
    numQuestions: 5,
    minRejoinPredictions: 3, // predictions needed to rejoin after bankruptcy
    minRejoinChips: 50 // chips to give when rejoining after bankruptcy
};

// Game states
const GAME_STATES = {
    WAITING: 'waiting',
    QUESTION: 'question',
    BETTING_ROUND_1: 'betting_round_1',
    HINT_1: 'hint_1',
    BETTING_ROUND_2: 'betting_round_2',
    HINT_2: 'hint_2',
    BETTING_ROUND_3: 'betting_round_3',
    REVEAL: 'reveal',
    GAME_OVER: 'game_over'
};

// Player states
const PLAYER_STATES = {
    ACTIVE: 'active',
    FOLDED: 'folded',
    BANKRUPT: 'bankrupt'
};

// Initialize elements when DOM is loaded
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initUIElements);
} else {
    initUIElements();
}

// Create an event that other scripts can wait for
document.addEventListener('DOMContentLoaded', function() {
    window.dispatchEvent(new Event('CONFIG_LOADED'));
});
