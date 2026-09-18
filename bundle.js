/**
 * Chess Durak - Complete All-in-One Game Engine & Controller
 * Works both via file:// (double-click in explorer) and HTTP servers
 */

/**
 * Sound synthesizer using Web Audio API (no external asset dependencies)
 */
class SoundEffects {
    constructor() {
        this.ctx = null;
        this.enabled = true;
    }

    init() {
        if (!this.ctx) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            if (AudioContext) {
                this.ctx = new AudioContext();
            }
        }
        if (this.ctx && this.ctx.state === 'suspended') {
            this.ctx.resume();
        }
    }

    playTone(freq, type, duration, gain = 0.15, decay = true) {
        if (!this.enabled) return;
        this.init();
        if (!this.ctx) return;

        try {
            const osc = this.ctx.createOscillator();
            const gainNode = this.ctx.createGain();

            osc.type = type;
            osc.frequency.setValueAtTime(freq, this.ctx.currentTime);

            gainNode.gain.setValueAtTime(gain, this.ctx.currentTime);
            if (decay) {
                gainNode.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
            }

            osc.connect(gainNode);
            gainNode.connect(this.ctx.destination);

            osc.start();
            osc.stop(this.ctx.currentTime + duration);
        } catch (e) {
            console.warn('Audio error:', e);
        }
    }

    move() {
        this.playTone(320, 'sine', 0.08, 0.12);
    }

    capture() {
        this.playTone(180, 'triangle', 0.15, 0.25);
        setTimeout(() => this.playTone(280, 'sine', 0.12, 0.15), 50);
    }

    check() {
        this.playTone(520, 'square', 0.1, 0.15);
        setTimeout(() => this.playTone(680, 'square', 0.15, 0.18), 80);
    }

    spawn() {
        this.playTone(440, 'triangle', 0.1, 0.1);
        setTimeout(() => this.playTone(587.33, 'triangle', 0.15, 0.12), 60);
        setTimeout(() => this.playTone(880, 'sine', 0.18, 0.1), 120);
    }

    victory() {
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, idx) => {
            setTimeout(() => this.playTone(freq, 'triangle', 0.3, 0.2), idx * 120);
        });
    }

    defeat() {
        const notes = [440, 370, 311, 220];
        notes.forEach((freq, idx) => {
            setTimeout(() => this.playTone(freq, 'sawtooth', 0.35, 0.15), idx * 140);
        });
    }
}

const sounds = new SoundEffects();


/**
 * Chess Durak - Piece and Suit Definitions
 */

const SUITS = {
    spades: {
        id: 'spades',
        name: 'Пики',
        symbol: '♠',
        color: '#2563eb', // Blue-Dark
        badgeClass: 'suit-spades'
    },
    clubs: {
        id: 'clubs',
        name: 'Крести',
        symbol: '♣',
        color: '#16a34a', // Emerald Green
        badgeClass: 'suit-clubs'
    },
    hearts: {
        id: 'hearts',
        name: 'Черви',
        symbol: '♥',
        color: '#e11d48', // Ruby Red
        badgeClass: 'suit-hearts'
    },
    diamonds: {
        id: 'diamonds',
        name: 'Бубни',
        symbol: '♦',
        color: '#ea580c', // Orange-Amber
        badgeClass: 'suit-diamonds'
    }
};

const PIECE_VALUES = {
    P: 100,
    N: 320,
    B: 330,
    R: 500,
    Q: 900,
    K: 20000
};

const PIECE_NAMES = {
    P: 'Пешка',
    N: 'Конь',
    B: 'Слон',
    R: 'Ладья',
    Q: 'Ферзь',
    K: 'Король'
};

let pieceCounter = 1;

function createPiece(type, color, suit = null) {
    return {
        id: `p_${pieceCounter++}`,
        type,
        color, // 'white' | 'black'
        suit,  // 'spades' | 'clubs' | 'hearts' | 'diamonds' | null
        hasMoved: false
    };
}

/**
 * Creates the standard 60-piece card deck for Chess Durak
 * 4 suits * (8 P + 2 N + 2 B + 2 R + 1 Q) = 60 pieces
 */
function createDeck() {
    const deck = [];
    const suitKeys = Object.keys(SUITS);

    suitKeys.forEach(suit => {
        // 8 Pawns
        for (let i = 0; i < 8; i++) {
            deck.push({ type: 'P', suit });
        }
        // 2 Knights
        for (let i = 0; i < 2; i++) {
            deck.push({ type: 'N', suit });
        }
        // 2 Bishops
        for (let i = 0; i < 2; i++) {
            deck.push({ type: 'B', suit });
        }
        // 2 Rooks
        for (let i = 0; i < 2; i++) {
            deck.push({ type: 'R', suit });
        }
        // 1 Queen
        deck.push({ type: 'Q', suit });
    });

    // Shuffle using Fisher-Yates
    for (let i = deck.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck[i], deck[j]] = [deck[j], deck[i]];
    }

    return deck;
}

const PIECE_VALUES_MAP = {
    P: 1,
    N: 3,
    B: 3,
    R: 5,
    Q: 9
};

/**
 * Returns a random odd integer from 7 to 51.
 * Any sum of 7 pieces with odd values (1, 3, 5, 9) is strictly odd.
 */
function getRandomStartingPoints() {
    const oddSums = [];
    for (let s = 7; s <= 51; s += 2) {
        oddSums.push(s);
    }
    return oddSums[Math.floor(Math.random() * oddSums.length)];
}

/**
 * Generates 7 suited pieces for a player such that their total value equals targetSum.
 */
function generatePiecesWithSum(targetSum, color) {
    const pieceTypes = ['P', 'N', 'B', 'R', 'Q'];
    const maxCounts = { P: 7, N: 4, B: 4, R: 4, Q: 4 };
    const suitKeys = Object.keys(SUITS);

    // If targetSum is even or out of bounds, clamp to nearest odd in [7, 51]
    if (targetSum < 7) targetSum = 7;
    if (targetSum > 51) targetSum = 51;
    if (targetSum % 2 === 0) targetSum += 1;

    // Find all valid 7-piece combinations that sum to targetSum
    const validCombos = [];
    function search(typeIdx, count, currentSum, chosen) {
        if (count === 7) {
            if (currentSum === targetSum) {
                validCombos.push([...chosen]);
            }
            return;
        }
        if (currentSum + (7 - count) * 1 > targetSum) return;
        if (currentSum + (7 - count) * 9 < targetSum) return;

        for (let i = typeIdx; i < pieceTypes.length; i++) {
            const t = pieceTypes[i];
            const currentTypeCount = chosen.filter(x => x === t).length;
            if (currentTypeCount < maxCounts[t]) {
                search(i, count + 1, currentSum + PIECE_VALUES_MAP[t], [...chosen, t]);
            }
        }
    }

    search(0, 0, 0, []);

    const chosenCombo = validCombos.length > 0
        ? validCombos[Math.floor(Math.random() * validCombos.length)]
        : ['P', 'P', 'P', 'P', 'P', 'P', 'P'];

    const suitsUsedForType = {};
    const pieces = [];
    const shuffledTypes = [...chosenCombo].sort(() => Math.random() - 0.5);

    for (const type of shuffledTypes) {
        if (!suitsUsedForType[type]) suitsUsedForType[type] = [];
        const availableSuits = suitKeys.filter(s => !suitsUsedForType[type].includes(s));
        const suitPool = availableSuits.length > 0 ? availableSuits : suitKeys;
        const chosenSuit = suitPool[Math.floor(Math.random() * suitPool.length)];
        suitsUsedForType[type].push(chosenSuit);

        pieces.push(createPiece(type, color, chosenSuit));
    }

    return pieces;
}

// Crisp Vector SVGs for chess pieces
const PIECE_SVGS = {
    white: {
        K: `<svg viewBox="0 0 45 45"><g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V23.5C20 16 10.5 13 6.5 19.5c-3 6 5.5 10.5 5.5 10.5v7z"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g></svg>`,
        Q: `<svg viewBox="0 0 45 45"><g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm-29.5 4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm24 0a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11-7.5-16-7.5 16-7-11 2 12zm0 5c9-1.5 18-1.5 27 0l1 5.5s-6.5 2.5-14.5 2.5-14.5-2.5-14.5-2.5L9 31z"/><path d="M11 38.5a35 35 0 0 0 23 0"/></g></svg>`,
        R: `<svg viewBox="0 0 45 45"><g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zm3-3v-4.5h21V36H12zm2-4.5l1.5-14h14l1.5 14H14zM11 14h23v-3H11v3zm1.5-3.5V7h3.5v2.5h4V7h5v2.5h4V7h3.5v3.5H12.5z"/></g></svg>`,
        B: `<svg viewBox="0 0 45 45"><g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/><path d="M17.5 26h10M15 30h15m-7.5-14.5v5m-3-2.5h6"/></g></svg>`,
        N: `<svg viewBox="0 0 45 45"><g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0-.932 1.49-1.5 2.5-.7 1.25-2.2 1.5-2.5 1-.5-1-1.5-3 0-4 1.5-1 3.5-.5 5-2.5 1.5-2 2-3 2.5-4.5 1.5-3.5.5-5 .5-5s4.5-1 9 7z"/><circle cx="17" cy="14" r="1.5" fill="#1c1917"/></g></svg>`,
        P: `<svg viewBox="0 0 45 45"><g fill="#fff" stroke="#1c1917" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-2.78-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/></g></svg>`
    },
    black: {
        K: `<svg viewBox="0 0 45 45"><g fill="#1c1917" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22.5 11.63V6M20 8h5"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V23.5C20 16 10.5 13 6.5 19.5c-3 6 5.5 10.5 5.5 10.5v7z"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/></g></svg>`,
        Q: `<svg viewBox="0 0 45 45"><g fill="#1c1917" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M8 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm16.5-4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zM41 12a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm-29.5 4.5a2 2 0 1 1-4 0 2 2 0 1 1 4 0zm24 0a2 2 0 1 1-4 0 2 2 0 1 1 4 0z"/><path d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11-7.5-16-7.5 16-7-11 2 12zm0 5c9-1.5 18-1.5 27 0l1 5.5s-6.5 2.5-14.5 2.5-14.5-2.5-14.5-2.5L9 31z"/><path d="M11 38.5a35 35 0 0 0 23 0"/></g></svg>`,
        R: `<svg viewBox="0 0 45 45"><g fill="#1c1917" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 39h27v-3H9v3zm3-3v-4.5h21V36H12zm2-4.5l1.5-14h14l1.5 14H14zM11 14h23v-3H11v3zm1.5-3.5V7h3.5v2.5h4V7h5v2.5h4V7h3.5v3.5H12.5z"/></g></svg>`,
        B: `<svg viewBox="0 0 45 45"><g fill="#1c1917" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/><path d="M17.5 26h10M15 30h15m-7.5-14.5v5m-3-2.5h6"/></g></svg>`,
        N: `<svg viewBox="0 0 45 45"><g fill="#1c1917" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0-.932 1.49-1.5 2.5-.7 1.25-2.2 1.5-2.5 1-.5-1-1.5-3 0-4 1.5-1 3.5-.5 5-2.5 1.5-2 2-3 2.5-4.5 1.5-3.5.5-5 .5-5s4.5-1 9 7z"/><circle cx="17" cy="14" r="1.5" fill="#fff"/></g></svg>`,
        P: `<svg viewBox="0 0 45 45"><g fill="#1c1917" stroke="#fff" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-2.78-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/></g></svg>`
    }
};

