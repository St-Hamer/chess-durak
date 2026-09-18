/**
 * Chess Durak - Piece and Suit Definitions
 */

export const SUITS = {
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

export const PIECE_VALUES = {
    P: 100,
    N: 320,
    B: 330,
    R: 500,
    Q: 900,
    K: 20000
};

export const PIECE_NAMES = {
    P: 'Пешка',
    N: 'Конь',
    B: 'Слон',
    R: 'Ладья',
    Q: 'Ферзь',
    K: 'Король'
};

let pieceCounter = 1;

export function createPiece(type, color, suit = null) {
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
export function createDeck() {
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

export const PIECE_VALUES_MAP = {
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
export function getRandomStartingPoints() {
    const oddSums = [];
    for (let s = 7; s <= 51; s += 2) {
        oddSums.push(s);
    }
    return oddSums[Math.floor(Math.random() * oddSums.length)];
}

/**
 * Generates 7 suited pieces for a player such that their total value equals targetSum.
 */
export function generatePiecesWithSum(targetSum, color) {
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
export const PIECE_SVGS = {
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
export function renderPieceElement(piece) {
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
