/**
 * Main application initialization
 */

// Wait for DOM and other modules to load
window.addEventListener('ELEMENTS_READY', () => {
    // Check if Supabase is configured
    if (!SUPABASE_URL || !SUPABASE_KEY || 
        SUPABASE_URL === '%SUPABASE_URL%' || 
        SUPABASE_KEY === '%SUPABASE_KEY%') {
        alert('Please configure your Supabase URL and key in js/config.js');
        return;
    }
    
    // Set up authentication state change listener
    Auth.onAuthStateChange((user) => {
        if (user) {
            // User is logged in
            ELEMENTS.authContainer.classList.add('hidden');
            ELEMENTS.lobbyContainer.classList.remove('hidden');
            ELEMENTS.gameRoomContainer.classList.add('hidden');
            
            // Update user display name
            if (ELEMENTS.userDisplayName) {
                ELEMENTS.userDisplayName.textContent = user.username;
            }
            
            // Initialize the lobby
            Lobby.init();
            
            // Check if there's a game ID in the URL
            const urlParams = new URLSearchParams(window.location.search);
            const gameId = urlParams.get('game');
            
            if (gameId) {
                Lobby.joinGame(gameId);
            }
        } else {
            // User is logged out
            ELEMENTS.authContainer.classList.remove('hidden');
            ELEMENTS.lobbyContainer.classList.add('hidden');
            ELEMENTS.gameRoomContainer.classList.add('hidden');
        }
    });
    
    // Initialize game
    Game.init();
    
    // Update game.js to work with game_actions.js
    updateGameModule();
});

/**
 * Update Game module to use GameActions
 */
function updateGameModule() {
    // Extend Game module with necessary methods
    Game.getCurrentGame = function() {
        return this.currentGame;
    };
    
    // Override original methods to use GameActions
    const originalStartGame = Game.startGame;
    Game.startGame = function() {
        if (typeof GameActions !== 'undefined') {
            GameActions.startGame();
        } else {
            originalStartGame();
        }
    };
    
    const originalMakeBettingAction = Game.makeBettingAction;
    Game.makeBettingAction = function(action, amount) {
        if (typeof GameActions !== 'undefined') {
            GameActions.makeBettingAction(action, amount);
        } else {
            originalMakeBettingAction(action, amount);
        }
    };
    
    const originalNextQuestion = Game.nextQuestion;
    Game.nextQuestion = function() {
        if (typeof GameActions !== 'undefined') {
            GameActions.nextQuestion();
        } else {
            originalNextQuestion();
        }
    };
    
    const originalPlayAgain = Game.playAgain;
    Game.playAgain = function() {
        if (typeof GameActions !== 'undefined') {
            GameActions.playAgain();
        } else {
            originalPlayAgain();
        }
    };
}

/**
 * Helper functions for UI
 */
// Show meta-game prediction UI
Game.showMetaGamePrediction = function() {
    ELEMENTS.metaGamePrediction.classList.remove('hidden');
    
    // Populate winner prediction dropdown
    const winnerPrediction = ELEMENTS.winnerPrediction;
    winnerPrediction.innerHTML = '<option value="">Select a player</option>';
    
    const players = this.currentGame.players || {};
    
    Object.values(players).forEach(player => {
        // Don't include current player or bankrupt players
        if (player.id !== this.currentPlayer.id && player.state !== PLAYER_STATES.BANKRUPT) {
            const option = document.createElement('option');
            option.value = player.id;
            option.textContent = player.username;
            winnerPrediction.appendChild(option);
        }
    });
    
    // Check if player has already submitted a prediction
    const currentPredictions = this.currentGame.current_question_predictions || {};
    const playerPrediction = currentPredictions[this.currentPlayer.id];
    
    if (playerPrediction) {
        // Disable prediction input
        winnerPrediction.disabled = true;
        ELEMENTS.submitPredictionBtn.disabled = true;
        
        // Show current prediction
        winnerPrediction.value = playerPrediction.predicted_winner_id;
        
        // Change button text
        ELEMENTS.submitPredictionBtn.textContent = 'Prediction Submitted';
    } else {
        // Enable prediction input
        winnerPrediction.disabled = false;
        ELEMENTS.submitPredictionBtn.disabled = false;
        
        // Reset input
        winnerPrediction.value = '';
        
        // Reset button text
        ELEMENTS.submitPredictionBtn.textContent = 'Submit Prediction';
    }
};

// Show betting phase
Game.showBettingPhase = function() {
    ELEMENTS.bettingPhase.classList.remove('hidden');
    
    // Update betting round
    let bettingRound = 1;
    if (this.currentGame.state === GAME_STATES.BETTING_ROUND_2 || this.currentGame.state === GAME_STATES.HINT_1) {
        bettingRound = 2;
    } else if (this.currentGame.state === GAME_STATES.BETTING_ROUND_3 || this.currentGame.state === GAME_STATES.HINT_2) {
        bettingRound = 3;
    }
    ELEMENTS.bettingRound.textContent = bettingRound;
    
    // Update pot amount
    const currentPot = this.currentGame.current_question_pot || 0;
    ELEMENTS.potAmount.textContent = `Pot: ${currentPot} chips`;
    
    // Update hints
    this.updateHints();
    
    // Update guesses list
    this.updateGuessesList();
    
    // Update betting actions
    this.updateBettingUI();
};