/**
 * Render HTML for a piece, including SVG and Suit Badge
 */
function renderPieceElement(piece) {
    const el = document.createElement('div');
    el.className = `chess-piece ${piece.color}-piece ${piece.suit ? 'has-suit' : 'is-king'}`;
    el.dataset.id = piece.id;

    const svgContainer = document.createElement('div');
    svgContainer.className = 'piece-svg';
    svgContainer.innerHTML = PIECE_SVGS[piece.color][piece.type];
    el.appendChild(svgContainer);

    if (piece.suit && SUITS[piece.suit]) {
        const suitInfo = SUITS[piece.suit];
        const badge = document.createElement('div');
        badge.className = `suit-badge ${suitInfo.badgeClass}`;
        badge.textContent = suitInfo.symbol;
        badge.title = `${PIECE_NAMES[piece.type]} (${suitInfo.name})`;
        el.appendChild(badge);
    } else if (piece.type === 'K') {
        const crown = document.createElement('div');
        crown.className = 'king-crown-badge';
        crown.innerHTML = '★';
        crown.title = 'Король (любая масть)';
        el.appendChild(crown);
    }

    return el;
}


/**
 * Chess Durak - Board representation and coordinate helpers
 */

class Board {
    constructor() {
        // 8x8 grid, 0=Rank 8 (Black side), 7=Rank 1 (White side)
        this.grid = Array(8).fill(null).map(() => Array(8).fill(null));
    }

    static toNotation(r, c) {
        const file = String.fromCharCode('a'.charCodeAt(0) + c);
        const rank = 8 - r;
        return `${file}${rank}`;
    }

    static fromNotation(notation) {
        if (!notation || notation.length < 2) return null;
        const file = notation[0].toLowerCase();
        const rank = parseInt(notation[1], 10);
        const c = file.charCodeAt(0) - 'a'.charCodeAt(0);
        const r = 8 - rank;
        if (r >= 0 && r < 8 && c >= 0 && c < 8) {
            return { r, c };
        }
        return null;
    }

    isInBounds(r, c) {
        return r >= 0 && r < 8 && c >= 0 && c < 8;
    }

    getPiece(r, c) {
        if (!this.isInBounds(r, c)) return null;
        return this.grid[r][c];
    }

    setPiece(r, c, piece) {
        if (this.isInBounds(r, c)) {
            this.grid[r][c] = piece;
        }
    }

    removePiece(r, c) {
        if (this.isInBounds(r, c)) {
            const piece = this.grid[r][c];
            this.grid[r][c] = null;
            return piece;
        }
        return null;
    }

    findKing(color) {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.grid[r][c];
                if (piece && piece.type === 'K' && piece.color === color) {
                    return { r, c };
                }
            }
        }
        return null;
    }

    clone() {
        const newBoard = new Board();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.grid[r][c];
                if (p) {
                    newBoard.grid[r][c] = { ...p };
                }
            }
        }
        return newBoard;
    }

    /**
     * Set up the initial Chess Durak starting board:
     * - Random target value chosen from 7 to 51 (all 7 odd pieces sum to an odd number)
     * - White King at e1 (7, 4), Black King at e8 (0, 4)
     * - 7 pieces dealt to White summing to targetSum
     * - 7 pieces dealt to Black summing to targetSum
     * Returns targetSum.
     */
    setupInitialPosition(deck, targetSum = null) {
        if (!targetSum) {
            targetSum = getRandomStartingPoints();
        }

        // Clear grid
        this.grid = Array(8).fill(null).map(() => Array(8).fill(null));

        // Place Kings
        this.setPiece(7, 4, createPiece('K', 'white', null));
        this.setPiece(0, 4, createPiece('K', 'black', null));

        // Generate 7 pieces for White and 7 for Black with equal point values
        const whitePieces = generatePiecesWithSum(targetSum, 'white');
        const blackPieces = generatePiecesWithSum(targetSum, 'black');

        // Deal 7 pieces to White on Rank 1 (row 7)
        const whiteCols = [0, 1, 2, 3, 5, 6, 7];
        whiteCols.forEach((col, idx) => {
            this.setPiece(7, col, whitePieces[idx]);
        });

        // Deal 7 pieces to Black on Rank 8 (row 0)
        const blackCols = [0, 1, 2, 3, 5, 6, 7];
        blackCols.forEach((col, idx) => {
            this.setPiece(0, col, blackPieces[idx]);
        });

        // Sync bank deck: remove matching dealt cards where possible, and trim deck to 46 cards
        if (deck && deck.length > 0) {
            const allDealt = [...whitePieces, ...blackPieces];
            for (const piece of allDealt) {
                const cardIdx = deck.findIndex(c => c.type === piece.type && c.suit === piece.suit);
                if (cardIdx !== -1) {
                    deck.splice(cardIdx, 1);
                } else if (deck.length > 46) {
                    deck.pop();
                }
            }
            while (deck.length > 46) {
                deck.pop();
            }
        }

        return targetSum;
    }

    /**
     * Get all empty columns on a given base row
     */
    getEmptyBaseCols(row) {
        const emptyCols = [];
        for (let c = 0; c < 8; c++) {
            if (this.grid[row][c] === null) {
                emptyCols.push(c);
            }
        }
        return emptyCols;
    }
}


/**
 * Chess Durak - Core Rules, Move Validation, Suit Captures, Bank Spawning & Reserves
 */

class GameRules {
    /**
     * Check if a square (targetR, targetC) is geometrically attacked by pieces of attackerColor
     */
    static isSquareAttackedBy(board, targetR, targetC, attackerColor) {
        // 1. Check enemy Pawns
        const pawnDir = attackerColor === 'white' ? 1 : -1; // Where attacker pawn must be to attack
        const pawnSourceR = targetR + pawnDir;
        if (board.isInBounds(pawnSourceR, targetC - 1)) {
            const p = board.getPiece(pawnSourceR, targetC - 1);
            if (p && p.color === attackerColor && p.type === 'P') return true;
        }
        if (board.isInBounds(pawnSourceR, targetC + 1)) {
            const p = board.getPiece(pawnSourceR, targetC + 1);
            if (p && p.color === attackerColor && p.type === 'P') return true;
        }

        // 2. Check enemy Knights
        const knightOffsets = [
            [-2, -1], [-2, 1], [-1, -2], [-1, 2],
            [1, -2], [1, 2], [2, -1], [2, 1]
        ];
        for (const [dr, dc] of knightOffsets) {
            const nr = targetR + dr;
            const nc = targetC + dc;
            if (board.isInBounds(nr, nc)) {
                const p = board.getPiece(nr, nc);
                if (p && p.color === attackerColor && p.type === 'N') return true;
            }
        }

        // 3. Check enemy King
        const kingOffsets = [
            [-1, -1], [-1, 0], [-1, 1],
            [0, -1],           [0, 1],
            [1, -1],  [1, 0],  [1, 1]
        ];
        for (const [dr, dc] of kingOffsets) {
            const kr = targetR + dr;
            const kc = targetC + dc;
            if (board.isInBounds(kr, kc)) {
                const p = board.getPiece(kr, kc);
                if (p && p.color === attackerColor && p.type === 'K') return true;
            }
        }

        // 4. Check straight rays (Rook & Queen)
        const straightDirs = [[-1, 0], [1, 0], [0, -1], [0, 1]];
        for (const [dr, dc] of straightDirs) {
            let r = targetR + dr;
            let c = targetC + dc;
            while (board.isInBounds(r, c)) {
                const p = board.getPiece(r, c);
                if (p) {
                    if (p.color === attackerColor && (p.type === 'R' || p.type === 'Q')) {
                        return true;
                    }
                    break; // Blocked by any piece
                }
                r += dr;
                c += dc;
            }
        }

        // 5. Check diagonal rays (Bishop & Queen)
        const diagDirs = [[-1, -1], [-1, 1], [1, -1], [1, 1]];
        for (const [dr, dc] of diagDirs) {
            let r = targetR + dr;
            let c = targetC + dc;
            while (board.isInBounds(r, c)) {
                const p = board.getPiece(r, c);
                if (p) {
                    if (p.color === attackerColor && (p.type === 'B' || p.type === 'Q')) {
                        return true;
                    }
                    break; // Blocked by any piece
                }
                r += dr;
                c += dc;
            }
        }

        return false;
    }

    /**
     * Check if a player's King is in check
     */
    static isKingInCheck(board, color) {
        const kingPos = board.findKing(color);
        if (!kingPos) return false;
        const opponentColor = color === 'white' ? 'black' : 'white';
        return this.isSquareAttackedBy(board, kingPos.r, kingPos.c, opponentColor);
    }

