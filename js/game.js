/**
 * Game module for handling game logic
 */
const Game = (function() {
    // Current game state
    let currentGame = null;
    let currentPlayer = null;
    let subscription = null;
    
    // Initialize game
    const init = () => {
        setupEventListeners();
    };
    
    // Enter a game room
    const enterGame = async (gameId) => {
        try {
            currentPlayer = Auth.getCurrentUser();
            
            if (!currentPlayer) {
                alert('You must be logged in to join a game');
                return;
            }
            
            // Fetch game data
            const { data: game, error } = await supabase
                .from('games')
                .select('*')
                .eq('id', gameId)
                .single();
                
            if (error) throw error;
            
            currentGame = game;
            
            // Subscribe to game updates
            subscribeToGame(gameId);
            
            // Switch to game room screen
            showGameRoom();
            
            // Set up game room
            setupGameRoom();
        } catch (error) {
            console.error('Error entering game:', error);
            alert('Failed to enter game. Please try again.');
        }
    };
    
    // Subscribe to game updates
    const subscribeToGame = (gameId) => {
        // Unsubscribe from previous subscription if any
        if (subscription) {
            supabase.removeChannel(subscription);
        }
        
        subscription = supabase
            .channel(`game:${gameId}`)
            .on('postgres_changes', { 
                event: 'UPDATE', 
                schema: 'public', 
                table: 'games',
                filter: `id=eq.${gameId}`
            }, payload => {
                handleGameUpdate(payload.new);
            })
            .subscribe();
    };
    
    // Handle game updates
    const handleGameUpdate = (game) => {
        currentGame = game;
        updateGameUI();
    };
    
    // Show game room
    const showGameRoom = () => {
        ELEMENTS.authContainer.classList.add('hidden');
        ELEMENTS.lobbyContainer.classList.add('hidden');
        ELEMENTS.gameRoomContainer.classList.remove('hidden');
    };
    
    // Set up game room
    const setupGameRoom = () => {
        // Set game name
        ELEMENTS.gameRoomName.textContent = currentGame.name;
        
        // Update UI based on current game state
        updateGameUI();
    };
    
    // Update game UI based on current state
    const updateGameUI = () => {
        // Update players list
        updatePlayersList();
        
        // Update game status
        updateGameStatus();
        
        // Show appropriate screen based on game state
        showGameState();
        
        // Update betting UI if in betting phase
        if (isInBettingPhase()) {
            updateBettingUI();
        }
    };
    
    // Update players list
    const updatePlayersList = () => {
        const playersList = ELEMENTS.playersList;
        playersList.innerHTML = '';
        
        const players = currentGame.players || {};
        
        Object.values(players).forEach(player => {
            const playerEl = document.createElement('div');
            playerEl.classList.add('player-item');
            
            // Add appropriate classes based on player state
            if (player.id === currentPlayer.id) {
                playerEl.classList.add('current-player');
            }
            
            if (player.state === PLAYER_STATES.FOLDED) {
                playerEl.classList.add('folded');
            }
            
            if (player.state === PLAYER_STATES.BANKRUPT) {
                playerEl.classList.add('bankrupt');
            }
            
            playerEl.innerHTML = `
                <div class="player-name">${player.username}</div>
                <div class="player-chips">${player.chips} chips</div>
            `;
            
            playersList.appendChild(playerEl);
        });
    };
    
    // Update game status
    const updateGameStatus = () => {
        const gameStatus = ELEMENTS.gameStatus;
        
        switch (currentGame.state) {
            case GAME_STATES.WAITING:
                gameStatus.textContent = 'Waiting for players...';
                break;
            case GAME_STATES.QUESTION:
                gameStatus.textContent = 'Question Phase';
                break;
            case GAME_STATES.BETTING_ROUND_1:
            case GAME_STATES.BETTING_ROUND_2:
            case GAME_STATES.BETTING_ROUND_3:
                gameStatus.textContent = 'Betting Round';
                break;
            case GAME_STATES.HINT_1:
            case GAME_STATES.HINT_2:
                gameStatus.textContent = 'Hint Revealed';
                break;
            case GAME_STATES.REVEAL:
                gameStatus.textContent = 'Answer Revealed';
                break;
            case GAME_STATES.GAME_OVER:
                gameStatus.textContent = 'Game Over';
                break;
            default:
                gameStatus.textContent = '';
        }
    };
    
    // Show game state based on current game state
    const showGameState = () => {
        // Hide all game states
        ELEMENTS.waitingScreen.classList.add('hidden');
        ELEMENTS.questionPhase.classList.add('hidden');
        ELEMENTS.bettingPhase.classList.add('hidden');
        ELEMENTS.revealPhase.classList.add('hidden');
        ELEMENTS.gameOver.classList.add('hidden');
        
        // Show appropriate state
        switch (currentGame.state) {
            case GAME_STATES.WAITING:
                showWaitingScreen();
                break;
            case GAME_STATES.QUESTION:
                showQuestionPhase();
                break;
            case GAME_STATES.BETTING_ROUND_1:
            case GAME_STATES.BETTING_ROUND_2:
            case GAME_STATES.BETTING_ROUND_3:
            case GAME_STATES.HINT_1:
            case GAME_STATES.HINT_2:
                showBettingPhase();
                break;
            case GAME_STATES.REVEAL:
                showRevealPhase();
                break;
            case GAME_STATES.GAME_OVER:
                showGameOver();
                break;
        }
    };
    
    // Check if game is in a betting phase
    const isInBettingPhase = () => {
        return (
            currentGame.state === GAME_STATES.BETTING_ROUND_1 ||
            currentGame.state === GAME_STATES.HINT_1 ||
            currentGame.state === GAME_STATES.BETTING_ROUND_2 ||
            currentGame.state === GAME_STATES.HINT_2 ||
            currentGame.state === GAME_STATES.BETTING_ROUND_3
        );
    };
    
    // Show waiting screen
    const showWaitingScreen = () => {
        ELEMENTS.waitingScreen.classList.remove('hidden');
        
        const players = currentGame.players || {};
        const playerCount = Object.keys(players).length;
        
        ELEMENTS.currentPlayers.textContent = playerCount;
        ELEMENTS.minRequiredPlayers.textContent = currentGame.min_players;
        
        // Only show start game button to creator if enough players have joined
        if (currentGame.creator_id === currentPlayer.id && playerCount >= currentGame.min_players) {
            ELEMENTS.startGameBtn.classList.remove('hidden');
        } else {
            ELEMENTS.startGameBtn.classList.add('hidden');
        }
    };
    
    // Show question phase
    const showQuestionPhase = () => {
        ELEMENTS.questionPhase.classList.remove('hidden');
        
        const currentQuestionIndex = currentGame.current_question_index;
        const questions = currentGame.questions || [];
        const currentQuestion = questions[currentQuestionIndex];
        
        if (!currentQuestion) return;
        
        // Update question info
        ELEMENTS.currentQuestionNum.textContent = currentQuestionIndex + 1;
        ELEMENTS.totalQuestions.textContent = currentGame.num_questions;
        ELEMENTS.currentQuestion.textContent = currentQuestion.question;
        
        // Update timer
        updateTimer();
        
        // Check if player has already submitted a guess
        const currentQuestionGuesses = currentGame.current_question_guesses || {};
        const playerGuess = currentQuestionGuesses[currentPlayer.id];
        
        if (playerGuess) {
            // Disable guess inputs
            ELEMENTS.lowerBound.disabled = true;
            ELEMENTS.upperBound.disabled = true;
            ELEMENTS.submitGuessBtn.disabled = true;
            
            // Show current guess
            ELEMENTS.lowerBound.value = playerGuess.lower_bound;
            ELEMENTS.upperBound.value = playerGuess.upper_bound;
            
            // Change button text
            ELEMENTS.submitGuessBtn.textContent = 'Guess Submitted';
        } else {
            // Enable guess inputs
            ELEMENTS.lowerBound.disabled = false;
            ELEMENTS.upperBound.disabled = false;
            ELEMENTS.submitGuessBtn.disabled = false;
            
            // Reset inputs
            ELEMENTS.lowerBound.value = '';
            ELEMENTS.upperBound.value = '';
            
            // Reset button text
            ELEMENTS.submitGuessBtn.textContent = 'Submit Guess';
        }
        
        // Show meta-game prediction if enabled
        if (currentGame.enable_meta_game) {
            showMetaGamePrediction();
        } else {
            ELEMENTS.metaGamePrediction.classList.add('hidden');
        }
    };
    
    // Update timer for question phase
    const updateTimer = () => {
        if (currentGame.state !== GAME_STATES.QUESTION) return;
        
        const endTime = new Date(currentGame.question_end_time);
        const now = new Date();
        const timeLeft = Math.max(0, Math.floor((endTime - now) / 1000));
        
        ELEMENTS.timer.textContent = `${timeLeft}s`;
        
        // Update timer every second
        if (timeLeft > 0) {
            setTimeout(updateTimer, 1000);
        }
    };
    
    // Setup event listeners
    const setupEventListeners = () => {
        // Leave game button
        ELEMENTS.leaveGameBtn.addEventListener('click', leaveGame);
        
        // Start game button
        ELEMENTS.startGameBtn.addEventListener('click', startGame);
        
        // Submit guess button
        ELEMENTS.submitGuessBtn.addEventListener('click', submitGuess);
        
        // Submit prediction button
        ELEMENTS.submitPredictionBtn.addEventListener('click', submitPrediction);
        
        // Betting buttons
        ELEMENTS.foldBtn.addEventListener('click', () => makeBettingAction('fold'));
        ELEMENTS.callBtn.addEventListener('click', () => makeBettingAction('call'));
        ELEMENTS.raiseBtn.addEventListener('click', () => {
            const amount = parseInt(ELEMENTS.raiseAmount.value);
            makeBettingAction('raise', amount);
        });
        
        // Sync raise slider and raise amount input
        ELEMENTS.raiseSlider.addEventListener('input', () => {
            ELEMENTS.raiseAmount.value = ELEMENTS.raiseSlider.value;
        });
        
        ELEMENTS.raiseAmount.addEventListener('input', () => {
            ELEMENTS.raiseSlider.value = ELEMENTS.raiseAmount.value;
        });
        
        // Next question button
        ELEMENTS.nextQuestionBtn.addEventListener('click', nextQuestion);
        
        // Return to lobby button
        ELEMENTS.returnToLobbyBtn.addEventListener('click', returnToLobby);
        
        // Play again button
        ELEMENTS.playAgainBtn.addEventListener('click', playAgain);
    };
    
    // Submit guess
    const submitGuess = async () => {
        try {
            const lowerBound = parseFloat(ELEMENTS.lowerBound.value);
            const upperBound = parseFloat(ELEMENTS.upperBound.value);
            
            // Validate guess
            if (isNaN(lowerBound) || isNaN(upperBound)) {
                alert('Please enter valid numbers for your guess');
                return;
            }
            
            if (lowerBound >= upperBound) {
                alert('Lower bound must be less than upper bound');
                return;
            }
            
            // Update game with player's guess
            const currentQuestionGuesses = currentGame.current_question_guesses || {};
            
            currentQuestionGuesses[currentPlayer.id] = {
                lower_bound: lowerBound,
                upper_bound: upperBound
            };
            
            const { error } = await supabase
                .from('games')
                .update({
                    current_question_guesses: currentQuestionGuesses
                })
                .eq('id', currentGame.id);
                
            if (error) throw error;
            
            // Disable guess inputs
            ELEMENTS.lowerBound.disabled = true;
            ELEMENTS.upperBound.disabled = true;
            ELEMENTS.submitGuessBtn.disabled = true;
            ELEMENTS.submitGuessBtn.textContent = 'Guess Submitted';
        } catch (error) {
            console.error('Error submitting guess:', error);
            alert('Failed to submit guess. Please try again.');
        }
    };
    
    // Submit meta-game prediction
    const submitPrediction = async () => {
        try {
            const predictedWinnerId = ELEMENTS.winnerPrediction.value;
            
            if (!predictedWinnerId) {
                alert('Please select a player for your prediction');
                return;
            }
            
            // Update game with player's prediction
            const currentPredictions = currentGame.current_question_predictions || {};
            
            currentPredictions[currentPlayer.id] = {
                predicted_winner_id: predictedWinnerId
            };
            
            const { error } = await supabase
                .from('games')
                .update({
                    current_question_predictions: currentPredictions
                })
                .eq('id', currentGame.id);
                
            if (error) throw error;
            
            // Disable prediction inputs
            ELEMENTS.winnerPrediction.disabled = true;
            ELEMENTS.submitPredictionBtn.disabled = true;
            ELEMENTS.submitPredictionBtn.textContent = 'Prediction Submitted';
        } catch (error) {
            console.error('Error submitting prediction:', error);
            alert('Failed to submit prediction. Please try again.');
        }
    };
    
    // Make betting action (fold, call, raise)
    const makeBettingAction = async (action, amount = 0) => {
        // Implementation will be added in game_actions.js
        console.log(`Making ${action} action with amount ${amount}`);
    };
    
    // Leave game
    const leaveGame = () => {
        // Unsubscribe from game updates
        if (subscription) {
            supabase.removeChannel(subscription);
            subscription = null;
        }
        
        // Reset state
        currentGame = null;
        
        // Return to lobby
        ELEMENTS.gameRoomContainer.classList.add('hidden');
        ELEMENTS.lobbyContainer.classList.remove('hidden');
    };
    
    // Start game
    const startGame = async () => {
        // Implementation will be added in game_actions.js
        console.log('Starting game');
    };
    
    // Next question
    const nextQuestion = async () => {
        // Implementation will be added in game_actions.js
        console.log('Moving to next question');
    };
    
    // Return to lobby
    const returnToLobby = () => {
        leaveGame();
    };
    
    // Play again
    const playAgain = async () => {
        // Implementation will be added in game_actions.js
        console.log('Playing again');
    };
    
    // Show meta-game prediction
    const showMetaGamePrediction = () => {
        // Implementation will be added in meta_game.js
        console.log('Showing meta-game prediction');
    };
    
    // Show betting phase
    const showBettingPhase = () => {
        // Implementation will be added in betting.js
        console.log('Showing betting phase');
    };
    
    // Update betting UI
    const updateBettingUI = () => {
        // Implementation will be added in betting.js
        console.log('Updating betting UI');
    };
    
    // Show reveal phase
    const showRevealPhase = () => {
        // Implementation will be added in reveal.js
        console.log('Showing reveal phase');
    };
    
    // Show game over
    const showGameOver = () => {
        // Implementation will be added in game_over.js
        console.log('Showing game over');
    };
    
    // Return public methods
    return {
        init,
        enterGame,
        leaveGame
    };
})();