// Update hints display
Game.updateHints = function() {
    const currentQuestionIndex = this.currentGame.current_question_index;
    const questions = this.currentGame.questions || [];
    const currentQuestion = questions[currentQuestionIndex];
    
    if (!currentQuestion) return;
    
    // Show hint 1 if revealed
    if (this.currentGame.state === GAME_STATES.HINT_1 || 
        this.currentGame.state === GAME_STATES.BETTING_ROUND_2 || 
        this.currentGame.state === GAME_STATES.HINT_2 || 
        this.currentGame.state === GAME_STATES.BETTING_ROUND_3 || 
        this.currentGame.state === GAME_STATES.REVEAL) {
        ELEMENTS.hint1Text.textContent = currentQuestion.hint1;
        ELEMENTS.hint1Text.classList.remove('hidden');
    } else {
        ELEMENTS.hint1Text.classList.add('hidden');
    }
    
    // Show hint 2 if revealed
    if (this.currentGame.state === GAME_STATES.HINT_2 || 
        this.currentGame.state === GAME_STATES.BETTING_ROUND_3 || 
        this.currentGame.state === GAME_STATES.REVEAL) {
        ELEMENTS.hint2Text.textContent = currentQuestion.hint2;
        ELEMENTS.hint2Text.classList.remove('hidden');
    } else {
        ELEMENTS.hint2Text.classList.add('hidden');
    }
};

// Update guesses list
Game.updateGuessesList = function() {
    const guessesList = ELEMENTS.guessesList;
    guessesList.innerHTML = '';
    
    const currentQuestionGuesses = this.currentGame.current_question_guesses || {};
    const players = this.currentGame.players || {};
    
    Object.entries(currentQuestionGuesses).forEach(([playerId, guess]) => {
        const player = players[playerId];
        if (!player) return;
        
        const guessEl = document.createElement('div');
        guessEl.classList.add('guess-item');
        
        guessEl.innerHTML = `
            <div class="guess-player">${player.username}</div>
            <div class="guess-range">${guess.lower_bound} - ${guess.upper_bound}</div>
        `;
        
        guessesList.appendChild(guessEl);
    });
    
    if (guessesList.children.length === 0) {
        guessesList.innerHTML = '<div class="empty-state">No guesses yet</div>';
    }
};

// Update betting UI
Game.updateBettingUI = function() {
    const players = this.currentGame.players || {};
    const currentPlayerData = players[this.currentPlayer.id];
    
    if (!currentPlayerData) return;
    
    // Update player chips
    ELEMENTS.playerChips.textContent = currentPlayerData.chips;
    
    // Check if player has folded for this question
    const foldedQuestions = currentPlayerData.folded_questions || [];
    const hasFolded = foldedQuestions.includes(this.currentGame.current_question_index);
    
    // Check if it's player's turn to bet
    const currentBettingPlayerId = this.currentGame.current_betting_player_id;
    const isPlayerTurn = currentBettingPlayerId === this.currentPlayer.id;
    
    // Get current bet amount
    const currentBetAmount = this.currentGame.current_bet || 0;
    ELEMENTS.currentBet.textContent = currentBetAmount;
    
    // Update betting actions visibility
    if (hasFolded || currentPlayerData.state === PLAYER_STATES.BANKRUPT) {
        // If player has folded or is bankrupt, hide betting actions
        ELEMENTS.bettingActions.classList.add('hidden');
    } else if (!isPlayerTurn) {
        // If it's not player's turn, show betting actions but disable buttons
        ELEMENTS.bettingActions.classList.remove('hidden');
        ELEMENTS.foldBtn.disabled = true;
        ELEMENTS.callBtn.disabled = true;
        ELEMENTS.raiseBtn.disabled = true;
        ELEMENTS.raiseSlider.disabled = true;
        ELEMENTS.raiseAmount.disabled = true;
    } else {
        // If it's player's turn, show betting actions and enable buttons
        ELEMENTS.bettingActions.classList.remove('hidden');
        ELEMENTS.foldBtn.disabled = false;
        
        // Check if player can call
        const playerBet = this.currentGame.current_question_bets?.[this.currentPlayer.id] || 0;
        const toCall = currentBetAmount - playerBet;
        
        if (toCall > 0 && toCall <= currentPlayerData.chips) {
            ELEMENTS.callBtn.disabled = false;
            ELEMENTS.callBtn.textContent = `Call ${toCall}`;
        } else if (toCall === 0) {
            ELEMENTS.callBtn.disabled = false;
            ELEMENTS.callBtn.textContent = 'Check';
        } else {
            ELEMENTS.callBtn.disabled = true;
            ELEMENTS.callBtn.textContent = 'Call';
        }
        
        // Check if player can raise
        const minRaise = currentBetAmount + 1;
        const maxRaise = currentPlayerData.chips;
        
        if (maxRaise >= minRaise) {
            ELEMENTS.raiseBtn.disabled = false;
            ELEMENTS.raiseSlider.disabled = false;
            ELEMENTS.raiseAmount.disabled = false;
            
            // Update raise slider and input
            ELEMENTS.raiseSlider.min = minRaise;
            ELEMENTS.raiseSlider.max = maxRaise;
            ELEMENTS.raiseSlider.value = minRaise;
            
            ELEMENTS.raiseAmount.min = minRaise;
            ELEMENTS.raiseAmount.max = maxRaise;
            ELEMENTS.raiseAmount.value = minRaise;
        } else {
            ELEMENTS.raiseBtn.disabled = true;
            ELEMENTS.raiseSlider.disabled = true;
            ELEMENTS.raiseAmount.disabled = true;
        }
    }
};