    /**
     * Generate pseudo-legal moves for a piece at (r, c)
     * Enforces the Suit-Matching Capture Rule!
     */
    static getPseudoLegalMoves(board, r, c) {
        const piece = board.getPiece(r, c);
        if (!piece) return [];

        const moves = [];
        const { color, type, suit } = piece;

        // Helper to check if piece can capture target
        const canCapture = (targetPiece) => {
            if (!targetPiece || targetPiece.color === color) return false;
            // King can be attacked by any piece ("Любая фигура может дать шах королю")
            if (targetPiece.type === 'K') return true;
            // King attacker has no suit -> King can capture any enemy piece!
            if (type === 'K') return true;
            // Otherwise, must match suit!
            return targetPiece.suit === suit;
        };

        // 1. PAWN
        if (type === 'P') {
            const dir = color === 'white' ? -1 : 1;
            
            // Forward 1
            const nextR = r + dir;
            if (board.isInBounds(nextR, c) && board.getPiece(nextR, c) === null) {
                moves.push({ r: nextR, c });

                // Forward 2 from rank 1/2 (White) or rank 7/8 (Black)
                const isPawnStart = (color === 'white' && (r === 6 || r === 7)) ||
                                    (color === 'black' && (r === 1 || r === 0));
                const next2R = r + 2 * dir;
                if (isPawnStart && board.isInBounds(next2R, c) && board.getPiece(next2R, c) === null) {
                    moves.push({ r: next2R, c });
                }
            }

            // Diagonal captures
            const capCols = [c - 1, c + 1];
            for (const capC of capCols) {
                if (board.isInBounds(nextR, capC)) {
                    const target = board.getPiece(nextR, capC);
                    if (target && canCapture(target)) {
                        moves.push({ r: nextR, c: capC, isCapture: true });
                    }
                }
            }
        }

        // 2. KNIGHT
        else if (type === 'N') {
            const offsets = [
                [-2, -1], [-2, 1], [-1, -2], [-1, 2],
                [1, -2], [1, 2], [2, -1], [2, 1]
            ];
            for (const [dr, dc] of offsets) {
                const tr = r + dr;
                const tc = c + dc;
                if (board.isInBounds(tr, tc)) {
                    const target = board.getPiece(tr, tc);
                    if (target === null) {
                        moves.push({ r: tr, c: tc });
                    } else if (canCapture(target)) {
                        moves.push({ r: tr, c: tc, isCapture: true });
                    }
                }
            }
        }

        // 3. BISHOP, ROOK, QUEEN
        else if (type === 'B' || type === 'R' || type === 'Q') {
            const dirs = [];
            if (type === 'B' || type === 'Q') {
                dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
            }
            if (type === 'R' || type === 'Q') {
                dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
            }

            for (const [dr, dc] of dirs) {
                let tr = r + dr;
                let tc = c + dc;
                while (board.isInBounds(tr, tc)) {
                    const target = board.getPiece(tr, tc);
                    if (target === null) {
                        moves.push({ r: tr, c: tc });
                    } else {
                        if (canCapture(target)) {
                            moves.push({ r: tr, c: tc, isCapture: true });
                        }
                        // Stop raycast when hitting any piece
                        break;
                    }
                    tr += dr;
                    tc += dc;
                }
            }
        }

        // 4. KING
        else if (type === 'K') {
            const dirs = [
                [-1, -1], [-1, 0], [-1, 1],
                [0, -1],           [0, 1],
                [1, -1],  [1, 0],  [1, 1]
            ];
            for (const [dr, dc] of dirs) {
                const tr = r + dr;
                const tc = c + dc;
                if (board.isInBounds(tr, tc)) {
                    const target = board.getPiece(tr, tc);
                    if (target === null) {
                        moves.push({ r: tr, c: tc });
                    } else if (canCapture(target)) {
                        moves.push({ r: tr, c: tc, isCapture: true });
                    }
                }
            }
        }

        return moves;
    }

    /**
     * Get strictly legal moves for piece at (r, c) (filters moves that leave king in check)
     */
    static getLegalMoves(board, r, c) {
        const piece = board.getPiece(r, c);
        if (!piece) return [];

        const pseudoMoves = this.getPseudoLegalMoves(board, r, c);
        const legalMoves = [];

        for (const move of pseudoMoves) {
            // Simulate move
            const simBoard = board.clone();
            simBoard.removePiece(move.r, move.c);
            const simPiece = simBoard.removePiece(r, c);
            simBoard.setPiece(move.r, move.c, simPiece);

            // King cannot remain/enter in check
            if (!this.isKingInCheck(simBoard, piece.color)) {
                legalMoves.push(move);
            }
        }

        return legalMoves;
    }

    /**
     * Get all legal moves for a given player
     */
    static getAllLegalMoves(board, color) {
        const allMoves = [];
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board.getPiece(r, c);
                if (piece && piece.color === color) {
                    const moves = this.getLegalMoves(board, r, c);
                    for (const m of moves) {
                        allMoves.push({
                            from: { r, c },
                            to: { r: m.r, c: m.c },
                            piece,
                            isCapture: m.isCapture
                        });
                    }
                }
            }
        }
        return allMoves;
    }
}

/**
 * Game Engine managing game loop, bank, reserves, turn cycle, and notation
 */
class GameEngine {
    constructor() {
        this.board = new Board();
        this.deck = [];
        this.turn = 'white';
        this.whiteReserve = [];
        this.blackReserve = [];
        this.capturedWhite = [];
        this.capturedBlack = [];
        this.moveHistory = [];
        this.status = 'playing'; // 'playing' | 'check' | 'checkmate' | 'stalemate'
        this.winner = null;      // 'white' | 'black' | 'draw' | null
        this.lastMove = null;
        this.spawnEvents = [];   // Log of newly spawned pieces
        this.snapshots = [];     // State snapshots for undo
        this.delayedSpawns = []; // Pieces delayed by 1 turn because spawning gave check
        this.positionHistory = {}; // Key -> count for threefold repetition
        this.startingPoints = 0; // Total starting points per player
    }

    startNewGame(targetSum = null) {
        this.deck = createDeck();
        this.startingPoints = this.board.setupInitialPosition(this.deck, targetSum);
        this.turn = 'white';
        this.whiteReserve = [];
        this.blackReserve = [];
        this.capturedWhite = [];
        this.capturedBlack = [];
        this.moveHistory = [];
        this.status = 'playing';
        this.winner = null;
        this.lastMove = null;
        this.spawnEvents = [];
        this.snapshots = [];
        this.delayedSpawns = [];
        this.positionHistory = {};

        const initialKey = this.getPositionKey();
        this.positionHistory[initialKey] = 1;
    }

