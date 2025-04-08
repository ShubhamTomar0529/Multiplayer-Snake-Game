const mongoose = require('mongoose');

// Player schema for leaderboard
const PlayerSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true,
        maxlength: 50,
        unique: true
    },
    score: {
        type: Number,
        default: 0
    },
    wins: {
        type: Number,
        default: 0
    },
    gamesPlayed: {
        type: Number,
        default: 0
    },
    createdAt: {
        type: Date,
        default: Date.now
    },
    updatedAt: {
        type: Date,
        default: Date.now
    }
});

// Update the updatedAt field on save
PlayerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

// Method to update player stats after a game
PlayerSchema.methods.updateStats = async function(score, won) {
    this.gamesPlayed += 1;
    
    // Update score if the new score is higher than current score
    if (score > this.score) {
        this.score = score;
    }
    
    // Increment wins if player won
    if (won) {
        this.wins += 1;
    }
    
    this.updatedAt = Date.now();
    return this.save();
};

module.exports = mongoose.model('Player', PlayerSchema); 