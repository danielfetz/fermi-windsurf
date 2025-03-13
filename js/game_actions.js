/**
 * Game actions module for handling specific game actions
 */
const GameActions = (function() {
    // Start the game
    const startGame = async () => {
        try {
            const currentGame = Game.getCurrentGame();
            const currentPlayer = Auth.getCurrentUser();
            
            if (!currentGame || !currentPlayer) return;
            
            if (currentGame.creator_id !== currentPlayer.id) {
                alert('Only the game creator can start the game');
                return;
            }
            
            const players = currentGame.players || {};
            const playerCount = Object.keys(players).length;
            
            if (playerCount < currentGame.min_players) {
                alert(`Need at least ${currentGame.min_players} players to start`);
                return;
            }
            
            // Set up first question
            const question_end_time = new Date();
            question_end_time.setSeconds(question_end_time.getSeconds() + currentGame.guess_time);
            
            // Update game state
            const { error } = await supabase
                .from('games')
                .update({
                    status: 'in_progress',
                    state: GAME_STATES.QUESTION,
                    current_question_index: 0,
                    question_end_time: question_end_time.toISOString(),
                    current_question_guesses: {},
                    current_question_predictions: {},
                    current_question_bets: {},
                    current_question_pot: 0,
                    current_bet: 0
                })
                .eq('id', currentGame.id);
                
            if (error) throw error;
            
            // Set up timer to move to betting phase after guess time expires
            setTimeout(async () => {
                try {
                    // Check if game state is still in question phase
                    const { data: game, error: fetchError } = await supabase
                        .from('games')
                        .select('*')
                        .eq('id', currentGame.id)
                        .single();
                        
                    if (fetchError) throw fetchError;
                    
                    if (game.state === GAME_STATES.QUESTION) {
                        // Move to first betting round
                        await startBettingRound(game);
                    }
                } catch (error) {
                    console.error('Error starting betting round:', error);
                }
            }, currentGame.guess_time * 1000);
        } catch (error) {
            console.error('Error starting game:', error);
            alert('Failed to start game. Please try again.');
        }
    };
    
    // Start betting round
    const startBettingRound = async (game) => {
        try {
            // Determine next betting round based on current state
            let nextState;
            
            switch (game.state) {
                case GAME_STATES.QUESTION:
                    nextState = GAME_STATES.BETTING_ROUND_1;
                    break;
                case GAME_STATES.HINT_1:
                    nextState = GAME_STATES.BETTING_ROUND_2;
                    break;
                case GAME_STATES.HINT_2:
                    nextState = GAME_STATES.BETTING_ROUND_3;
                    break;
                default:
                    return;
            }
            
            // Determine first player to bet
            const players = game.players || {};
            const activePlayers = Object.entries(players)
                .filter(([_, player]) => {
                    const foldedQuestions = player.folded_questions || [];
                    return player.state === PLAYER_STATES.ACTIVE && 
                           !foldedQuestions.includes(game.current_question_index);
                })
                .map(([id, _]) => id);
            
            if (activePlayers.length === 0) {
                // No active players, move to reveal
                await revealAnswer(game);
                return;
            }
            
            // Set next player to bet (randomly for first betting round)
            const firstBettingPlayer = activePlayers[Math.floor(Math.random() * activePlayers.length)];
            
            // Update game state
            const { error } = await supabase
                .from('games')
                .update({
                    state: nextState,
                    current_betting_player_id: firstBettingPlayer,
                    current_bet: 0
                })
                .eq('id', game.id);
                
            if (error) throw error;
        } catch (error) {
            console.error('Error starting betting round:', error);
        }
    };
    
    // Make betting action (fold, call, raise)
    const makeBettingAction = async (action, amount = 0) => {
        try {
            const currentGame = Game.getCurrentGame();
            const currentPlayer = Auth.getCurrentUser();
            
            if (!currentGame || !currentPlayer) return;
            
            if (currentGame.current_betting_player_id !== currentPlayer.id) {
                alert("It's not your turn to bet");
                return;
            }
            
            const players = currentGame.players || {};
            const player = players[currentPlayer.id];
            
            if (!player) return;
            
            // Update player and game state based on action
            const foldedQuestions = player.folded_questions || [];
            const currentQuestionBets = currentGame.current_question_bets || {};
            const playerBet = currentQuestionBets[currentPlayer.id] || 0;
            const currentBet = currentGame.current_bet || 0;
            
            // Determine next player to bet
            const activePlayers = Object.entries(players)
                .filter(([id, p]) => {
                    const pFoldedQuestions = p.folded_questions || [];
                    return p.state === PLAYER_STATES.ACTIVE && 
                           !pFoldedQuestions.includes(currentGame.current_question_index) &&
                           id !== currentPlayer.id;
                })
                .map(([id, _]) => id);
            
            // If no other active players, move to next phase
            if (activePlayers.length === 0) {
                if (action === 'fold') {
                    // If player folds and no other active players, move to reveal
                    await handleFold(currentGame, player, foldedQuestions);
                    await revealAnswer(currentGame);
                    return;
                } else {
                    // Move to reveal or hint based on current state
                    await handleCallOrRaise(currentGame, player, currentQuestionBets, playerBet, currentBet, action, amount);
                    
                    if (currentGame.state === GAME_STATES.BETTING_ROUND_1) {
                        await revealHint(currentGame, 1);
                    } else if (currentGame.state === GAME_STATES.BETTING_ROUND_2) {
                        await revealHint(currentGame, 2);
                    } else {
                        await revealAnswer(currentGame);
                    }
                    return;
                }
            }
            
            // There are other active players
            let nextPlayerId = activePlayers[0];
            
            // Handle action
            if (action === 'fold') {
                await handleFold(currentGame, player, foldedQuestions);
            } else {
                await handleCallOrRaise(currentGame, player, currentQuestionBets, playerBet, currentBet, action, amount);
            }
            
            // Check if betting round is complete (all active players have matched the bet)
            const isRoundComplete = checkBettingRoundComplete(currentGame);
            
            if (isRoundComplete) {
                // Move to next phase based on current state
                if (currentGame.state === GAME_STATES.BETTING_ROUND_1) {
                    await revealHint(currentGame, 1);
                } else if (currentGame.state === GAME_STATES.BETTING_ROUND_2) {
                    await revealHint(currentGame, 2);
                } else {
                    await revealAnswer(currentGame);
                }
            } else {
                // Update next player
                const { error } = await supabase
                    .from('games')
                    .update({
                        current_betting_player_id: nextPlayerId
                    })
                    .eq('id', currentGame.id);
                    
                if (error) throw error;
            }
        } catch (error) {
            console.error('Error making betting action:', error);
            alert('Failed to make betting action. Please try again.');
        }
    };
    
    // Handle fold action
    const handleFold = async (game, player, foldedQuestions) => {
        try {
            // Add current question to folded questions
            foldedQuestions.push(game.current_question_index);
            
            // Update player
            const updatedPlayers = {...game.players};
            updatedPlayers[player.id] = {
                ...player,
                folded_questions: foldedQuestions
            };
            
            // Update game
            const { error } = await supabase
                .from('games')
                .update({
                    players: updatedPlayers
                })
                .eq('id', game.id);
                
            if (error) throw error;
        } catch (error) {
            console.error('Error handling fold:', error);
            throw error;
        }
    };
    
    // Handle call or raise action
    const handleCallOrRaise = async (game, player, currentQuestionBets, playerBet, currentBet, action, amount) => {
        try {
            let betAmount = 0;
            
            if (action === 'call') {
                betAmount = currentBet - playerBet;
            } else if (action === 'raise') {
                betAmount = amount - playerBet;
            }
            
            // Check if player has enough chips
            if (betAmount > player.chips) {
                alert('Not enough chips!');
                return;
            }
            
            // Update player's bet
            currentQuestionBets[player.id] = action === 'raise' ? amount : currentBet;
            
            // Update player's chips
            const updatedChips = player.chips - betAmount;
            
            // Update pot
            const currentPot = game.current_question_pot || 0;
            const updatedPot = currentPot + betAmount;
            
            // Update player
            const updatedPlayers = {...game.players};
            updatedPlayers[player.id] = {
                ...player,
                chips: updatedChips
            };
            
            // Update game state
            const updates = {
                players: updatedPlayers,
                current_question_bets: currentQuestionBets,
                current_question_pot: updatedPot
            };
            
            // If raise, update current bet
            if (action === 'raise') {
                updates.current_bet = amount;
            }
            
            // Update game
            const { error } = await supabase
                .from('games')
                .update(updates)
                .eq('id', game.id);
                
            if (error) throw error;
        } catch (error) {
            console.error('Error handling call/raise:', error);
            throw error;
        }
    };
    
    // Check if betting round is complete
    const checkBettingRoundComplete = (game) => {
        const players = game.players || {};
        const currentBet = game.current_bet || 0;
        const currentQuestionBets = game.current_question_bets || {};
        
        // Get active players who haven't folded for this question
        const activePlayers = Object.entries(players)
            .filter(([_, player]) => {
                const foldedQuestions = player.folded_questions || [];
                return player.state === PLAYER_STATES.ACTIVE && 
                       !foldedQuestions.includes(game.current_question_index);
            })
            .map(([id, _]) => id);
        
        // Check if all active players have matched the current bet
        for (const playerId of activePlayers) {
            const playerBet = currentQuestionBets[playerId] || 0;
            if (playerBet < currentBet) {
                return false;
            }
        }
        
        return true;
    };
    
    // Reveal hint
    const revealHint = async (game, hintNumber) => {
        try {
            const nextState = hintNumber === 1 ? GAME_STATES.HINT_1 : GAME_STATES.HINT_2;
            
            // Update game state
            const { error } = await supabase
                .from('games')
                .update({
                    state: nextState
                })
                .eq('id', game.id);
                
            if (error) throw error;
            
            // After a short delay, start next betting round
            setTimeout(async () => {
                try {
                    // Check if game state is still in hint phase
                    const { data: updatedGame, error: fetchError } = await supabase
                        .from('games')
                        .select('*')
                        .eq('id', game.id)
                        .single();
                        
                    if (fetchError) throw fetchError;
                    
                    if (updatedGame.state === GAME_STATES.HINT_1 || updatedGame.state === GAME_STATES.HINT_2) {
                        // Move to next betting round
                        await startBettingRound(updatedGame);
                    }
                } catch (error) {
                    console.error('Error starting next betting round:', error);
                }
            }, 5000); // 5 second delay to allow players to read the hint
        } catch (error) {
            console.error(`Error revealing hint ${hintNumber}:`, error);
        }
    };
    
    // Reveal answer
    const revealAnswer = async (game) => {
        try {
            const currentQuestionIndex = game.current_question_index;
            const questions = game.questions || [];
            const currentQuestion = questions[currentQuestionIndex];
            
            if (!currentQuestion) return;
            
            const correctAnswer = currentQuestion.answer;
            const currentQuestionGuesses = game.current_question_guesses || {};
            const players = game.players || {};
            const currentPot = game.current_question_pot || 0;
            
            // Determine winner
            const winner = determineWinner(currentQuestionGuesses, correctAnswer, players);
            
            // Check meta-game predictions
            await checkMetaGamePredictions(game, winner?.id);
            
            // Update player chips if there's a winner
            if (winner) {
                const updatedPlayers = {...players};
                const winningPlayer = updatedPlayers[winner.id];
                winningPlayer.chips += currentPot;
                
                // Update game with winner and updated players
                const { error } = await supabase
                    .from('games')
                    .update({
                        state: GAME_STATES.REVEAL,
                        players: updatedPlayers,
                        current_question_results: {
                            winner_id: winner.id,
                            correct_answer: correctAnswer
                        }
                    })
                    .eq('id', game.id);
                    
                if (error) throw error;
            } else {
                // No winner, just update game state
                const { error } = await supabase
                    .from('games')
                    .update({
                        state: GAME_STATES.REVEAL,
                        current_question_results: {
                            winner_id: null,
                            correct_answer: correctAnswer
                        }
                    })
                    .eq('id', game.id);
                    
                if (error) throw error;
            }
        } catch (error) {
            console.error('Error revealing answer:', error);
        }
    };
    
    // Determine winner
    const determineWinner = (guesses, correctAnswer, players) => {
        // Filter out bankrupt players
        const activePlayers = Object.values(players).filter(p => p.state !== PLAYER_STATES.BANKRUPT);
        
        // Players whose range includes the correct answer
        const inRangePlayers = activePlayers.filter(player => {
            const guess = guesses[player.id];
            return guess && 
                   guess.lower_bound <= correctAnswer && 
                   guess.upper_bound >= correctAnswer;
        });
        
        if (inRangePlayers.length > 0) {
            // Find player with narrowest range
            return inRangePlayers.reduce((narrowest, player) => {
                const narrowestGuess = guesses[narrowest.id];
                const playerGuess = guesses[player.id];
                
                const narrowestRange = narrowestGuess.upper_bound - narrowestGuess.lower_bound;
                const playerRange = playerGuess.upper_bound - playerGuess.lower_bound;
                
                return playerRange < narrowestRange ? player : narrowest;
            }, inRangePlayers[0]);
        } else {
            // No player's range includes the answer
            // Find player whose range median is closest to the correct answer
            return activePlayers.reduce((closest, player) => {
                const guess = guesses[player.id];
                if (!guess) return closest;
                
                const closestGuess = guesses[closest?.id];
                if (!closestGuess) return player;
                
                const playerMedian = (guess.lower_bound + guess.upper_bound) / 2;
                const closestMedian = (closestGuess.lower_bound + closestGuess.upper_bound) / 2;
                
                const playerDistance = Math.abs(playerMedian - correctAnswer);
                const closestDistance = Math.abs(closestMedian - correctAnswer);
                
                return playerDistance < closestDistance ? player : closest;
            }, null);
        }
    };
    
    // Check meta-game predictions
    const checkMetaGamePredictions = async (game, winnerId) => {
        if (!game.enable_meta_game || !winnerId) return;
        
        try {
            const currentPredictions = game.current_question_predictions || {};
            const players = {...game.players};
            let updated = false;
            
            // Check each player's prediction
            Object.entries(currentPredictions).forEach(([playerId, prediction]) => {
                if (prediction.predicted_winner_id === winnerId) {
                    // Correct prediction
                    const player = players[playerId];
                    if (player) {
                        player.correct_predictions = (player.correct_predictions || 0) + 1;
                        updated = true;
                        
                        // Check if bankrupt player can rejoin
                        if (player.state === PLAYER_STATES.BANKRUPT && 
                            player.correct_predictions >= DEFAULT_GAME_CONFIG.minRejoinPredictions) {
                            player.state = PLAYER_STATES.ACTIVE;
                            player.chips = DEFAULT_GAME_CONFIG.minRejoinChips;
                            player.correct_predictions = 0;
                        }
                    }
                }
            });
            
            if (updated) {
                // Update game with updated players
                const { error } = await supabase
                    .from('games')
                    .update({
                        players: players
                    })
                    .eq('id', game.id);
                    
                if (error) throw error;
            }
        } catch (error) {
            console.error('Error checking meta-game predictions:', error);
        }
    };
    
    // Move to next question
    const nextQuestion = async () => {
        try {
            const currentGame = Game.getCurrentGame();
            const currentPlayer = Auth.getCurrentUser();
            
            if (!currentGame || !currentPlayer) return;
            
            if (currentGame.creator_id !== currentPlayer.id) {
                alert('Only the game creator can move to the next question');
                return;
            }
            
            const currentQuestionIndex = currentGame.current_question_index;
            
            // Check if this was the last question
            if (currentQuestionIndex >= currentGame.num_questions - 1) {
                // End the game
                const { error } = await supabase
                    .from('games')
                    .update({
                        state: GAME_STATES.GAME_OVER,
                        status: 'completed'
                    })
                    .eq('id', currentGame.id);
                    
                if (error) throw error;
                
                return;
            }
            
            // Check for bankrupt players
            const players = {...currentGame.players};
            let updated = false;
            
            Object.entries(players).forEach(([playerId, player]) => {
                if (player.chips <= 0 && player.state === PLAYER_STATES.ACTIVE) {
                    player.state = PLAYER_STATES.BANKRUPT;
                    updated = true;
                }
                
                // Reset folded questions for next question
                const foldedQuestions = player.folded_questions || [];
                if (foldedQuestions.length > 0) {
                    player.folded_questions = [];
                    updated = true;
                }
            });
            
            // Set up next question
            const nextQuestionIndex = currentQuestionIndex + 1;
            const question_end_time = new Date();
            question_end_time.setSeconds(question_end_time.getSeconds() + currentGame.guess_time);
            
            // Update game state
            const { error } = await supabase
                .from('games')
                .update({
                    state: GAME_STATES.QUESTION,
                    current_question_index: nextQuestionIndex,
                    question_end_time: question_end_time.toISOString(),
                    current_question_guesses: {},
                    current_question_predictions: {},
                    current_question_bets: {},
                    current_question_pot: 0,
                    current_bet: 0,
                    players: updated ? players : undefined
                })
                .eq('id', currentGame.id);
                
            if (error) throw error;
            
            // Set up timer to move to betting phase after guess time expires
            setTimeout(async () => {
                try {
                    // Check if game state is still in question phase
                    const { data: game, error: fetchError } = await supabase
                        .from('games')
                        .select('*')
                        .eq('id', currentGame.id)
                        .single();
                        
                    if (fetchError) throw fetchError;
                    
                    if (game.state === GAME_STATES.QUESTION) {
                        // Move to first betting round
                        await startBettingRound(game);
                    }
                } catch (error) {
                    console.error('Error starting betting round:', error);
                }
            }, currentGame.guess_time * 1000);
        } catch (error) {
            console.error('Error moving to next question:', error);
            alert('Failed to move to next question. Please try again.');
        }
    };
    
    // Play again (reset game)
    const playAgain = async () => {
        try {
            const currentGame = Game.getCurrentGame();
            const currentPlayer = Auth.getCurrentUser();
            
            if (!currentGame || !currentPlayer) return;
            
            if (currentGame.creator_id !== currentPlayer.id) {
                alert('Only the game creator can restart the game');
                return;
            }
            
            // Reset player states
            const players = {...currentGame.players};
            
            Object.values(players).forEach(player => {
                player.chips = currentGame.starting_chips;
                player.state = PLAYER_STATES.ACTIVE;
                player.folded_questions = [];
                player.correct_predictions = 0;
            });
            
            // Fetch new questions
            const questions = await Lobby.fetchRandomQuestions(currentGame.num_questions);
            
            // Reset game state
            const { error } = await supabase
                .from('games')
                .update({
                    status: 'waiting',
                    state: GAME_STATES.WAITING,
                    current_question_index: 0,
                    players,
                    questions
                })
                .eq('id', currentGame.id);
                
            if (error) throw error;
        } catch (error) {
            console.error('Error restarting game:', error);
            alert('Failed to restart game. Please try again.');
        }
    };
    
    // Return public methods
    return {
        startGame,
        makeBettingAction,
        nextQuestion,
        playAgain
    };
})();
