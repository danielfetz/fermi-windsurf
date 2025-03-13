// Supabase configuration
const SUPABASE_URL = '%SUPABASE_URL%';
const SUPABASE_KEY = '%SUPABASE_KEY%';

// UI Elements
const ELEMENTS = {
    // Auth elements
    authContainer: document.getElementById('auth-container'),
    loginForm: document.getElementById('login-form'),
    registerForm: document.getElementById('register-form'),
    loginBtn: document.getElementById('login-btn'),
    registerBtn: document.getElementById('register-btn'),
    
    // Lobby elements
    lobbyContainer: document.getElementById('lobby-container'),
    userDisplayName: document.getElementById('user-display-name'),
    logoutBtn: document.getElementById('logout-btn'),
    gamesList: document.getElementById('games-list'),
    createGameBtn: document.getElementById('create-game-btn'),
    joinGameByInviteBtn: document.getElementById('join-game-by-invite-btn'),
    
    // Create game modal
    createGameModal: document.getElementById('create-game-modal'),
    gameName: document.getElementById('game-name'),
    startingChips: document.getElementById('starting-chips'),
    minPlayers: document.getElementById('min-players'),
    maxPlayers: document.getElementById('max-players'),
    guessTime: document.getElementById('guess-time'),
    enableMetaGame: document.getElementById('enable-meta-game'),
    numQuestions: document.getElementById('num-questions'),
    confirmCreateGame: document.getElementById('confirm-create-game'),
    cancelCreateGame: document.getElementById('cancel-create-game'),
    
    // Join game modal
    joinGameModal: document.getElementById('join-game-modal'),
    inviteCode: document.getElementById('invite-code'),
    guestLoginContainer: document.getElementById('guest-login-container'),
    guestUsername: document.getElementById('guest-username'),
    confirmJoinByInvite: document.getElementById('confirm-join-by-invite'),
    cancelJoinByInvite: document.getElementById('cancel-join-by-invite'),
    
    // Game room elements
    gameRoomContainer: document.getElementById('game-room-container'),
    gameRoomName: document.getElementById('game-room-name'),
    gameStatus: document.getElementById('game-status'),
    leaveGameBtn: document.getElementById('leave-game-btn'),
    playersList: document.getElementById('players-list'),
    
    // Game states
    waitingScreen: document.getElementById('waiting-screen'),
    currentPlayers: document.getElementById('current-players'),
    minRequiredPlayers: document.getElementById('min-required-players'),
    startGameBtn: document.getElementById('start-game-btn'),
    
    questionPhase: document.getElementById('question-phase'),
    currentQuestionNum: document.getElementById('current-question-num'),
    totalQuestions: document.getElementById('total-questions'),
    timer: document.getElementById('timer'),
    currentQuestion: document.getElementById('current-question'),
    lowerBound: document.getElementById('lower-bound'),
    upperBound: document.getElementById('upper-bound'),
    submitGuessBtn: document.getElementById('submit-guess-btn'),
    
    metaGamePrediction: document.getElementById('meta-game-prediction'),
    winnerPrediction: document.getElementById('winner-prediction'),
    submitPredictionBtn: document.getElementById('submit-prediction-btn'),
    
    bettingPhase: document.getElementById('betting-phase'),
    bettingRound: document.getElementById('betting-round'),
    potAmount: document.getElementById('pot-amount'),
    hint1: document.getElementById('hint-1'),
    hint1Text: document.getElementById('hint-1-text'),
    hint2: document.getElementById('hint-2'),
    hint2Text: document.getElementById('hint-2-text'),
    guessesList: document.getElementById('guesses-list'),
    currentBet: document.getElementById('current-bet'),
    playerChips: document.getElementById('player-chips'),
    foldBtn: document.getElementById('fold-btn'),
    callBtn: document.getElementById('call-btn'),
    raiseSlider: document.getElementById('raise-slider'),
    raiseAmount: document.getElementById('raise-amount'),
    raiseBtn: document.getElementById('raise-btn'),
    
    revealPhase: document.getElementById('reveal-phase'),
    correctAnswer: document.getElementById('correct-answer'),
    winnerName: document.getElementById('winner-name'),
    winningRange: document.getElementById('winning-range'),
    allGuessesList: document.getElementById('all-guesses-list'),
    nextQuestionBtn: document.getElementById('next-question-btn'),
    
    gameOver: document.getElementById('game-over'),
    finalStandingsList: document.getElementById('final-standings-list'),
    returnToLobbyBtn: document.getElementById('return-to-lobby-btn'),
    playAgainBtn: document.getElementById('play-again-btn'),
    
    // Chat elements
    chatMessages: document.getElementById('chat-messages'),
    chatInput: document.getElementById('chat-input'),
    sendChatBtn: document.getElementById('send-chat-btn')
};

// Initialize Supabase client
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

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
