/**
 * Player actions module for handling player interactions
 */
const PlayerActions = (function() {
    // Submit guess for current question
    const submitGuess = async (lowerBound, upperBound) => {
        try {
            const currentGame = Game.getCurrentGame();
            const currentPlayer = Auth.getCurrentUser();
            
            if (!currentGame || !currentPlayer) return;
            
            // Validate guess
            if (lowerBound >= upperBound) {
                alert('Lower bound must be less than upper bound');
                return;
            }
            
            if (lowerBound < 0 || upperBound < 0) {
                alert('Bounds must be positive numbers');
                return;
            }
            
            // Check if player has already submitted a guess
            const currentQuestionGuesses = currentGame.current_question_guesses || {};
            if (currentQuestionGuesses[currentPlayer.id]) {
                alert('You have already submitted a guess for this question');
                return;
            }
            
            // Check if current state is question
            if (currentGame.state !== GAME_STATES.QUESTION) {
                alert('Guessing phase has ended');
                return;
            }
            
            // Submit guess
            const newGuesses = {
                ...currentQuestionGuesses,
                [currentPlayer.id]: {
                    lower_bound: lowerBound,
                    upper_bound: upperBound
                }
            };
            
            // Update game
            const { error } = await supabase
                .from('games')
                .update({
                    current_question_guesses: newGuesses
                })
                .eq('id', currentGame.id);
                
            if (error) throw error;
            
            // After submitting guess, show meta-game prediction if enabled
            if (currentGame.enable_meta_game) {
                setTimeout(() => {
                    Game.showMetaGamePrediction();
                }, 500);
            }
            
            // Update UI
            ELEMENTS.guessForm.reset();
            ELEMENTS.guessForm.classList.add('hidden');
            ELEMENTS.guessSubmitted.classList.remove('hidden');
            ELEMENTS.guessSubmittedText.textContent = `Your guess: ${lowerBound} - ${upperBound}`;
        } catch (error) {
            console.error('Error submitting guess:', error);
            alert('Failed to submit guess. Please try again.');
        }
    };
    
    // Submit meta-game prediction
    const submitPrediction = async (predictedWinnerId) => {
        try {
            const currentGame = Game.getCurrentGame();
            const currentPlayer = Auth.getCurrentUser();
            
            if (!currentGame || !currentPlayer) return;
            
            // Validate prediction
            if (!predictedWinnerId) {
                alert('Please select a player');
                return;
            }
            
            // Check if player has already submitted a prediction
            const currentPredictions = currentGame.current_question_predictions || {};
            if (currentPredictions[currentPlayer.id]) {
                alert('You have already submitted a prediction for this question');
                return;
            }
            
            // Submit prediction
            const newPredictions = {
                ...currentPredictions,
                [currentPlayer.id]: {
                    predicted_winner_id: predictedWinnerId
                }
            };
            
            // Update game
            const { error } = await supabase
                .from('games')
                .update({
                    current_question_predictions: newPredictions
                })
                .eq('id', currentGame.id);
                
            if (error) throw error;
            
            // Update UI
            ELEMENTS.winnerPrediction.disabled = true;
            ELEMENTS.submitPredictionBtn.disabled = true;
            ELEMENTS.submitPredictionBtn.textContent = 'Prediction Submitted';
        } catch (error) {
            console.error('Error submitting prediction:', error);
            alert('Failed to submit prediction. Please try again.');
        }
    };
    
    // Set up event listeners
    const setupEventListeners = () => {
        // Guess form submission
        ELEMENTS.guessForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const lowerBound = parseInt(ELEMENTS.lowerBound.value);
            const upperBound = parseInt(ELEMENTS.upperBound.value);
            submitGuess(lowerBound, upperBound);
        });
        
        // Prediction form submission
        ELEMENTS.submitPredictionBtn.addEventListener('click', () => {
            const predictedWinnerId = ELEMENTS.winnerPrediction.value;
            submitPrediction(predictedWinnerId);
        });
        
        // Betting actions
        ELEMENTS.foldBtn.addEventListener('click', () => {
            Game.makeBettingAction('fold');
        });
        
        ELEMENTS.callBtn.addEventListener('click', () => {
            Game.makeBettingAction('call');
        });
        
        ELEMENTS.raiseBtn.addEventListener('click', () => {
            const amount = parseInt(ELEMENTS.raiseAmount.value);
            Game.makeBettingAction('raise', amount);
        });
        
        // Raise slider
        ELEMENTS.raiseSlider.addEventListener('input', (e) => {
            ELEMENTS.raiseAmount.value = e.target.value;
        });
        
        // Raise amount input
        ELEMENTS.raiseAmount.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            const min = parseInt(e.target.min);
            const max = parseInt(e.target.max);
            
            if (!isNaN(value)) {
                if (value < min) {
                    e.target.value = min;
                } else if (value > max) {
                    e.target.value = max;
                }
                ELEMENTS.raiseSlider.value = e.target.value;
            }
        });
        
        // Next question button
        ELEMENTS.nextQuestionBtn.addEventListener('click', () => {
            Game.nextQuestion();
        });
        
        // Play again button
        ELEMENTS.playAgainBtn.addEventListener('click', () => {
            Game.playAgain();
        });
    };
    
    // Initialize module
    const init = () => {
        // Set up event listeners
        setupEventListeners();
    };
    
    // Return public methods
    return {
        init,
        submitGuess,
        submitPrediction
    };
})();