    /**
     * Creates a unique canonical key for the current game position
     */
    getPositionKey() {
        let key = `${this.turn}|`;
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board.grid[r][c];
                if (p) {
                    key += `${r}${c}:${p.color}${p.type}${p.suit || 'X'};`;
                }
            }
        }
        key += '|W_RES:';
        for (const p of this.whiteReserve) {
            key += `${p.type}${p.suit};`;
        }
        key += '|B_RES:';
        for (const p of this.blackReserve) {
            key += `${p.type}${p.suit};`;
        }
        return key;
    }

    /**
     * Undo last executed move and restore previous board state
     */
    undoMove() {
        if (!this.snapshots || this.snapshots.length === 0) {
            return false;
        }
        const prev = this.snapshots.pop();
        this.board = prev.board;
        this.turn = prev.turn;
        this.deck = prev.deck;
        this.whiteReserve = prev.whiteReserve;
        this.blackReserve = prev.blackReserve;
        this.capturedWhite = prev.capturedWhite;
        this.capturedBlack = prev.capturedBlack;
        this.moveHistory = prev.moveHistory;
        this.status = prev.status;
        this.winner = prev.winner;
        this.lastMove = prev.lastMove;
        this.spawnEvents = [];
        this.delayedSpawns = prev.delayedSpawns ? prev.delayedSpawns.map(d => ({ piece: { ...d.piece }, player: d.player })) : [];
        this.positionHistory = prev.positionHistory ? { ...prev.positionHistory } : {};
        return true;
    }

    /**
     * Execute a move from (fromR, fromC) to (toR, toC)
     * Optional promotionChoice: { type: 'Q'|'R'|'B'|'N', suit: 'spades'|'clubs'|'hearts'|'diamonds' }
     * Returns result object with move details
     */
    makeMove(fromR, fromC, toR, toC, promotionChoice = null) {
        if (this.status === 'checkmate' || this.status === 'stalemate') {
            return { success: false, reason: 'Game over' };
        }

        const piece = this.board.getPiece(fromR, fromC);
        if (!piece || piece.color !== this.turn) {
            return { success: false, reason: 'Not your turn or no piece' };
        }

        const legalMoves = GameRules.getLegalMoves(this.board, fromR, fromC);
        const isValid = legalMoves.some(m => m.r === toR && m.c === toC);
        if (!isValid) {
            return { success: false, reason: 'Illegal move' };
        }

        // Save state snapshot before mutating
        this.snapshots.push({
            board: this.board.clone(),
            turn: this.turn,
            deck: [...this.deck],
            whiteReserve: [...this.whiteReserve],
            blackReserve: [...this.blackReserve],
            capturedWhite: [...this.capturedWhite],
            capturedBlack: [...this.capturedBlack],
            moveHistory: [...this.moveHistory],
            status: this.status,
            winner: this.winner,
            lastMove: this.lastMove ? { ...this.lastMove } : null,
            delayedSpawns: this.delayedSpawns.map(d => ({ piece: { ...d.piece }, player: d.player })),
            positionHistory: { ...this.positionHistory }
        });

        this.spawnEvents = [];
        const movingColor = this.turn;
        const opponentColor = movingColor === 'white' ? 'black' : 'white';
        const capturedPiece = this.board.getPiece(toR, toC);

        // 1. Move piece
        this.board.removePiece(fromR, fromC);
        this.board.setPiece(toR, toC, piece);
        piece.hasMoved = true;

        // 2. Handle Pawn Promotion (any stronger piece + any suit chosen by player)
        let isPromotion = false;
        if (piece.type === 'P') {
            const promoRank = movingColor === 'white' ? 0 : 7;
            if (toR === promoRank) {
                isPromotion = true;
                if (promotionChoice && promotionChoice.type && promotionChoice.suit) {
                    piece.type = promotionChoice.type;
                    piece.suit = promotionChoice.suit;
                } else {
                    piece.type = 'Q'; // Fallback to Queen
                }
            }
        }

        // 3. Handle Capture and Opponent Bank Respawn / Reserve
        let spawnedForOpponent = null;
        if (capturedPiece) {
            if (capturedPiece.color === 'white') {
                this.capturedWhite.push(capturedPiece);
            } else {
                this.capturedBlack.push(capturedPiece);
            }

            // Opponent draws a replacement card from bank
            if (this.deck.length > 0) {
                const card = this.deck.pop();
                const replacementPiece = createPiece(card.type, opponentColor, card.suit);
                const baseRow = opponentColor === 'white' ? 7 : 0;
                const emptyCols = this.board.getEmptyBaseCols(baseRow);

                if (emptyCols.length > 0) {
                    // Random empty square on base rank
                    const chosenCol = emptyCols[Math.floor(Math.random() * emptyCols.length)];

                    // Check if spawning this piece immediately gives check to movingColor's king
                    this.board.setPiece(baseRow, chosenCol, replacementPiece);
                    const givesCheck = GameRules.isKingInCheck(this.board, movingColor);
                    this.board.removePiece(baseRow, chosenCol);

                    if (givesCheck) {
                        // Rule: "Фигура, что при появлении может дать шах королю, появляется через 1 ход, т.е. после хода игрока у которого она должна появится"
                        this.delayedSpawns.push({
                            piece: replacementPiece,
                            player: opponentColor
                        });
                        this.spawnEvents.push({
                            piece: replacementPiece,
                            player: opponentColor,
                            type: 'delayed_check_queued'
                        });
                    } else {
                        this.board.setPiece(baseRow, chosenCol, replacementPiece);
                        spawnedForOpponent = {
                            piece: replacementPiece,
                            r: baseRow,
                            c: chosenCol,
                            type: 'bank_spawn'
                        };
                        this.spawnEvents.push(spawnedForOpponent);
                    }
                } else {
                    // Base rank full -> goes to reserve
                    if (opponentColor === 'white') {
                        this.whiteReserve.push(replacementPiece);
                    } else {
                        this.blackReserve.push(replacementPiece);
                    }
                    this.spawnEvents.push({
                        piece: replacementPiece,
                        type: 'reserve_queued'
                    });
                }
            }
        }

        // 4. Handle Moving Player's Delayed Spawns (Rule: appears after the player's move)
        const movingBaseRow = movingColor === 'white' ? 7 : 0;
        const remainingDelayed = [];
        for (const delayed of this.delayedSpawns) {
            if (delayed.player === movingColor) {
                const emptyCols = this.board.getEmptyBaseCols(movingBaseRow);
                if (emptyCols.length > 0) {
                    const chosenCol = emptyCols[Math.floor(Math.random() * emptyCols.length)];
                    this.board.setPiece(movingBaseRow, chosenCol, delayed.piece);
                    this.spawnEvents.push({
                        piece: delayed.piece,
                        r: movingBaseRow,
                        c: chosenCol,
                        type: 'delayed_spawn_placed'
                    });
                } else {
                    if (movingColor === 'white') {
                        this.whiteReserve.push(delayed.piece);
                    } else {
                        this.blackReserve.push(delayed.piece);
                    }
                    this.spawnEvents.push({
                        piece: delayed.piece,
                        type: 'reserve_queued'
                    });
                }
            } else {
                remainingDelayed.push(delayed);
            }
        }
        this.delayedSpawns = remainingDelayed;

        // 5. Handle Moving Player's Reserve Auto-Spawn
        const reserve = movingColor === 'white' ? this.whiteReserve : this.blackReserve;
        if (reserve.length > 0) {
            const emptyCols = this.board.getEmptyBaseCols(movingBaseRow);
            if (emptyCols.length > 0) {
                const reservePiece = reserve.shift();
                let chosenCol = (fromR === movingBaseRow && emptyCols.includes(fromC)) 
                    ? fromC 
                    : emptyCols[0];

                this.board.setPiece(movingBaseRow, chosenCol, reservePiece);
                this.spawnEvents.push({
                    piece: reservePiece,
                    r: movingBaseRow,
                    c: chosenCol,
                    type: 'reserve_spawn'
                });
            }
        }

        // 6. Check Game Status for Opponent
        const isOpponentInCheck = GameRules.isKingInCheck(this.board, opponentColor);
        const opponentMoves = GameRules.getAllLegalMoves(this.board, opponentColor);

        let moveNotation = this.formatNotation(piece, fromR, fromC, toR, toC, capturedPiece, isPromotion, isOpponentInCheck, opponentMoves.length === 0);

        if (opponentMoves.length === 0) {
            if (isOpponentInCheck) {
                this.status = 'checkmate';
                this.winner = movingColor;
            } else {
                this.status = 'stalemate';
                this.winner = 'draw';
            }
        } else if (isOpponentInCheck) {
            this.status = 'check';
        } else {
            this.status = 'playing';
        }

        this.lastMove = {
            from: { r: fromR, c: fromC },
            to: { r: toR, c: toC },
            piece,
            captured: capturedPiece,
            notation: moveNotation,
            spawnEvents: [...this.spawnEvents]
        };

        this.moveHistory.push(this.lastMove);

        // 7. Switch turn and check Threefold Repetition
        this.turn = opponentColor;

        const currentPosKey = this.getPositionKey();
        this.positionHistory[currentPosKey] = (this.positionHistory[currentPosKey] || 0) + 1;
        const isThreefold = this.positionHistory[currentPosKey] >= 3;

        return {
            success: true,
            lastMove: this.lastMove,
            status: this.status,
            winner: this.winner,
            threefold: isThreefold,
            positionKey: currentPosKey
        };
    }

    formatNotation(piece, fromR, fromC, toR, toC, captured, isPromotion, isCheck, isCheckmate) {
        const fromNot = Board.toNotation(fromR, fromC);
        const toNot = Board.toNotation(toR, toC);
        const pieceSymbol = piece.type === 'P' ? '' : (piece.type === 'N' ? 'N' : piece.type);
        const suitSymbol = piece.suit ? SUITS[piece.suit].symbol : '';
        const capSymbol = captured ? 'x' : '-';
        let notStr = `${pieceSymbol}${suitSymbol ? suitSymbol : ''}${fromNot}${capSymbol}${toNot}`;
        if (isPromotion) {
            const promoPieceSym = piece.type === 'N' ? 'N' : piece.type;
            const promoSuitSym = piece.suit ? SUITS[piece.suit].symbol : '';
            notStr += `=${promoPieceSym}${promoSuitSym}`;
        }
        if (isCheckmate) notStr += '#';
        else if (isCheck) notStr += '+';
        return notStr;
    }
}


/**
 * Chess Durak - Intelligent AI Engine
 */

class ChessDurakAI {
    constructor(engine) {
        this.engine = engine;
    }

    /**
     * Choose the best move for the AI color
     */
    findBestMove(color, difficulty = 'medium') {
        const legalMoves = GameRules.getAllLegalMoves(this.engine.board, color);
        if (legalMoves.length === 0) return null;

        if (difficulty === 'easy') {
            // Easy: prioritize captures, otherwise random
            const captures = legalMoves.filter(m => m.isCapture);
            if (captures.length > 0 && Math.random() < 0.7) {
                return captures[Math.floor(Math.random() * captures.length)];
            }
            return legalMoves[Math.floor(Math.random() * legalMoves.length)];
        }

        const isHard = (difficulty === 'hard');
        const depth = isHard ? 3 : 2;

        // Order moves so alpha-beta cuts off subtrees effectively
        const orderedMoves = this.orderMoves(this.engine.board, legalMoves, color, isHard);

        let bestMove = null;
        let bestScore = -Infinity;
        const opponentColor = color === 'white' ? 'black' : 'white';

        for (const move of orderedMoves) {
            // Simulate move
            const simBoard = this.engine.board.clone();
            const movingPiece = simBoard.getPiece(move.from.r, move.from.c);

            simBoard.removePiece(move.to.r, move.to.c);
            simBoard.removePiece(move.from.r, move.from.c);
            simBoard.setPiece(move.to.r, move.to.c, movingPiece);

            // Handle promotion in sim
            if (movingPiece.type === 'P' && (move.to.r === 0 || move.to.r === 7)) {
                movingPiece.type = 'Q';
            }

            const score = this.minimax(simBoard, depth - 1, -Infinity, Infinity, false, color, opponentColor, isHard);

            if (score > bestScore) {
                bestScore = score;
                bestMove = move;
            }
        }

        const finalMove = bestMove || legalMoves[0];

        if (finalMove && finalMove.piece.type === 'P' && (finalMove.to.r === 0 || finalMove.to.r === 7)) {
            finalMove.promotionChoice = {
                type: 'Q',
                suit: this.getBestPromotionSuit(this.engine.board, opponentColor)
            };
        }

        return finalMove;
    }

