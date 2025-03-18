document.addEventListener('DOMContentLoaded', function() {
    // Login Elements
    const loginScreen = document.getElementById('login-screen');
    const usernameInput = document.getElementById('username-input');
    const playButton = document.getElementById('play-button');
    const gameContainer = document.getElementById('game-container');
    const playerNameSpan = document.getElementById('player-name');
    
    // Game Elements
    const playArea = document.getElementById('play-area');
    const scoreDisplay = document.getElementById('score-display');
    const gameOverScreen = document.getElementById('game-over');
    const finalScoreDisplay = document.getElementById('final-score');
    const restartButton = document.getElementById('restart-button');
    const soundToggle = document.getElementById('sound-toggle');
    const bucketContainer = document.querySelector('.bucket-container');
    const timerDisplay = document.getElementById('timer-display');
    
    // Game state variables
    let score = 0;
    let gameOver = false;
    let draggingBlock = null;
    let offsetX = 0;
    let offsetY = 0;
    let blocks = [];
    let buckets = [];
    let animations = [];
    let updateInterval;
    let timerInterval;
    let soundEnabled = true;
    let username = '';
    let playerUniqueId = '';
    let timeRemaining = 60; // 60 seconds = 1 minute
    
    // Detect touch device
    const isTouchDevice = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    console.log('Touch device detected:', isTouchDevice);
    
    // Bucket types in order
    const REGULAR_BLOCK_TYPES = ["monky1", "monky2", "peacock1", "squirrel3"];
    const BUCKET_IMAGES = {
        "monky1": "monkey.png",
        "monky2": "monkey2.png",
        "peacock1": "pea.png",
        "squirrel3": "sq.png"
    };
    
    // Sound effects
    const sounds = {
        bucketMatch: new Audio('/static/sounds/bucketadding.mp3'),
        specialAppear: new Audio('/static/sounds/appearing.wav'),
        specialClick: new Audio('/static/sounds/shooting.mp3'),
        specialDefeat: new Audio('/static/sounds/gameover.wav'),
        timerTick: new Audio('/static/sounds/tick.mp3')
    };
    
    // Set volume for all sounds
    Object.values(sounds).forEach(sound => {
        sound.volume = 0.7;
    });
    
    // Set lower volume for timer tick
    if (sounds.timerTick) {
        sounds.timerTick.volume = 0.3;
    }
    
    // Login Functionality
    usernameInput.addEventListener('input', function() {
        // Enable the play button only if username is not empty
        playButton.disabled = !usernameInput.value.trim();
    });
    
    playButton.addEventListener('click', startGame);
    
    // Add touch event for play button
    if (isTouchDevice) {
        playButton.addEventListener('touchstart', function(e) {
            e.preventDefault();
            if (!playButton.disabled) {
                startGame();
            }
        }, { passive: false });
    }
    
    // Start the game after login
    function startGame() {
        console.log("Start Game button clicked");
        // Get username
        username = usernameInput.value.trim();
        if (!username) {
            console.error("Username is empty");
            return;
        }
        
        // Generate unique ID
        playerUniqueId = generateUniqueId();
        console.log("Generated player ID:", playerUniqueId);
        
        // Send player info to server
        registerPlayer(username, playerUniqueId);
        
        // Set player name in game UI
        playerNameSpan.textContent = username;
        
        // Reset timer
        timeRemaining = 60; // 1 minute
        updateTimerDisplay();
        
        // Hide login screen and show game
        loginScreen.style.display = 'none';
        gameContainer.style.display = 'block';
        
        // Initialize the game
        initGame();
        
        // Start the timer
        startTimer();
    }
    
    // Timer functionality
    function startTimer() {
        // Clear any existing timer
        if (timerInterval) {
            clearInterval(timerInterval);
        }
        
        // Update timer every second
        timerInterval = setInterval(function() {
            timeRemaining--;
            updateTimerDisplay();
            
            // Play tick sound when 10 seconds or less remain
            if (timeRemaining <= 10 && sounds.timerTick && soundEnabled) {
                sounds.timerTick.currentTime = 0;
                sounds.timerTick.play().catch(e => console.log("Error playing timer tick"));
            }
            
            // End game when time runs out
            if (timeRemaining <= 0) {
                clearInterval(timerInterval);
                endGame(true); // true indicates timer ended the game
            }
        }, 1000);
    }
    
    // Update timer display
    function updateTimerDisplay() {
        const minutes = Math.floor(timeRemaining / 60);
        const seconds = timeRemaining % 60;
        timerDisplay.textContent = `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
        
        // Change color based on time remaining
        if (timeRemaining <= 10) {
            timerDisplay.classList.add('timer-warning');
        } else {
            timerDisplay.classList.remove('timer-warning');
        }
    }
    
    // Generate a unique ID
    function generateUniqueId() {
        return 'player-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
    
    // Register player with server
    function registerPlayer(username, uniqueId) {
        console.log("Registering player:", username, uniqueId);
        
        fetch('/api/register-player', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                uniqueId: uniqueId
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log('Player registered successfully:', data);
        })
        .catch(error => {
            console.error('Error registering player:', error);
            // Continue with the game even if registration fails
            console.log("Continuing game despite registration error");
        });
    }
    
    // Sound toggle function
    function toggleSound() {
        soundEnabled = !soundEnabled;
        soundToggle.textContent = soundEnabled ? '🔊' : '🔇';
    }
    
    // Play sound with check
    function playSound(soundName) {
        if (!soundEnabled) return;
        
        if (sounds[soundName]) {
            // Clone the sound to allow overlapping
            const sound = sounds[soundName].cloneNode();
            sound.volume = sounds[soundName].volume; // Keep the original volume setting
            sound.play().catch(error => {
                console.warn('Audio playback was prevented:', error);
            });
        }
    }
    
    // Add sound toggle event listener
    soundToggle.addEventListener('click', toggleSound);
    
    // Get play area dimensions
    function getPlayAreaDimensions() {
        const rect = playArea.getBoundingClientRect();
        return {
            left: rect.left,
            top: rect.top,
            right: rect.right,
            bottom: rect.bottom,
            width: rect.width,
            height: rect.height
        };
    }
    
    // Initialize the game
    function initGame() {
        console.log("Initializing game...");
        
        // Reset game state on server
        fetch('/api/reset-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                uniqueId: playerUniqueId
            })
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with status: ${response.status}`);
            }
            return response.json();
        })
        .then(gameState => {
            console.log("Game state reset successful", gameState);
            
            // Clear any existing blocks
            document.querySelectorAll('.falling-block').forEach(el => el.remove());
            blocks = [];
            animations = [];
            score = 0;
            gameOver = false;
            updateScore(0);
            
            // Initialize buckets directly
            initBuckets();
            
            // Start game loop
            if (updateInterval) {
                clearInterval(updateInterval);
            }
            updateInterval = setInterval(updateGame, 1000 / 60); // 60 FPS
            
            // Hide game over screen
            gameOverScreen.style.display = 'none';
        })
        .catch(error => {
            console.error('Error resetting game:', error);
            // Try to continue anyway by initializing buckets
            initBuckets();
            
            // Start game loop anyway
            if (updateInterval) {
                clearInterval(updateInterval);
            }
            updateInterval = setInterval(updateGame, 1000 / 60); // 60 FPS
        });
    }
    
    // Initialize buckets - directly set images without server call
    function initBuckets() {
        console.log("Initializing buckets...");
        const bucketElements = document.querySelectorAll('.bucket');
        
        bucketElements.forEach((element, index) => {
            const bucketType = REGULAR_BLOCK_TYPES[index];
            const imagePath = BUCKET_IMAGES[bucketType];
            
            element.style.backgroundImage = `url('/static/images/${imagePath}')`;
            
            // Create bucket data structure for collision detection
            buckets[index] = {
                id: element.id,
                type: bucketType,
                element: element,
                rect: element.getBoundingClientRect()
            };
        });
        
        // Notify server about buckets for consistency
        fetch('/api/init-buckets', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                playArea: getPlayAreaDimensions(),
                username: username,
                uniqueId: playerUniqueId
            })
        })
        .then(response => response.json())
        .then(data => {
            console.log("Buckets initialized on server:", data);
        })
        .catch(error => {
            console.error('Error initializing buckets on server:', error);
            // Continue game anyway
        });
    }
    
    // Animate bucket for match or mismatch
    function animateBucket(bucketId, isMatch) {
        const bucketElement = document.getElementById(bucketId);
        if (!bucketElement) return;
        
        if (isMatch) {
            // Scale animation for match
            bucketElement.style.transform = 'scale(1.3)';
            setTimeout(() => {
                bucketElement.style.transform = 'scale(1)';
            }, 300);
        } else {
            // Shake animation for mismatch
            bucketElement.classList.add('shake');
            setTimeout(() => {
                bucketElement.classList.remove('shake');
            }, 500);
        }
    }
    
    // Spawn a new block
    function spawnBlock(special = false) {
        fetch('/api/spawn-block', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                special,
                username: username,
                uniqueId: playerUniqueId
            })
        })
        .then(response => response.json())
        .then(block => {
            blocks.push(block);
            renderBlock(block);
            
            if (special) {
                playSound('specialAppear');
            }
        })
        .catch(error => console.error('Error spawning block:', error));
    }
    
    // Render a block
    function renderBlock(block) {
        // Check if block element already exists
        let blockElement = document.getElementById(block.id);
        
        if (!blockElement) {
            blockElement = document.createElement('div');
            blockElement.id = block.id;
            blockElement.className = 'falling-block';
            
            if (block.is_special) {
                blockElement.classList.add('special-block');
                
                // Add health bar for special blocks
                const healthBar = document.createElement('div');
                healthBar.className = 'health-bar';
                
                const healthBarFill = document.createElement('div');
                healthBarFill.className = 'health-bar-fill';
                
                const healthBarBorder = document.createElement('div');
                healthBarBorder.className = 'health-bar-border';
                
                healthBar.appendChild(healthBarFill);
                blockElement.appendChild(healthBar);
                blockElement.appendChild(healthBarBorder);
                
                // Add input event handlers for special blocks
                blockElement.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    attackSpecialBlock(block.id);
                });
                
                blockElement.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    attackSpecialBlock(block.id);
                }, { passive: false });
            } else {
                // Add input event handlers for regular draggable blocks
                blockElement.addEventListener('mousedown', function(e) {
                    e.preventDefault();
                    if (!block.is_special && block.can_drag && !gameOver) {
                        startDragging(block.id, e.clientX, e.clientY, this);
                    }
                });
                
                blockElement.addEventListener('touchstart', function(e) {
                    e.preventDefault();
                    if (!block.is_special && block.can_drag && !gameOver) {
                        const touch = e.touches[0];
                        if (touch) {
                            startDragging(block.id, touch.clientX, touch.clientY, this);
                        }
                    }
                }, { passive: false });
            }
            
            blockElement.style.backgroundImage = `url('/static/images/${block.image}')`;
            playArea.appendChild(blockElement);
        }
        
        // Update block position
        const playAreaDimensions = getPlayAreaDimensions();
        const x = (block.x / 100) * playAreaDimensions.width;
        const y = (block.y / 100) * playAreaDimensions.height;
        
        blockElement.style.left = `${x}px`;
        blockElement.style.top = `${y}px`;
        
        // Update health bar if it's a special block
        if (block.is_special) {
            const healthBarFill = blockElement.querySelector('.health-bar-fill');
            if (healthBarFill) {
                const healthPercentage = (block.health / block.max_health) * 100;
                healthBarFill.style.width = `${healthPercentage}%`;
            }
        }
    }
    
    // Create explosion animation
    function createExplosion(x, y, isFinal = false) {
        const explosion = document.createElement('div');
        explosion.className = 'explosion';
        if (isFinal) {
            explosion.classList.add('final-explosion');
        }
        
        // Convert percentage coordinates to pixels
        const playAreaDimensions = getPlayAreaDimensions();
        const pixelX = (x / 100) * playAreaDimensions.width;
        const pixelY = (y / 100) * playAreaDimensions.height;
        
        explosion.style.left = `${pixelX - (isFinal ? 50 : 20)}px`;
        explosion.style.top = `${pixelY - (isFinal ? 50 : 20)}px`;
        
        playArea.appendChild(explosion);
        
        // Remove explosion after animation completes
        setTimeout(() => {
            explosion.remove();
        }, isFinal ? 1000 : 500);
    }
    
    // Attack a special block
    function attackSpecialBlock(blockId) {
        fetch('/api/attack-special', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ 
                blockId,
                username: username,
                uniqueId: playerUniqueId
            })
        })
        .then(response => response.json())
        .then(result => {
            if (result.success) {
                playSound('specialClick');
                
                if (result.explosion) {
                    createExplosion(result.explosion.x, result.explosion.y, result.explosion.is_final);
                }
                
                if (result.block_removed) {
                    playSound('specialDefeat');
                }
                
                if (result.score_change !== 0) {
                    updateScore(result.score_change);
                }
            }
        })
        .catch(error => console.error('Error attacking special block:', error));
    }
    
    // Check if block collides with a bucket
    function checkBucketCollision(blockElement) {
        const blockRect = blockElement.getBoundingClientRect();
        const bucketElements = document.querySelectorAll('.bucket');
        
        // Calculate center point of block
        const blockCenterX = blockRect.left + blockRect.width / 2;
        const blockBottom = blockRect.bottom;
        
        for (let i = 0; i < bucketElements.length; i++) {
            const bucketElement = bucketElements[i];
            const bucketRect = bucketElement.getBoundingClientRect();
            
            // Check if block's center X is within bucket's horizontal bounds
            const horizontalMatch = blockCenterX >= bucketRect.left && blockCenterX <= bucketRect.right;
            
            // Check if block's bottom is near bucket's top
            const verticalMatch = Math.abs(blockBottom - bucketRect.top) < 30;
            
            if (horizontalMatch && verticalMatch) {
                return bucketElement.id;
            }
        }
        
        return null;
    }
    
    // Start dragging a block (works for both mouse and touch)
    function startDragging(blockId, clientX, clientY, blockElement) {
        if (!blockElement) {
            blockElement = document.getElementById(blockId);
            if (!blockElement) return;
        }
        
        // Calculate offset for dragging
        const rect = blockElement.getBoundingClientRect();
        offsetX = clientX - rect.left;
        offsetY = clientY - rect.top;
        
        // Store the original z-index and increase it while dragging
        blockElement.dataset.originalZIndex = blockElement.style.zIndex || 3;
        blockElement.style.zIndex = 10; // Higher than other elements
        blockElement.classList.add('dragging');
        
        draggingBlock = blockId;
        
        // Find the block in our blocks array
        const block = blocks.find(b => b.id === blockId);
        if (block) {
            block.dragging = true;
        }
        
        // Update the block's dragging state on the server
        const playAreaDims = getPlayAreaDimensions();
        fetch('/api/drag-block', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                blockId: blockId,
                position: {
                    x: ((rect.left - playAreaDims.left) / playAreaDims.width) * 100,
                    y: ((rect.top - playAreaDims.top) / playAreaDims.height) * 100
                },
                username: username,
                uniqueId: playerUniqueId
            })
        }).catch(error => console.error('Error updating drag state:', error));
        
        // Add appropriate event listeners based on input type
        document.addEventListener('mousemove', onMouseMove);
        document.addEventListener('mouseup', onMouseUp);
        document.addEventListener('touchmove', onTouchMove, { passive: false });
        document.addEventListener('touchend', onTouchEnd);
        document.addEventListener('touchcancel', onTouchEnd);
    }
    
    // Mouse move handler
    function onMouseMove(event) {
        if (!draggingBlock) return;
        
        // Only handle mouse events, not simulated touch events
        if (event.pointerType === 'touch') return;
        
        moveBlock(event.clientX, event.clientY);
    }
    
    // Touch move handler
    function onTouchMove(event) {
        event.preventDefault(); // Prevent scrolling while dragging
        if (!draggingBlock) return;
        
        const touch = event.touches[0];
        if (touch) {
            moveBlock(touch.clientX, touch.clientY);
        }
    }
    
    // Move block based on cursor/touch position
    function moveBlock(clientX, clientY) {
        const blockElement = document.getElementById(draggingBlock);
        if (!blockElement) return;
        
        const playAreaRect = playArea.getBoundingClientRect();
        
        // Calculate the new position, clamping to stay within play area bounds
        let x = Math.max(0, Math.min(playAreaRect.width - blockElement.offsetWidth, 
            clientX - playAreaRect.left - offsetX));
        let y = Math.max(0, Math.min(playAreaRect.height - blockElement.offsetHeight, 
            clientY - playAreaRect.top - offsetY));
        
        blockElement.style.left = `${x}px`;
        blockElement.style.top = `${y}px`;
        
        // Update the block in our local array
        const block = blocks.find(b => b.id === draggingBlock);
        if (block) {
            block.x = (x / playAreaRect.width) * 100;
            block.y = (y / playAreaRect.height) * 100;
        }
    }
    
    // Mouse up handler
    function onMouseUp(event) {
        // Only handle mouse events, not simulated touch events
        if (event.pointerType === 'touch') return;
        
        if (!draggingBlock) return;
        endDragging();
    }
    
    // Touch end handler
    function onTouchEnd(event) {
        if (!draggingBlock) return;
        endDragging();
    }
    
    // End dragging (works for both mouse and touch)
    function endDragging() {
        const blockElement = document.getElementById(draggingBlock);
        if (!blockElement) return;
        
        // Reset z-index and remove dragging class
        blockElement.style.zIndex = blockElement.dataset.originalZIndex || 3;
        blockElement.classList.remove('dragging');
        
        // Check if block is over a bucket
        const bucketId = checkBucketCollision(blockElement);
        const block = blocks.find(b => b.id === draggingBlock);
        
        if (block) {
            block.dragging = false;
        }
        
        // Get final position as percentage of play area
        const playAreaRect = playArea.getBoundingClientRect();
        const x = (parseInt(blockElement.style.left) / playAreaRect.width) * 100;
        const y = (parseInt(blockElement.style.top) / playAreaRect.height) * 100;
        
        // Send drop event to server
        fetch('/api/drop-block', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                blockId: draggingBlock,
                position: { x, y },
                bucketId: bucketId,
                username: username,
                uniqueId: playerUniqueId
            })
        })
        .then(response => response.json())
        .then(result => {
            // Handle the result
            if (result.score_change !== 0) {
                updateScore(result.score_change);
            }
            
            if (result.bucket_hit !== null) {
                if (result.score_change > 0) {
                    playSound('bucketMatch');
                    animateBucket(result.bucket_hit, true);
                } else {
                    animateBucket(result.bucket_hit, false);
                }
            }
            
            if (result.game_over) {
                endGame(false); // false means not from timer
            }
            
            // Remove the block element if it was matched
            if (result.block_removed && blockElement) {
                blockElement.remove();
            }
        })
        .catch(error => console.error('Error dropping block:', error));
        
        // Remove event listeners
        document.removeEventListener('mousemove', onMouseMove);
        document.removeEventListener('mouseup', onMouseUp);
        document.removeEventListener('touchmove', onTouchMove);
        document.removeEventListener('touchend', onTouchEnd);
        document.removeEventListener('touchcancel', onTouchEnd);
        
        draggingBlock = null;
    }
    
    // Update score display
    function updateScore(change) {
        if (change !== undefined) {
            score += change;
        }
        scoreDisplay.textContent = `Score: ${score}`;
    }
    
    // End the game
    function endGame(fromTimer = false) {
        // Don't process again if already game over
        if (gameOver) return;
        
        gameOver = true;
        
        // Stop the timer
        if (timerInterval) {
            clearInterval(timerInterval);
            timerInterval = null;
        }
        
        // Update the final score display
        finalScoreDisplay.textContent = `Final Score: ${score}`;
        
        // Show different message based on what ended the game
        const gameOverTitle = document.querySelector('#game-over h1');
        if (gameOverTitle) {
            gameOverTitle.textContent = fromTimer ? "TIME'S UP!" : "GAME OVER";
        }
        
        // Show the game over screen
        gameOverScreen.style.display = 'flex';
        
        // Stop the game loop
        clearInterval(updateInterval);
        
        // Play game over sound
        playSound('specialDefeat');
        
        // Send game over event to server
        fetch('/api/game-over', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                uniqueId: playerUniqueId,
                score: score,
                timedOut: fromTimer
            })
        }).catch(error => console.error('Error sending game over:', error));
    }
    
    // Update game state
    function updateGame() {
        if (gameOver) return;
        
        fetch('/api/update-game', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                username: username,
                uniqueId: playerUniqueId
            })
        })
        .then(response => response.json())
        .then(data => {
            // Update game state
            score = data.score;
            updateScore();
            
            // Update blocks that aren't being dragged
            data.blocks.forEach(serverBlock => {
                // Skip updating blocks that are being dragged locally
                const existingBlock = blocks.find(b => b.id === serverBlock.id);
                if (!existingBlock || !existingBlock.dragging) {
                    const blockIndex = blocks.findIndex(b => b.id === serverBlock.id);
                    if (blockIndex >= 0) {
                        blocks[blockIndex] = serverBlock;
                    } else {
                        blocks.push(serverBlock);
                    }
                    renderBlock(serverBlock);
                }
            });
            
            // Remove blocks that are no longer in the game
            blocks = blocks.filter(block => {
                if (!data.blocks.some(serverBlock => serverBlock.id === block.id) && !block.dragging) {
                    const element = document.getElementById(block.id);
                    if (element) element.remove();
                    return false;
                }
                return true;
            });
            
            // Handle animations
            data.animations.forEach(animation => {
                if (!animations.some(a => a.id === animation.id)) {
                    animations.push(animation);
                    createExplosion(animation.x, animation.y, animation.is_final);
                }
            });
            
            // Check game over state
            if (data.game_over && !gameOver) {
                endGame(false);
            }
        })
        .catch(error => console.error('Error updating game state:', error));
    }
    
    // Update bucket positions on window resize
    window.addEventListener('resize', function() {
        // Update cached bucket rectangles
        buckets.forEach((bucket, index) => {
            const element = document.getElementById(bucket.id);
            if (element) {
                bucket.rect = element.getBoundingClientRect();
            }
        });
    });
    
    // Add event listeners for buttons
    restartButton.addEventListener('click', function() {
        // Reset timer
        timeRemaining = 60; // 1 minute
        updateTimerDisplay();
        
        // Restart the game
        initGame();
        
        // Start the timer again
        startTimer();
    });
    
    if (isTouchDevice) {
        restartButton.addEventListener('touchstart', function(e) {
            e.preventDefault();
            
            // Reset timer
            timeRemaining = 60; // 1 minute
            updateTimerDisplay();
            
            // Restart the game
            initGame();
            
            // Start the timer again
            startTimer();
        }, { passive: false });
    }
    
    // Handle errors loading resources
    window.addEventListener('error', function(e) {
        if (e.target.tagName === 'IMG' || e.target.tagName === 'AUDIO') {
            console.warn(`Failed to load resource: ${e.target.src}`);
            e.preventDefault(); // Prevent the error from appearing in console
        }
    }, true);
});