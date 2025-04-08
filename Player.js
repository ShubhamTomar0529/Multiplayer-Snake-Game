const mongoose = require('mongoose');

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

PlayerSchema.pre('save', function(next) {
    this.updatedAt = Date.now();
    next();
});

PlayerSchema.methods.updateStats = async function(score, won) {
    this.gamesPlayed += 1;
    
    if (score > this.score) {
        this.score = score;
    }
    
    if (won) {
        this.wins += 1;
    }
    
    this.updatedAt = Date.now();
    return this.save();
};

module.exports = mongoose.model('Player', PlayerSchema); 