    /**
     * Orders moves with MVV-LVA (Most Valuable Victim - Least Valuable Attacker)
     */
    orderMoves(board, moves, color, isHard) {
        const scoredMoves = moves.map(m => {
            let priority = 0;
            const attacker = board.getPiece(m.from.r, m.from.c);
            const target = board.getPiece(m.to.r, m.to.c);

            if (m.isCapture && target) {
                const victimVal = PIECE_VALUES[target.type] || 100;
                const attackerVal = attacker ? (PIECE_VALUES[attacker.type] || 100) : 100;
                // Favor capturing valuable pieces with lower value pieces
                priority += 1000 + (victimVal - attackerVal * 0.1);
            }

            // Checks priority
            const simBoard = board.clone();
            const p = simBoard.getPiece(m.from.r, m.from.c);
            simBoard.removePiece(m.to.r, m.to.c);
            simBoard.removePiece(m.from.r, m.from.c);
            simBoard.setPiece(m.to.r, m.to.c, p);
            const oppColor = color === 'white' ? 'black' : 'white';
            if (GameRules.isKingInCheck(simBoard, oppColor)) {
                priority += 300;
            }

            if (p && p.type === 'P') {
                const rankProgress = color === 'white' ? (7 - m.to.r) : m.to.r;
                priority += rankProgress * 15;
            }

            // Add tiny random noise only in medium mode to vary play
            if (!isHard) {
                priority += Math.random() * 20;
            }

            return { move: m, priority };
        });

        scoredMoves.sort((a, b) => b.priority - a.priority);
        return scoredMoves.map(sm => sm.move);
    }

    getBestPromotionSuit(board, opponentColor) {
        const suitScores = { spades: 10, clubs: 10, hearts: 10, diamonds: 10 };
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board.getPiece(r, c);
                if (piece && piece.color === opponentColor && piece.suit) {
                    suitScores[piece.suit] += PIECE_VALUES[piece.type] || 100;
                }
            }
        }
        let bestSuit = 'spades';
        let maxScore = -1;
        for (const [suit, score] of Object.entries(suitScores)) {
            if (score > maxScore) {
                maxScore = score;
                bestSuit = suit;
            }
        }
        return bestSuit;
    }

    minimax(board, depth, alpha, beta, isMaximizing, myColor, opponentColor, isHard) {
        const myKingInCheck = GameRules.isKingInCheck(board, myColor);
        const oppKingInCheck = GameRules.isKingInCheck(board, opponentColor);

        const currentTurnColor = isMaximizing ? myColor : opponentColor;
        const legalMoves = GameRules.getAllLegalMoves(board, currentTurnColor);

        if (legalMoves.length === 0) {
            if (isMaximizing && myKingInCheck) return -99999 + (4 - depth); // Checkmated
            if (!isMaximizing && oppKingInCheck) return 99999 - (4 - depth); // Won
            return 0; // Stalemate
        }

        if (depth === 0) {
            return this.evaluateBoard(board, myColor, opponentColor, isHard);
        }

        const orderedMoves = isHard ? this.orderMoves(board, legalMoves, currentTurnColor, true) : legalMoves;

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of orderedMoves) {
                const simBoard = board.clone();
                const p = simBoard.getPiece(move.from.r, move.from.c);
                simBoard.removePiece(move.to.r, move.to.c);
                simBoard.removePiece(move.from.r, move.from.c);
                simBoard.setPiece(move.to.r, move.to.c, p);
                if (p.type === 'P' && (move.to.r === 0 || move.to.r === 7)) p.type = 'Q';

                const evaluation = this.minimax(simBoard, depth - 1, alpha, beta, false, myColor, opponentColor, isHard);
                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break;
            }
            return maxEval;
        } else {
            let minEval = Infinity;
            for (const move of orderedMoves) {
                const simBoard = board.clone();
                const p = simBoard.getPiece(move.from.r, move.from.c);
                simBoard.removePiece(move.to.r, move.to.c);
                simBoard.removePiece(move.from.r, move.from.c);
                simBoard.setPiece(move.to.r, move.to.c, p);
                if (p.type === 'P' && (move.to.r === 0 || move.to.r === 7)) p.type = 'Q';

                const evaluation = this.minimax(simBoard, depth - 1, alpha, beta, true, myColor, opponentColor, isHard);
                minEval = Math.min(minEval, evaluation);
                beta = Math.min(beta, evaluation);
                if (beta <= alpha) break;
            }
            return minEval;
        }
    }

    /**
     * Board heuristic evaluation function:
     * - In Medium: basic piece values, center control, check bonus.
     * - In Hard (Analytical): Durak suit-matching attack/defense analysis, piece safety, king threats.
     */
    evaluateBoard(board, myColor, opponentColor, isHard) {
        let score = 0;

        // Collect pieces for Durak suit threat evaluation
        const myPieces = [];
        const oppPieces = [];

        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = board.getPiece(r, c);
                if (!piece) continue;

                const val = PIECE_VALUES[piece.type] || 0;
                const centerDist = Math.abs(3.5 - r) + Math.abs(3.5 - c);
                const positionalBonus = (7 - centerDist) * 5;

                let advanceBonus = 0;
                if (piece.type === 'P') {
                    const rankProgress = piece.color === 'white' ? (7 - r) : r;
                    advanceBonus = rankProgress * 18;
                }

                const totalVal = val + positionalBonus + advanceBonus;

                if (piece.color === myColor) {
                    score += totalVal;
                    if (isHard) myPieces.push({ piece, r, c, val });
                } else {
                    score -= totalVal;
                    if (isHard) oppPieces.push({ piece, r, c, val });
                }
            }
        }

        // Checks bonus
        if (GameRules.isKingInCheck(board, opponentColor)) score += 150;
        if (GameRules.isKingInCheck(board, myColor)) score -= 150;

        // ANALYTICAL MODE (Hard): Durak suit-matching tactical threat matrix
        if (isHard) {
            // 1. Check if my pieces are threatened by matching-suit enemy pieces
            for (const myP of myPieces) {
                if (myP.piece.type === 'K') continue;

                for (const oppP of oppPieces) {
                    // In Chess Durak, can oppP capture myP?
                    // King can capture any piece; other pieces capture only identical suit
                    const canCapture = (oppP.piece.type === 'K') || (oppP.piece.suit && oppP.piece.suit === myP.piece.suit);
                    if (canCapture) {
                        if (GameRules.isSquareAttackedBy(board, myP.r, myP.c, opponentColor)) {
                            // If an enemy piece of lower or equal value attacks my piece, penalize heavily
                            score -= (myP.val * 0.65);
                            break;
                        }
                    }
                }
            }

            // 2. Check if enemy pieces are vulnerable to my matching-suit attacks
            for (const oppP of oppPieces) {
                if (oppP.piece.type === 'K') continue;

                for (const myP of myPieces) {
                    const canCapture = (myP.piece.type === 'K') || (myP.piece.suit && myP.piece.suit === oppP.piece.suit);
                    if (canCapture) {
                        if (GameRules.isSquareAttackedBy(board, oppP.r, oppP.c, myColor)) {
                            score += (oppP.val * 0.6);
                            break;
                        }
                    }
                }
            }

            // 3. Distance & pressure on enemy King
            const oppKingPos = board.findKing(opponentColor);
            if (oppKingPos) {
                for (const myP of myPieces) {
                    const dist = Math.abs(myP.r - oppKingPos.r) + Math.abs(myP.c - oppKingPos.c);
                    score += (8 - dist) * 4;
                }
            }
        }

        return score;
    }
}


/**
 * Chess Durak - Main Application Controller
 */

class ChessDurakApp {
    constructor() {
        this.engine = new GameEngine();
        this.ai = new ChessDurakAI(this.engine);

        this.gameMode = 'hotseat'; // 'hotseat' | 'ai-white' | 'ai-black' | 'tutorial'
        this.difficulty = 'medium';
        this.aiSelectedSide = 'white'; // 'white' | 'black' | 'random'
        this.aiSelectedDiff = 'medium';// 'easy' | 'medium' | 'hard'
        this.isFlipped = false;
        this.selectedSquare = null;    // { r, c }
        this.legalMoves = [];          // array of { r, c, isCapture }
        this.isAiThinking = false;
        this.hintSquares = null;       // { from: {r,c}, to: {r,c} }
        this.tutorialStep = 1;
        this.animatedPieceIds = new Set(); // Track pieces that already animated spawn

        this.initDOMElements();
        this.bindEvents();
        this.startNewGame();
    }

