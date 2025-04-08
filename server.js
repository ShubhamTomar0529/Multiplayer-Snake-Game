const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');

// Path to leaderboard data file
const leaderboardPath = path.join(__dirname, 'leaderboard.json');

// Function to read leaderboard data
function getLeaderboardData() {
    try {
        if (fs.existsSync(leaderboardPath)) {
            return JSON.parse(fs.readFileSync(leaderboardPath, 'utf8'));
        }
        return [];
    } catch (err) {
        console.error('Error reading leaderboard:', err);
        return [];
    }
}

// Function to save leaderboard data
function saveLeaderboardData(data) {
    try {
        fs.writeFileSync(leaderboardPath, JSON.stringify(data, null, 2));
    } catch (err) {
        console.error('Error saving leaderboard:', err);
    }
}

const app = express();

// Enable CORS for all routes
app.use(cors({
    origin: '*', // Allow all origins
    methods: ['GET', 'POST'],
    credentials: true
}));

const server = http.createServer(app);

// Serve static files from the current directory
app.use(express.static(__dirname));

// Root route
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Setup Socket.IO with CORS enabled
const io = new Server(server, {
    cors: {
        origin: "*", // Allow all origins
        methods: ["GET", "POST"],
        credentials: true
    }
});

const {gameLoop, getUpdatedVelocity, initGame} = require('./game');
const {FRAME_RATE} = require('./constants');
const {makeid} = require('./utils');

const state = {};
const clientRooms = {};
const gameIntervals = {};
const playerNames = {};

io.on('connection', client => {
    console.log('A user connected with ID:', client.id);
    
    client.on('keydown', handleKeydown);
    client.on('newGame', handleNewGame);
    client.on('joinGame', handleJoinGame);
    client.on('disconnect', handleDisconnect);
    client.on('getLeaderboard', handleGetLeaderboard);
    client.on('updateScore', handleUpdateScore);

    function handleJoinGame(roomName, playerName) {
        // Validate game code
        if (!roomName || typeof roomName !== 'string' || roomName.length !== 5) {
            client.emit('invalidGameCode');
            return;
        }

        const room = io.sockets.adapter.rooms.get(roomName);

        let numClients = 0;
        if (room) {
            numClients = room.size;
        }

        if (numClients === 0) {
            client.emit('unknownGame');
            return;
        } else if (numClients > 1) {
            client.emit('tooManyPlayers');
            return;
        }

        // Store player name
        if (playerName) {
            playerNames[client.id] = playerName;
        }

        clientRooms[client.id] = roomName;

        client.join(roomName);
        client.number = 2;
        client.emit('init', 2);

        // Check if both players are ready
        const allClients = Array.from(io.sockets.adapter.rooms.get(roomName));
        // Make sure we have both players before starting
        if (allClients.length === 2) {
            startGameInterval(roomName);
        }
    }

    function handleNewGame(playerName) {
        let roomName = makeid(5);
        clientRooms[client.id] = roomName;
        client.emit('gameCode', roomName);

        // Store player name
        if (playerName) {
            playerNames[client.id] = playerName;
        }

        state[roomName] = initGame();

        client.join(roomName);
        client.number = 1;
        client.emit('init', 1);
    }

    function handleKeydown(keyCode) {
        const roomName = clientRooms[client.id];
        
        if (!roomName || !state[roomName]) {
            return;
        }

        try {
            keyCode = parseInt(keyCode);
        } catch(e) {
            console.error(e);
            return;
        }

        const playerIndex = client.number - 1;
        if (playerIndex < 0 || playerIndex >= state[roomName].players.length) {
            return;
        }

        const currentVel = state[roomName].players[playerIndex].vel;
        const vel = getUpdatedVelocity(keyCode, currentVel);
        
        if (vel) {
            state[roomName].players[playerIndex].vel = vel;
        }
    }

    function handleGetLeaderboard() {
        const leaderboard = getLeaderboardData();
        client.emit('leaderboardData', leaderboard.sort((a, b) => b.score - a.score).slice(0, 10));
    }

    function handleUpdateScore(data) {
        const { playerName, score, won } = data;
        
        if (!playerName) {
            console.log('No player name provided for score update');
            return;
        }
        
        console.log(`Updating score for ${playerName}: score=${score}, won=${won}`);
        
        const leaderboard = getLeaderboardData();
        
        let player = leaderboard.find(p => p.name === playerName);
        if (!player) {
            player = { 
                name: playerName, 
                score: 0, 
                wins: 0, 
                gamesPlayed: 0 
            };
            leaderboard.push(player);
        }
        
        // Always increment games played
        player.gamesPlayed += 1;
        
        // Only update score if the new score is actually higher
        if (score > player.score) {
            player.score = score;
            console.log(`New high score for ${playerName}: ${score}`);
        }
        
        // Only increment wins if the player actually won
        if (won === true) {
            player.wins += 1;
            console.log(`${playerName} won their game`);
        }
        
        saveLeaderboardData(leaderboard);
    }

    function handleDisconnect() {
        console.log('Client disconnected:', client.id);
        const roomName = clientRooms[client.id];
        
        if (roomName) {
            // End the game if a player disconnects
            if (state[roomName]) {
                state[roomName].active = false;
                
                // Notify other players that someone disconnected
                io.sockets.in(roomName).emit('playerDisconnected', client.number);
                
                // Clear the game interval
                if (gameIntervals[roomName]) {
                    clearInterval(gameIntervals[roomName]);
                    delete gameIntervals[roomName];
                }
            }
            
            // Remove client from our tracking
            delete clientRooms[client.id];
            delete playerNames[client.id];
        }
    }
});

