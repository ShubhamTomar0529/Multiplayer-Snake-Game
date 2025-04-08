const BG_COLOUR = "#231f20";
const SNAKE_COLOUR = "#c2c2c2";
const FOOD_COLOUR = "#e66916";
const PLAYER1_COLOR = "#c2c2c2";
const PLAYER2_COLOR = "#e41b17";

// Create a script element to load the mongoHandler.js
const mongoHandlerScript = document.createElement('script');
mongoHandlerScript.src = 'mongoHandler.js';
document.head.appendChild(mongoHandlerScript);

// Variable to store MongoDB handler functions
let mongoHandler = null;

// Wait for the script to load
mongoHandlerScript.onload = function() {
    console.log('MongoDB handler loaded');
    // The module is now loaded and available
    mongoHandler = window.mongoHandler;
};

// Dynamically determine server URL
const serverUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? `http://${window.location.hostname}:3000` 
    : window.location.origin;

console.log('Connecting to server at:', serverUrl);

const socket = io(serverUrl, {
    transports: ['websocket', 'polling'] // Allow fallback to polling if websocket fails
});

socket.on('connect', () => {
    console.log('Connected to server');
});

socket.on('connect_error', (error) => {
    console.error('Connection error:', error);
    alert('Failed to connect to the game server. Please check your connection and try again.');
});

socket.on('init', handleInit);
socket.on('gameState', handleGameState);
socket.on('gameOver', handleGameOver);
socket.on('gameCode', handleGameCode);
socket.on('unknownGame', handleUnknownGame);
socket.on('tooManyPlayers', handleTooManyPlayers);
socket.on('invalidGameCode', handleInvalidGameCode);
socket.on('playerDisconnected', handlePlayerDisconnected);
socket.on('leaderboardData', handleLeaderboardData);

const gameScreen = document.getElementById('gameScreen');
const initialScreen = document.getElementById('initialScreen');
const newGameBtn = document.getElementById('newGameButton');
const joinGameBtn = document.getElementById('joinGameButton');
const gameCodeInput = document.getElementById('gameCodeInput');
const gameCodeDisplay = document.getElementById('gameCodeDisplay');
const playerNameInput = document.getElementById('playerNameInput');
const leaderboardScreen = document.getElementById('leaderboardScreen');
const viewLeaderboardBtn = document.getElementById('viewLeaderboardButton');
const backToMenuBtn = document.getElementById('backToMenuButton');

newGameBtn.addEventListener('click', newGame);
joinGameBtn.addEventListener('click', joinGame);
viewLeaderboardBtn.addEventListener('click', viewLeaderboard);
backToMenuBtn.addEventListener('click', backToMenu);

let canvas, ctx;
let playerNumber;
let gameActive = false;
let playerName = '';

function newGame() {
    playerName = playerNameInput.value.trim();
    
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    
    socket.emit('newGame', playerName);
    init();
}

function joinGame() {
    playerName = playerNameInput.value.trim();
    const code = gameCodeInput.value.trim();
    
    if (!playerName) {
        alert('Please enter your name');
        return;
    }
    
    // Basic validation
    if (!code || code.length !== 5) {
        alert('Please enter a valid 5-character game code');
        return;
    }
    
    socket.emit('joinGame', code, playerName);
    init();
}

function viewLeaderboard() {
    initialScreen.style.display = "none";
    leaderboardScreen.style.display = "block";
    
    // Request leaderboard data from server
    socket.emit('getLeaderboard');
}

function backToMenu() {
    leaderboardScreen.style.display = "none";
    initialScreen.style.display = "block";
}

function init() {
    initialScreen.style.display = "none";
    gameScreen.style.display = "block";

    canvas = document.getElementById('canvas');
    ctx = canvas.getContext('2d');

    canvas.width = canvas.height = 600;

    ctx.fillStyle = BG_COLOUR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    document.addEventListener('keydown', keydown);
    gameActive = true;
}

function keydown(e) {
    // Only process arrow keys (37-40)
    if (e.keyCode >= 37 && e.keyCode <= 40) {
        socket.emit('keydown', e.keyCode);
    }
}