    initDOMElements() {
        this.dom = {
            board: document.getElementById('chessBoard'),
            boardContainer: document.getElementById('boardContainer'),
            ranksLeft: document.getElementById('ranksLeft'),
            ranksRight: document.getElementById('ranksRight'),
            filesTop: document.getElementById('filesTop'),
            filesBottom: document.getElementById('filesBottom'),
            deckCounter: document.getElementById('deckCounter'),
            bannerText: document.getElementById('bannerText'),

            // Top player
            topPlayerCard: document.getElementById('topPlayerCard'),
            topPlayerAvatar: document.getElementById('topPlayerAvatar'),
            topPlayerName: document.getElementById('topPlayerName'),
            topPlayerStatus: document.getElementById('topPlayerStatus'),
            topReserveCount: document.getElementById('topReserveCount'),
            topReserveSlots: document.getElementById('topReserveSlots'),
            topCapturesList: document.getElementById('topCapturesList'),

            // Bottom player
            bottomPlayerCard: document.getElementById('bottomPlayerCard'),
            bottomPlayerAvatar: document.getElementById('bottomPlayerAvatar'),
            bottomPlayerName: document.getElementById('bottomPlayerName'),
            bottomPlayerStatus: document.getElementById('bottomPlayerStatus'),
            bottomReserveCount: document.getElementById('bottomReserveCount'),
            bottomReserveSlots: document.getElementById('bottomReserveSlots'),
            bottomCapturesList: document.getElementById('bottomCapturesList'),

            // Controls
            newGameBtn: document.getElementById('newGameBtn'),
            flipBoardBtn: document.getElementById('flipBoardBtn'),
            soundToggleBtn: document.getElementById('soundToggleBtn'),
            soundIcon: document.getElementById('soundIcon'),
            rulesBtn: document.getElementById('rulesBtn'),
            closeRulesBtn: document.getElementById('closeRulesBtn'),
            gotItRulesBtn: document.getElementById('gotItRulesBtn'),
            rulesModal: document.getElementById('rulesModal'),

            // Promotion Modal
            promotionModal: document.getElementById('promotionModal'),
            promotionGrid: document.getElementById('promotionGrid'),

            // Mode buttons & AI Status
            modeButtons: document.querySelectorAll('.mode-btn'),
            modeHotseatBtn: document.getElementById('modeHotseatBtn'),
            modeAiBtn: document.getElementById('modeAiBtn'),
            modeTutorialBtn: document.getElementById('modeTutorialBtn'),
            aiActiveStatus: document.getElementById('aiActiveStatus'),
            aiStatusTag: document.getElementById('aiStatusTag'),
            changeAiSettingsBtn: document.getElementById('changeAiSettingsBtn'),

            // AI Settings Modal
            aiSettingsModal: document.getElementById('aiSettingsModal'),
            closeAiSettingsBtn: document.getElementById('closeAiSettingsBtn'),
            cancelAiSettingsBtn: document.getElementById('cancelAiSettingsBtn'),
            startAiGameBtn: document.getElementById('startAiGameBtn'),
            sideOptionBtns: document.querySelectorAll('.side-option-btn'),
            diffOptionBtns: document.querySelectorAll('.diff-option-btn'),

            // Tutorial Card & Modal
            tutorialCard: document.getElementById('tutorialCard'),
            tutorialTipText: document.getElementById('tutorialTipText'),
            tutorialHintBtn: document.getElementById('tutorialHintBtn'),
            tutorialUndoBtn: document.getElementById('tutorialUndoBtn'),
            openTutorialLessonsBtn: document.getElementById('openTutorialLessonsBtn'),
            tutorialModal: document.getElementById('tutorialModal'),
            closeTutorialBtn: document.getElementById('closeTutorialBtn'),
            tutorialPrevBtn: document.getElementById('tutorialPrevBtn'),
            tutorialNextBtn: document.getElementById('tutorialNextBtn'),
            tutorialStepDots: document.getElementById('tutorialStepDots'),
            tutorialSteps: document.querySelectorAll('.tutorial-step'),

            // History
            historyTableBody: document.getElementById('historyTableBody'),

            // Victory Modal
            victoryModal: document.getElementById('victoryModal'),
            closeVictoryBtn: document.getElementById('closeVictoryBtn'),
            viewBoardBtn: document.getElementById('viewBoardBtn'),
            victoryTitle: document.getElementById('victoryTitle'),
            victoryDesc: document.getElementById('victoryDesc'),
            victoryIcon: document.getElementById('victoryIcon'),
            playAgainBtn: document.getElementById('playAgainBtn'),

            // Draw Offer Modal (Threefold Repetition)
            drawOfferModal: document.getElementById('drawOfferModal'),
            acceptDrawBtn: document.getElementById('acceptDrawBtn'),
            declineDrawBtn: document.getElementById('declineDrawBtn')
        };
    }