function startGameInterval(roomName) {
    // Clear any existing interval for this room
    if (gameIntervals[roomName]) {
        clearInterval(gameIntervals[roomName]);
    }

    const intervalId = setInterval(() => {
        if (!state[roomName] || !state[roomName].active) {
            clearInterval(intervalId);
            delete gameIntervals[roomName];
            return;
        }

        const winner = gameLoop(state[roomName]);

        if (!winner) {
            emitGameState(roomName, state[roomName]);
        } else {
            // Get final snake lengths for scoring
            const player1Score = state[roomName].players[0].snake.length;
            const player2Score = state[roomName].players[1].snake.length;
            
            emitGameOver(roomName, winner, {
                player1Score,
                player2Score
            });
            
            state[roomName].active = false;
            clearInterval(intervalId);
            delete gameIntervals[roomName];
        }
    }, 1000 / FRAME_RATE);

    gameIntervals[roomName] = intervalId;
}

function emitGameState(roomName, state) {
    // Only send to clients in the room
    if (io.sockets.adapter.rooms.has(roomName)) {
        io.sockets.in(roomName).emit('gameState', JSON.stringify(state));
    }
}

function emitGameOver(roomName, winner, scoreData) {
    // Only send to clients in the room
    if (io.sockets.adapter.rooms.has(roomName)) {
        // Get detailed winner and loser information
        const winnerScore = winner === 1 ? scoreData.player1Score : scoreData.player2Score;
        const loserScore = winner === 1 ? scoreData.player2Score : scoreData.player1Score;
        
        // Send separate messages to each player with correct win/loss status
        const clients = Array.from(io.sockets.adapter.rooms.get(roomName));
        
        clients.forEach(clientId => {
            const socket = io.sockets.sockets.get(clientId);
            if (socket) {
                const clientNumber = socket.number;
                const playerWon = clientNumber === winner;
                const playerScore = clientNumber === 1 ? scoreData.player1Score : scoreData.player2Score;
                
                socket.emit('gameOver', JSON.stringify({
                    winner,
                    playerWon,
                    score: playerScore,
                    opponentScore: clientNumber === 1 ? scoreData.player2Score : scoreData.player1Score
                }));
            }
        });
    }
}

// Change port to 80 to make it easier with ngrok
const PORT = process.env.PORT || 80;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    console.log(`Open your browser and navigate to: http://localhost:${PORT}`);
});