// Show reveal phase
Game.showRevealPhase = function() {
    ELEMENTS.revealPhase.classList.remove('hidden');
    
    const currentQuestionIndex = this.currentGame.current_question_index;
    const questions = this.currentGame.questions || [];
    const currentQuestion = questions[currentQuestionIndex];
    
    if (!currentQuestion) return;
    
    // Show correct answer
    ELEMENTS.correctAnswer.textContent = currentQuestion.answer;
    
    // Show winner
    const currentQuestionResults = this.currentGame.current_question_results || {};
    const winnerId = currentQuestionResults.winner_id;
    const players = this.currentGame.players || {};
    
    if (winnerId && players[winnerId]) {
        ELEMENTS.winnerName.textContent = players[winnerId].username;
        
        const winningGuess = this.currentGame.current_question_guesses?.[winnerId];
        if (winningGuess) {
            ELEMENTS.winningRange.textContent = `${winningGuess.lower_bound} - ${winningGuess.upper_bound}`;
        }
        
        ELEMENTS.winnerAnnouncement.classList.remove('hidden');
    } else {
        ELEMENTS.winnerAnnouncement.classList.add('hidden');
    }
    
    // Show all guesses
    const allGuessesList = ELEMENTS.allGuessesList;
    allGuessesList.innerHTML = '';
    
    const currentQuestionGuesses = this.currentGame.current_question_guesses || {};
    
    Object.entries(currentQuestionGuesses).forEach(([playerId, guess]) => {
        const player = players[playerId];
        if (!player) return;
        
        const isWinner = playerId === winnerId;
        const rangeWidth = guess.upper_bound - guess.lower_bound;
        const isInRange = currentQuestion.answer >= guess.lower_bound && currentQuestion.answer <= guess.upper_bound;
        
        const guessEl = document.createElement('div');
        guessEl.classList.add('all-guess-item');
        
        if (isWinner) {
            guessEl.classList.add('winner');
        }
        
        guessEl.innerHTML = `
            <div class="guess-player">${player.username}</div>
            <div class="guess-range">${guess.lower_bound} - ${guess.upper_bound}</div>
            <div class="guess-width">Width: ${rangeWidth}</div>
            <div class="guess-result">${isInRange ? 'In Range ✓' : 'Outside Range ✗'}</div>
        `;
        
        allGuessesList.appendChild(guessEl);
    });
    
    if (allGuessesList.children.length === 0) {
        allGuessesList.innerHTML = '<div class="empty-state">No guesses</div>';
    }
    
    // Show next question button only to creator
    if (this.currentGame.creator_id === this.currentPlayer.id) {
        ELEMENTS.nextQuestionBtn.classList.remove('hidden');
        
        // Change button text on last question
        if (currentQuestionIndex === this.currentGame.num_questions - 1) {
            ELEMENTS.nextQuestionBtn.textContent = 'End Game';
        } else {
            ELEMENTS.nextQuestionBtn.textContent = 'Next Question';
        }
    } else {
        ELEMENTS.nextQuestionBtn.classList.add('hidden');
    }
};

// Show game over screen
Game.showGameOver = function() {
    ELEMENTS.gameOver.classList.remove('hidden');
    
    // Show final standings
    const finalStandingsList = ELEMENTS.finalStandingsList;
    finalStandingsList.innerHTML = '';
    
    const players = this.currentGame.players || {};
    
    // Sort players by chips (descending)
    const sortedPlayers = Object.values(players).sort((a, b) => b.chips - a.chips);
    
    sortedPlayers.forEach((player, index) => {
        const standingEl = document.createElement('div');
        standingEl.classList.add('standing-item');
        
        if (index === 0) {
            standingEl.classList.add('winner');
        }
        
        standingEl.innerHTML = `
            <div class="standing-rank">${index + 1}</div>
            <div class="standing-player">${player.username}</div>
            <div class="standing-chips">${player.chips} chips</div>
        `;
        
        finalStandingsList.appendChild(standingEl);
    });
    
    // Show play again button only to creator
    if (this.currentGame.creator_id === this.currentPlayer.id) {
        ELEMENTS.playAgainBtn.classList.remove('hidden');
    } else {
        ELEMENTS.playAgainBtn.classList.add('hidden');
    }
};
