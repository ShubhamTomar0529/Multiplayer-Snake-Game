const {GRID_SIZE} = require('./constants');

module.exports = {
    initGame,
    gameLoop,
    getUpdatedVelocity,
}

function initGame(){
    const state = createGameState();
    randomFood(state);
    return state;
}

function createGameState(){
    return {
        players:[{
            pos:{
                x:3,
                y:10,
            },
            vel:{
                x:1,
                y:0,
            },
            snake:[
                {x:1, y:10},
                {x:2, y:10},
                {x:3, y:10},
            ],
        },{
            pos:{
                x:18,
                y:10,
            },
            vel:{
                x:-1,
                y:0,
            },
            snake:[
                {x:20, y:10},
                {x:19, y:10},
                {x:18, y:10},
            ],
        }],
        food:{},
        gridsize: GRID_SIZE,
        active: true
    };
}

function gameLoop(state) {
    if (!state || !state.active) {
        return;
    }
  
    const playerOne = state.players[0];
    const playerTwo = state.players[1];
  
    // Store old positions and directions before moving
    const playerOneOldPos = {...playerOne.pos};
    const playerTwoOldPos = {...playerTwo.pos};
  
    // Move players
    playerOne.pos.x += playerOne.vel.x;
    playerOne.pos.y += playerOne.vel.y;
    playerTwo.pos.x += playerTwo.vel.x;
    playerTwo.pos.y += playerTwo.vel.y;
  
    // Check boundary collisions
    if (playerOne.pos.x < 0 || playerOne.pos.x >= GRID_SIZE || playerOne.pos.y < 0 || playerOne.pos.y >= GRID_SIZE) {
        return 2;
    }
  
    if (playerTwo.pos.x < 0 || playerTwo.pos.x >= GRID_SIZE || playerTwo.pos.y < 0 || playerTwo.pos.y >= GRID_SIZE) {
        return 1;
    }
  
    // Check for food collisions
    if (state.food.x === playerOne.pos.x && state.food.y === playerOne.pos.y) {
        playerOne.snake.push({...playerOneOldPos});
        randomFood(state);
    }
  
    if (state.food.x === playerTwo.pos.x && state.food.y === playerTwo.pos.y) {
        playerTwo.snake.push({...playerTwoOldPos});
        randomFood(state);
    }
  
    // Move player one's snake if they're moving
    if (playerOne.vel.x !== 0 || playerOne.vel.y !== 0) {
        // Check self-collision
        for (let i = 0; i < playerOne.snake.length - 1; i++) {
            const cell = playerOne.snake[i];
            if (cell.x === playerOne.pos.x && cell.y === playerOne.pos.y) {
                return 2;
            }
        }
        
        // Check collision with other player's snake
        for (let cell of playerTwo.snake) {
            if (cell.x === playerOne.pos.x && cell.y === playerOne.pos.y) {
                return 2;
            }
        }
  
        playerOne.snake.push({...playerOne.pos});
        playerOne.snake.shift();
    }
  
    // Move player two's snake if they're moving
    if (playerTwo.vel.x !== 0 || playerTwo.vel.y !== 0) {
        // Check self-collision
        for (let i = 0; i < playerTwo.snake.length - 1; i++) {
            const cell = playerTwo.snake[i];
            if (cell.x === playerTwo.pos.x && cell.y === playerTwo.pos.y) {
                return 1;
            }
        }
        
        // Check collision with other player's snake
        for (let cell of playerOne.snake) {
            if (cell.x === playerTwo.pos.x && cell.y === playerTwo.pos.y) {
                return 1;
            }
        }
  
        playerTwo.snake.push({...playerTwo.pos});
        playerTwo.snake.shift();
    }
  
    return false;
}

function randomFood(state){
    const food = {
        x: Math.floor(Math.random() * GRID_SIZE),
        y: Math.floor(Math.random() * GRID_SIZE),
    };

    // Check collision with player one's snake
    for(let cell of state.players[0].snake){
        if(cell.x === food.x && cell.y === food.y){
            return randomFood(state);
        }
    }

    // Check collision with player two's snake
    for(let cell of state.players[1].snake){
        if(cell.x === food.x && cell.y === food.y){
            return randomFood(state);
        }
    }

    state.food = food;
}

function getUpdatedVelocity(keyCode, currentVel){
    // Define direction constants
    const LEFT = {x: -1, y: 0};
    const RIGHT = {x: 1, y: 0};
    const UP = {x: 0, y: -1};
    const DOWN = {x: 0, y: 1};

    // Prevent reversing direction
    switch(keyCode){
        case 37: { // LEFT
            return (currentVel.x === 1) ? null : LEFT;
        }
        case 38: { // UP
            return (currentVel.y === 1) ? null : UP;
        }
        case 39: { // RIGHT
            return (currentVel.x === -1) ? null : RIGHT;
        }
        case 40: { // DOWN
            return (currentVel.y === -1) ? null : DOWN;
        }
        default: return null;
    }
}