    bindEvents() {
        this.dom.newGameBtn.addEventListener('click', () => this.startNewGame());
        this.dom.flipBoardBtn.addEventListener('click', () => this.toggleFlipBoard());
        
        this.dom.soundToggleBtn.addEventListener('click', () => {
            sounds.enabled = !sounds.enabled;
            this.dom.soundIcon.textContent = sounds.enabled ? '🔊' : '🔇';
        });

        // Rules modal
        this.dom.rulesBtn.addEventListener('click', () => this.dom.rulesModal.classList.add('open'));
        this.dom.closeRulesBtn.addEventListener('click', () => this.dom.rulesModal.classList.remove('open'));
        this.dom.gotItRulesBtn.addEventListener('click', () => this.dom.rulesModal.classList.remove('open'));

        // Victory modal controls
        this.dom.playAgainBtn.addEventListener('click', () => {
            this.dom.victoryModal.classList.remove('open');
            this.startNewGame();
        });
        if (this.dom.closeVictoryBtn) {
            this.dom.closeVictoryBtn.addEventListener('click', () => this.dom.victoryModal.classList.remove('open'));
        }
        if (this.dom.viewBoardBtn) {
            this.dom.viewBoardBtn.addEventListener('click', () => this.dom.victoryModal.classList.remove('open'));
        }
        this.dom.victoryModal.addEventListener('click', (e) => {
            if (e.target === this.dom.victoryModal) {
                this.dom.victoryModal.classList.remove('open');
            }
        });

        // Draw offer modal controls (Threefold Repetition)
        if (this.dom.acceptDrawBtn) {
            this.dom.acceptDrawBtn.addEventListener('click', () => {
                this.dom.drawOfferModal.classList.remove('open');
                this.engine.status = 'stalemate';
                this.engine.winner = 'draw';
                this.showVictoryModal('Ничья!', 'Партия завершена ничьей по соглашению игроков (троекратное повторение позиции).');
            });
        }
        if (this.dom.declineDrawBtn) {
            this.dom.declineDrawBtn.addEventListener('click', () => {
                this.dom.drawOfferModal.classList.remove('open');
            });
        }
        if (this.dom.drawOfferModal) {
            this.dom.drawOfferModal.addEventListener('click', (e) => {
                if (e.target === this.dom.drawOfferModal) {
                    this.dom.drawOfferModal.classList.remove('open');
                }
            });
        }

        // Mode Switching: Hotseat
        this.dom.modeHotseatBtn.addEventListener('click', () => {
            this.setActiveModeBtn(this.dom.modeHotseatBtn);
            this.gameMode = 'hotseat';
            this.dom.aiActiveStatus.style.display = 'none';
            this.dom.tutorialCard.style.display = 'none';
            this.isFlipped = false;
            this.startNewGame();
        });

        // Mode Switching: AI
        this.dom.modeAiBtn.addEventListener('click', () => {
            this.dom.aiSettingsModal.classList.add('open');
        });
        this.dom.changeAiSettingsBtn.addEventListener('click', () => {
            this.dom.aiSettingsModal.classList.add('open');
        });
        this.dom.closeAiSettingsBtn.addEventListener('click', () => {
            this.dom.aiSettingsModal.classList.remove('open');
        });
        this.dom.cancelAiSettingsBtn.addEventListener('click', () => {
            this.dom.aiSettingsModal.classList.remove('open');
        });

        // AI Side Selection
        this.dom.sideOptionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.sideOptionBtns.forEach(b => b.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                this.aiSelectedSide = target.dataset.side;
            });
        });

        // AI Difficulty Selection
        this.dom.diffOptionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.dom.diffOptionBtns.forEach(b => b.classList.remove('active'));
                const target = e.currentTarget;
                target.classList.add('active');
                this.aiSelectedDiff = target.dataset.diff;
            });
        });

        // Start AI Game Button
        this.dom.startAiGameBtn.addEventListener('click', () => {
            this.dom.aiSettingsModal.classList.remove('open');
            this.setActiveModeBtn(this.dom.modeAiBtn);
            this.difficulty = this.aiSelectedDiff;

            let chosenSide = this.aiSelectedSide;
            if (chosenSide === 'random') {
                chosenSide = Math.random() < 0.5 ? 'white' : 'black';
            }

            if (chosenSide === 'white') {
                this.gameMode = 'ai-white';
                this.isFlipped = false;
            } else {
                this.gameMode = 'ai-black';
                this.isFlipped = true;
            }

            const diffNames = { easy: 'Новичок', medium: 'Гроссмейстер', hard: 'Аналитик' };
            const sideName = chosenSide === 'white' ? 'Белые' : 'Чёрные';
            this.dom.aiStatusTag.textContent = `🤖 ИИ: ${diffNames[this.difficulty]} (вы: ${sideName})`;
            this.dom.aiActiveStatus.style.display = 'flex';
            this.dom.tutorialCard.style.display = 'none';

            this.startNewGame();
        });

        // Mode Switching: Tutorial Mode
        this.dom.modeTutorialBtn.addEventListener('click', () => {
            this.setActiveModeBtn(this.dom.modeTutorialBtn);
            this.gameMode = 'tutorial';
            this.dom.aiActiveStatus.style.display = 'none';
            this.dom.tutorialCard.style.display = 'block';
            this.dom.tutorialTipText.textContent = '💡 Режим обучения: наводите на фигуры для подсветки целей, используйте подсказки и отмену ходов!';
            this.isFlipped = false;
            this.startNewGame();
        });

        // Tutorial Modal & Lessons
        this.dom.openTutorialLessonsBtn.addEventListener('click', () => {
            this.tutorialStep = 1;
            this.updateTutorialStepView();
            this.dom.tutorialModal.classList.add('open');
        });
        this.dom.closeTutorialBtn.addEventListener('click', () => {
            this.dom.tutorialModal.classList.remove('open');
        });
        this.dom.tutorialPrevBtn.addEventListener('click', () => {
            if (this.tutorialStep > 1) {
                this.tutorialStep--;
                this.updateTutorialStepView();
            }
        });
        this.dom.tutorialNextBtn.addEventListener('click', () => {
            if (this.tutorialStep < 4) {
                this.tutorialStep++;
                this.updateTutorialStepView();
            } else {
                this.dom.tutorialModal.classList.remove('open');
            }
        });

        // Tutorial In-Game Actions: Hint & Undo
        this.dom.tutorialHintBtn.addEventListener('click', () => {
            this.showTutorialHint();
        });
        this.dom.tutorialUndoBtn.addEventListener('click', () => {
            this.undoMove();
        });
    }

    setActiveModeBtn(activeBtn) {
        this.dom.modeButtons.forEach(b => b.classList.remove('active'));
        if (activeBtn) activeBtn.classList.add('active');
    }

    updateTutorialStepView() {
        this.dom.tutorialSteps.forEach((stepEl, idx) => {
            stepEl.classList.toggle('active', (idx + 1) === this.tutorialStep);
        });

        const dots = this.dom.tutorialStepDots.querySelectorAll('.dot');
        dots.forEach((d, idx) => {
            d.classList.toggle('active', (idx + 1) === this.tutorialStep);
        });

        this.dom.tutorialPrevBtn.disabled = (this.tutorialStep === 1);
        this.dom.tutorialNextBtn.textContent = (this.tutorialStep === 4) ? 'Понятно, играть!' : 'Далее →';
    }

    showTutorialHint() {
        if (this.isAiThinking) return;
        const bestMove = this.ai.findBestMove(this.engine.turn, 'hard');
        if (!bestMove) {
            this.dom.tutorialTipText.textContent = 'Нет доступных ходов.';
            return;
        }

        this.hintSquares = { from: bestMove.from, to: bestMove.to };
        this.renderBoard();

        const p = this.engine.board.getPiece(bestMove.from.r, bestMove.from.c);
        const fromNot = Board.toNotation(bestMove.from.r, bestMove.from.c);
        const toNot = Board.toNotation(bestMove.to.r, bestMove.to.c);
        const suitName = p.suit ? SUITS[p.suit].name : 'без масти';
        const cap = this.engine.board.getPiece(bestMove.to.r, bestMove.to.c);

        if (cap) {
            this.dom.tutorialTipText.textContent = `💡 Подсказка: ${PIECE_NAMES[p.type]} (${suitName}) с ${fromNot} может срубить фигуру на ${toNot}!`;
        } else {
            this.dom.tutorialTipText.textContent = `💡 Подсказка: рекомендуем ход ${PIECE_NAMES[p.type]} (${suitName}) с ${fromNot} на ${toNot}.`;
        }
        sounds.check();
    }

    undoMove() {
        if (this.isAiThinking) return;
        this.hintSquares = null;

        const success = this.engine.undoMove();
        if (!success) {
            if (this.gameMode === 'tutorial') {
                this.dom.tutorialTipText.textContent = 'Вы в начале партии, ходов для отмены нет.';
            }
            return;
        }

        // If playing against AI, undo once more if we landed on AI's turn
        if ((this.gameMode === 'ai-white' || this.gameMode === 'ai-black') && this.isAiTurn()) {
            this.engine.undoMove();
        }

        this.selectedSquare = null;
        this.legalMoves = [];
        this.renderAll();
        this.rebuildHistoryTable();
        sounds.move();

        if (this.gameMode === 'tutorial') {
            this.dom.tutorialTipText.textContent = '↩ Ход успешно отменён! Вы можете попробовать другой вариант.';
        }
    }

    isAiTurn() {
        return (this.gameMode === 'ai-white' && this.engine.turn === 'black') ||
               (this.gameMode === 'ai-black' && this.engine.turn === 'white');
    }

    rebuildHistoryTable() {
        this.dom.historyTableBody.innerHTML = '';
        for (let i = 0; i < this.engine.moveHistory.length; i++) {
            const move = this.engine.moveHistory[i];
            const moveNum = Math.floor(i / 2) + 1;
            const isWhite = (i % 2 === 0);

            if (isWhite) {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${moveNum}.</td>
                    <td><strong>${move.notation}</strong></td>
                    <td id="move-${moveNum}-black">-</td>
                `;
                this.dom.historyTableBody.appendChild(tr);
            } else {
                const blackTd = document.getElementById(`move-${moveNum}-black`);
                if (blackTd) {
                    blackTd.innerHTML = `<strong>${move.notation}</strong>`;
                }
            }
        }
    }

    startNewGame() {
        this.engine.startNewGame();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.hintSquares = null;
        this.isAiThinking = false;
        this.animatedPieceIds.clear();
        this.dom.historyTableBody.innerHTML = '';
        this.dom.victoryModal.classList.remove('open');
        if (this.dom.drawOfferModal) {
            this.dom.drawOfferModal.classList.remove('open');
        }
        if (this.dom.promotionModal) {
            this.dom.promotionModal.classList.remove('open');
        }

        this.renderAll();
        sounds.spawn();

        this.checkTriggerAI();
    }

    toggleFlipBoard() {
        this.isFlipped = !this.isFlipped;
        this.renderAll();
    }

    /**
     * Re-renders the entire UI state
     */
    renderAll() {
        this.renderBoard();
        this.renderPlayerPanels();
        this.renderDeck();
        this.renderStatusBanner();
    }

    renderBoard() {
        this.dom.board.innerHTML = '';
        this.dom.boardContainer.classList.toggle('flipped', this.isFlipped);
        this.renderCoordinates();

        const rows = this.isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
        const cols = this.isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

        const kingInCheck = this.engine.status === 'check' || this.engine.status === 'checkmate';
        const inCheckKingPos = kingInCheck ? this.engine.board.findKing(this.engine.turn) : null;

        for (const r of rows) {
            for (const c of cols) {
                const square = document.createElement('div');
                const isLight = (r + c) % 2 === 0;
                square.className = `square ${isLight ? 'light' : 'dark'}`;
                square.dataset.row = r;
                square.dataset.col = c;

                // Highlights
                if (this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c) {
                    square.classList.add('selected');
                }

                if (this.engine.lastMove) {
                    if (this.engine.lastMove.from.r === r && this.engine.lastMove.from.c === c) {
                        square.classList.add('last-move-from');
                    }
                    if (this.engine.lastMove.to.r === r && this.engine.lastMove.to.c === c) {
                        square.classList.add('last-move-to');
                    }
                }

                if (inCheckKingPos && inCheckKingPos.r === r && inCheckKingPos.c === c) {
                    square.classList.add('in-check');
                }

                // Hint Highlights
                if (this.hintSquares) {
                    if (this.hintSquares.from.r === r && this.hintSquares.from.c === c) {
                        square.classList.add('hint-from-square');
                    }
                    if (this.hintSquares.to.r === r && this.hintSquares.to.c === c) {
                        square.classList.add('hint-to-square');
                    }
                }

                // Legal move markers
                const legalMove = this.legalMoves.find(m => m.r === r && m.c === c);
                if (legalMove) {
                    if (legalMove.isCapture) {
                        const capInd = document.createElement('div');
                        capInd.className = 'capture-indicator';
                        square.appendChild(capInd);
                    } else {
                        const dot = document.createElement('div');
                        dot.className = 'move-indicator';
                        square.appendChild(dot);
                    }
                }

                // Render piece if present
                const piece = this.engine.board.getPiece(r, c);
                if (piece) {
                    const pieceEl = renderPieceElement(piece);

                    // Check if piece just spawned and hasn't played spawn animation yet
                    const wasSpawned = this.engine.spawnEvents.some(s => s.r === r && s.c === c);
                    if (wasSpawned && !this.animatedPieceIds.has(piece.id)) {
                        pieceEl.classList.add('just-spawned');
                        this.animatedPieceIds.add(piece.id);
                    }

                    square.appendChild(pieceEl);
                }

                // Click event
                square.addEventListener('click', () => this.handleSquareClick(r, c));

                // Hover target vision in Tutorial Mode
                if (this.gameMode === 'tutorial') {
                    square.addEventListener('mouseenter', () => {
                        const p = this.engine.board.getPiece(r, c);
                        if (p && p.color === this.engine.turn) {
                            this.highlightSuitTargets(p);
                        }
                    });
                    square.addEventListener('mouseleave', () => {
                        this.clearSuitTargets();
                    });
                }

                this.dom.board.appendChild(square);
            }
        }
    }

    highlightSuitTargets(piece) {
        this.clearSuitTargets();
        const opponentColor = piece.color === 'white' ? 'black' : 'white';
        const squares = this.dom.board.querySelectorAll('.square');
        squares.forEach(sq => {
            const sqR = parseInt(sq.dataset.row);
            const sqC = parseInt(sq.dataset.col);
            const targetPiece = this.engine.board.getPiece(sqR, sqC);
            if (targetPiece && targetPiece.color === opponentColor) {
                if (piece.type === 'K' || targetPiece.type === 'K' || (piece.suit && targetPiece.suit === piece.suit)) {
                    sq.classList.add('suit-target-match');
                }
            }
        });
    }

    clearSuitTargets() {
        const highlighted = this.dom.board.querySelectorAll('.square.suit-target-match');
        highlighted.forEach(sq => sq.classList.remove('suit-target-match'));
    }

    renderCoordinates() {
        const ranks = this.isFlipped ? [1, 2, 3, 4, 5, 6, 7, 8] : [8, 7, 6, 5, 4, 3, 2, 1];
        const files = this.isFlipped ? ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] : ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];

        if (this.dom.ranksLeft) {
            this.dom.ranksLeft.innerHTML = ranks.map(r => `<span>${r}</span>`).join('');
        }
        if (this.dom.ranksRight) {
            this.dom.ranksRight.innerHTML = ranks.map(r => `<span>${r}</span>`).join('');
        }
        if (this.dom.filesTop) {
            this.dom.filesTop.innerHTML = files.map(f => `<span>${f}</span>`).join('');
        }
        if (this.dom.filesBottom) {
            this.dom.filesBottom.innerHTML = files.map(f => `<span>${f}</span>`).join('');
        }
    }

    handleSquareClick(r, c) {
        if (this.isAiThinking) return;
        if (this.engine.status === 'checkmate' || this.engine.status === 'stalemate') return;

        // Check if it's user's turn in AI mode
        if (this.gameMode === 'ai-white' && this.engine.turn === 'black') return;
        if (this.gameMode === 'ai-black' && this.engine.turn === 'white') return;

        const clickedPiece = this.engine.board.getPiece(r, c);

        // Case 1: Square is a legal move target for currently selected piece
        if (this.selectedSquare) {
            const isTarget = this.legalMoves.some(m => m.r === r && m.c === c);
            if (isTarget) {
                const fromR = this.selectedSquare.r;
                const fromC = this.selectedSquare.c;
                const movingPiece = this.engine.board.getPiece(fromR, fromC);

                // Check for Pawn Promotion
                const isPromo = movingPiece && movingPiece.type === 'P' && (
                    (movingPiece.color === 'white' && r === 0) ||
                    (movingPiece.color === 'black' && r === 7)
                );

                if (isPromo) {
                    this.selectedSquare = null;
                    this.legalMoves = [];
                    this.renderBoard();
                    this.showPromotionModal(movingPiece.color, (choice) => {
                        this.executeMove(fromR, fromC, r, c, choice);
                    });
                    return;
                }

                this.executeMove(fromR, fromC, r, c);
                return;
            }
        }

        // Case 2: Clicked on a piece belonging to current turn
        if (clickedPiece && clickedPiece.color === this.engine.turn) {
            if (this.selectedSquare && this.selectedSquare.r === r && this.selectedSquare.c === c) {
                // Deselect
                this.selectedSquare = null;
                this.legalMoves = [];
            } else {
                // Select piece and calculate legal moves
                this.selectedSquare = { r, c };
                this.legalMoves = GameRules.getLegalMoves(this.engine.board, r, c);
                sounds.init();
            }
            this.renderBoard();
            return;
        }

        // Case 3: Clicked elsewhere
        this.selectedSquare = null;
        this.legalMoves = [];
        this.renderBoard();
    }

    showPromotionModal(color, onSelect) {
        const grid = this.dom.promotionGrid;
        grid.innerHTML = '';

        const pieceTypes = ['Q', 'R', 'B', 'N'];
        const suitKeys = ['spades', 'clubs', 'hearts', 'diamonds'];

        pieceTypes.forEach(type => {
            suitKeys.forEach(suit => {
                const btn = document.createElement('button');
                btn.className = 'promotion-option-btn';
                btn.title = `${PIECE_NAMES[type]} (${SUITS[suit].name})`;
                btn.innerHTML = `
                    <div class="piece-svg">${PIECE_SVGS[color][type]}</div>
                    <div class="suit-badge suit-${suit}">${SUITS[suit].symbol}</div>
                `;

                btn.addEventListener('click', () => {
                    this.dom.promotionModal.classList.remove('open');
                    sounds.spawn();
                    onSelect({ type, suit });
                });

                grid.appendChild(btn);
            });
        });

        this.dom.promotionModal.classList.add('open');
    }

    executeMove(fromR, fromC, toR, toC, promotionChoice = null) {
        this.hintSquares = null;
        this.clearSuitTargets();

        const result = this.engine.makeMove(fromR, fromC, toR, toC, promotionChoice);
        if (!result.success) return;

        this.selectedSquare = null;
        this.legalMoves = [];

        // Play sound effects
        if (result.status === 'checkmate') {
            sounds.victory();
        } else if (result.status === 'check') {
            sounds.check();
        } else if (result.lastMove.captured) {
            sounds.capture();
        } else if (result.lastMove.spawnEvents && result.lastMove.spawnEvents.length > 0) {
            sounds.spawn();
        } else {
            sounds.move();
        }

        this.addHistoryEntry(result.lastMove);
        this.renderAll();

        // Check Victory
        if (result.status === 'checkmate') {
            const winnerName = result.winner === 'white' ? 'Белых' : 'Чёрных';
            this.showVictoryModal(`Мат! Победа ${winnerName}`, `Игрок (${winnerName}) поставил мат сопернику.`);
            return;
        } else if (result.status === 'stalemate') {
            this.showVictoryModal(`Пат! Ничья`, `У игрока нет доступных ходов, но король не под шахом.`);
            return;
        }

        // Threefold Repetition Check
        if (result.threefold) {
            if (this.gameMode === 'ai-white' || this.gameMode === 'ai-black') {
                const isPlayerWhite = (this.gameMode === 'ai-white');
                this.engine.status = 'checkmate';
                this.engine.winner = isPlayerWhite ? 'black' : 'white';
                sounds.check();
                this.showVictoryModal('Поражение игроку!', 'Зафиксировано троекратное повторение позиции. При игре против ИИ засчитано поражение игроку.');
                return;
            } else {
                if (this.dom.drawOfferModal) {
                    this.dom.drawOfferModal.classList.add('open');
                }
                return;
            }
        }

        // Trigger AI if necessary
        this.checkTriggerAI();
    }

    checkTriggerAI() {
        const isAiTurn = (this.gameMode === 'ai-white' && this.engine.turn === 'black') ||
                         (this.gameMode === 'ai-black' && this.engine.turn === 'white');

        if (isAiTurn && this.engine.status !== 'checkmate' && this.engine.status !== 'stalemate') {
            this.isAiThinking = true;
            this.dom.bannerText.textContent = `Компьютер думает... 🤔`;

            setTimeout(() => {
                const bestMove = this.ai.findBestMove(this.engine.turn, this.difficulty);
                this.isAiThinking = false;
                if (bestMove) {
                    this.executeMove(bestMove.from.r, bestMove.from.c, bestMove.to.r, bestMove.to.c, bestMove.promotionChoice);
                }
            }, 650);
        }
    }

    renderPlayerPanels() {
        const topColor = this.isFlipped ? 'white' : 'black';
        const bottomColor = this.isFlipped ? 'black' : 'white';

        // Top Player
        this.renderPlayerPanel(
            topColor,
            this.dom.topPlayerCard,
            this.dom.topPlayerAvatar,
            this.dom.topPlayerName,
            this.dom.topPlayerStatus,
            this.dom.topReserveCount,
            this.dom.topReserveSlots,
            this.dom.topCapturesList
        );

        // Bottom Player
        this.renderPlayerPanel(
            bottomColor,
            this.dom.bottomPlayerCard,
            this.dom.bottomPlayerAvatar,
            this.dom.bottomPlayerName,
            this.dom.bottomPlayerStatus,
            this.dom.bottomReserveCount,
            this.dom.bottomReserveSlots,
            this.dom.bottomCapturesList
        );
    }

    renderPlayerPanel(color, cardEl, avatarEl, nameEl, statusEl, reserveCountEl, reserveSlotsEl, capturesListEl) {
        const isTurn = this.engine.turn === color;
        cardEl.classList.toggle('active-turn', isTurn);

        const isWhite = color === 'white';
        let displayName = isWhite ? 'Белые' : 'Чёрные';

        if (avatarEl) {
            avatarEl.className = `player-avatar ${isWhite ? 'white-avatar' : 'black-avatar'}`;
            avatarEl.textContent = isWhite ? '♔' : '♚';
        }

        if (this.gameMode === 'ai-white') {
            displayName = isWhite ? 'Игрок (Белые)' : 'Компьютер (Чёрные)';
        } else if (this.gameMode === 'ai-black') {
            displayName = isWhite ? 'Компьютер (Белые)' : 'Игрок (Чёрные)';
        }
        nameEl.textContent = displayName;

        if (isTurn) {
            const inCheck = this.engine.status === 'check';
            statusEl.textContent = inCheck ? '⚠️ Король под шахом!' : 'Ваш ход';
            statusEl.style.color = inCheck ? '#f43f5e' : '#fbbf24';
        } else {
            statusEl.textContent = 'Ожидание хода';
            statusEl.style.color = 'var(--text-secondary)';
        }

        const delayedForPlayer = (this.engine.delayedSpawns || []).filter(d => d.player === color);
        if (delayedForPlayer.length > 0) {
            statusEl.textContent += ` [⏳ ${delayedForPlayer.length} в очереди]`;
        }

        // Reserves
        const reserve = isWhite ? this.engine.whiteReserve : this.engine.blackReserve;
        reserveCountEl.textContent = reserve.length;
        reserveSlotsEl.innerHTML = '';

        if (reserve.length === 0) {
            reserveSlotsEl.innerHTML = '<span class="empty-reserve-hint">Пусто</span>';
        } else {
            reserve.forEach(p => {
                const miniCard = document.createElement('div');
                miniCard.className = 'mini-piece-card';
                miniCard.innerHTML = `
                    <div class="piece-svg">${PIECE_SVGS[p.color][p.type]}</div>
                    <div class="suit-badge suit-${p.suit}">${SUITS[p.suit].symbol}</div>
                `;
                miniCard.title = `${PIECE_NAMES[p.type]} (${SUITS[p.suit].name}) в резерве`;
                reserveSlotsEl.appendChild(miniCard);
            });
        }

        // Captures
        const captures = isWhite ? this.engine.capturedBlack : this.engine.capturedWhite;
        capturesListEl.innerHTML = '';
        captures.forEach(c => {
            const capSpan = document.createElement('span');
            capSpan.className = 'capture-item';
            const sym = c.suit ? SUITS[c.suit].symbol : '';
            capSpan.innerHTML = `<strong>${c.type}</strong><span style="color:${c.suit ? SUITS[c.suit].color : '#fff'}">${sym}</span>`;
            capturesListEl.appendChild(capSpan);
        });
    }

    renderDeck() {
        this.dom.deckCounter.textContent = this.engine.deck.length;
    }

    renderStatusBanner() {
        if (this.isAiThinking) return;

        const isWhite = this.engine.turn === 'white';
        let text = isWhite ? 'Ход Белых' : 'Ход Чёрных';

        if (this.engine.startingPoints) {
            text += ` | Раздача: ${this.engine.startingPoints} очков`;
        }

        if (this.engine.delayedSpawns && this.engine.delayedSpawns.length > 0) {
            text += ` [⏳ Отложено фигур: ${this.engine.delayedSpawns.length}]`;
        }

        if (this.engine.status === 'check') {
            text += ' ⚠️ (ШАХ!)';
        } else if (this.engine.status === 'checkmate') {
            text = `🏆 МАТ! Победа ${this.engine.winner === 'white' ? 'Белых' : 'Чёрных'}`;
        }

        this.dom.bannerText.textContent = text;
    }

    addHistoryEntry(lastMove) {
        const moveNum = Math.ceil(this.engine.moveHistory.length / 2);
        const isWhite = lastMove.piece.color === 'white';

        if (isWhite) {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${moveNum}.</td>
                <td><strong>${lastMove.notation}</strong></td>
                <td id="move-${moveNum}-black">-</td>
            `;
            this.dom.historyTableBody.appendChild(tr);
        } else {
            const blackTd = document.getElementById(`move-${moveNum}-black`);
            if (blackTd) {
                blackTd.innerHTML = `<strong>${lastMove.notation}</strong>`;
            }
        }

        // Auto-scroll history to bottom
        const container = document.querySelector('.history-table-container');
        if (container) {
            container.scrollTop = container.scrollHeight;
        }
    }

    showVictoryModal(title, desc) {
        this.dom.victoryTitle.textContent = title;
        this.dom.victoryDesc.textContent = desc;
        this.dom.victoryModal.classList.add('open');
    }
}

// Instantiate and start app
window.addEventListener('DOMContentLoaded', () => {
    window.chessDurakApp = new ChessDurakApp();
});