function paintGame(state) {
    ctx.fillStyle = BG_COLOUR;
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const food = state.food;
    const gridsize = state.gridsize;
    const size = canvas.width / gridsize;

    // Draw food
    ctx.fillStyle = FOOD_COLOUR;
    ctx.fillRect(food.x * size, food.y * size, size, size);

    // Draw both players
    paintPlayer(state.players[0], size, PLAYER1_COLOR);
    paintPlayer(state.players[1], size, PLAYER2_COLOR);
}

function paintPlayer(playerState, size, colour) {
    const snake = playerState.snake;

    ctx.fillStyle = colour;

    for (let i = 0; i < snake.length; i++) {
        const cell = snake[i];
        
        // Draw snake body
        ctx.fillRect(cell.x * size, cell.y * size, size, size);
        
        // Draw border around cells for better visibility
        ctx.strokeStyle = BG_COLOUR;
        ctx.strokeRect(cell.x * size, cell.y * size, size, size);
        
        // Highlight the head
        if (i === snake.length - 1) {
            ctx.strokeStyle = "#ffffff";
            ctx.lineWidth = 2;
            ctx.strokeRect(cell.x * size + 2, cell.y * size + 2, size - 4, size - 4);
            ctx.lineWidth = 1;
        }
    }
}

function handleInit(number) {
    playerNumber = number;
}

function handleGameState(gameState) {
    if (!gameActive) {
        return;
    }

    gameState = JSON.parse(gameState);
    // Store the last game state to use for score calculation
    socket.lastGameState = JSON.stringify(gameState);
    requestAnimationFrame(() => paintGame(gameState));
}

function handleGameOver(data) {
    if (!gameActive) {
        return;
    }

    data = JSON.parse(data);
    gameActive = false;
    
    let finalScore = 0;
    
    // Use the score provided by the server directly
    if (data.score) {
        finalScore = data.score;
    } else if (socket.lastGameState) {
        // Fallback: Calculate from lastGameState if needed
        try {
            const gameState = JSON.parse(socket.lastGameState);
            finalScore = gameState.players[playerNumber - 1].snake.length;
        } catch (err) {
            console.error('Error calculating score:', err);
        }
    }

    // Use the playerWon flag directly from the server
    const playerWon = data.playerWon === true;
    
    if (playerWon) {
        alert(`You Win! Your score: ${finalScore}. Opponent score: ${data.opponentScore || 0}`);
    } else {
        alert(`You Lose. Your score: ${finalScore}. Opponent score: ${data.opponentScore || 0}`);
    }
    
    // Send score to server with the accurate win status from the server
    socket.emit('updateScore', {
        playerName: playerName,
        score: finalScore,
        won: playerWon
    });
    
    setTimeout(() => {
        reset();
    }, 2000);
}

function handleLeaderboardData(data) {
    const leaderboardBody = document.getElementById('leaderboardBody');
    leaderboardBody.innerHTML = '';
    
    data.forEach((player, index) => {
        const row = document.createElement('tr');
        
        const rankCell = document.createElement('td');
        rankCell.textContent = index + 1;
        
        const nameCell = document.createElement('td');
        nameCell.textContent = player.name;
        
        const scoreCell = document.createElement('td');
        scoreCell.textContent = player.score;
        
        const winsCell = document.createElement('td');
        winsCell.textContent = player.wins;
        
        row.appendChild(rankCell);
        row.appendChild(nameCell);
        row.appendChild(scoreCell);
        row.appendChild(winsCell);
        
        leaderboardBody.appendChild(row);
    });
}

function handleGameCode(gameCode) {
    gameCodeDisplay.innerText = gameCode;
}

function handleUnknownGame() {
    reset();
    alert('Unknown Game Code');
}

function handleTooManyPlayers() {
    reset();
    alert('This game is already in progress');
}

function handleInvalidGameCode() {
    reset();
    alert('Invalid Game Code Format');
}

function handlePlayerDisconnected(playerNum) {
    gameActive = false;
    alert(`Player ${playerNum} disconnected. Game ended.`);
    reset();
}

function reset() {
    playerNumber = null;
    gameCodeInput.value = '';
    gameActive = false;
    initialScreen.style.display = "block";
    gameScreen.style.display = "none";
}