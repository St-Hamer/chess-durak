/**
 * Chess Durak - Complete All-in-One Game Engine & Controller
 * Works both via file:// (double-click in explorer) and HTTP servers.
 * Google Fonts are loaded from the internet; without a network connection
 * the game keeps working with the fallback font stack from style.css.
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
function createPiece(type, color, suit = null, squareColor = null) {
    return {
        id: `p_${pieceCounter++}`,
        type,
        color, // 'white' | 'black'
        suit,  // 'spades' | 'clubs' | 'hearts' | 'diamonds' | null
        squareColor, // 'light' | 'dark' | null (strictly for 'B')
        hasMoved: false
    };
}
const ALL_BISHOP_TOKENS = [
    { suit: 'spades', squareColor: 'light' },
    { suit: 'spades', squareColor: 'dark' },
    { suit: 'clubs', squareColor: 'light' },
    { suit: 'clubs', squareColor: 'dark' },
    { suit: 'hearts', squareColor: 'light' },
    { suit: 'hearts', squareColor: 'dark' },
    { suit: 'diamonds', squareColor: 'light' },
    { suit: 'diamonds', squareColor: 'dark' }
];
const DECK_PIECE_COUNTS = Object.freeze({
    P: 4,
    N: 2,
    B: 2,
    R: 2,
    Q: 1
});
const ALL_PIECE_TYPES = ['P', 'N', 'B', 'R', 'Q'];
const STARTING_HAND_SIZE = 7;

const ALL_SUIT_IDS = Object.keys(SUITS);

/**
 * Normalizes a custom game selection. Invalid or duplicate values are ignored.
 * Missing arrays fall back to the full standard set.
 */
function normalizeDeckSelection(config = null) {
    const rawSuits = config && Array.isArray(config.suits) ? config.suits : ALL_SUIT_IDS;
    const rawPieces = config && Array.isArray(config.pieces) ? config.pieces : ALL_PIECE_TYPES;
    const suits = [...new Set(rawSuits)].filter(suit => ALL_SUIT_IDS.includes(suit));
    const pieces = [...new Set(rawPieces)].filter(type => ALL_PIECE_TYPES.includes(type));
    return { suits, pieces };
}

/** Total number of cards produced by the selected suits and piece types. */
function getDeckCardCount(config = null) {
    const { suits, pieces } = normalizeDeckSelection(config);
    const perSuit = pieces.reduce((sum, type) => sum + DECK_PIECE_COUNTS[type], 0);
    return suits.length * perSuit;
}

/** Maximum bank size: every deck must still provide 14 starting pieces. */
function getMaxBankSize(config = null) {
    return Math.max(0, getDeckCardCount(config) - 2 * STARTING_HAND_SIZE);
}

/**
 * Minimum number of extra random cards needed to reach a 14-piece starting
 * deal. The actual top-up may add more when the deal is structurally
 * impossible, so this value is only a lower bound for the UI.
 */
function getStartingDealShortfall(config = null) {
    return Math.max(
        0,
        2 * STARTING_HAND_SIZE - getDeckCardCount(config)
    );
}
function getDefaultGameConfig() {
    const selection = normalizeDeckSelection();
    return {
        suits: [...selection.suits],
        pieces: [...selection.pieces],
        bankSize: getMaxBankSize(selection)
    };
}

/**
 * Normalizes a full game configuration, including the bank size. When no bank
 * size is supplied, the maximum possible value is used.
 */
function normalizeGameConfig(config = null) {
    const selection = normalizeDeckSelection(config);
    const maxBank = getMaxBankSize(selection);
    const bankSize = config && Number.isFinite(config.bankSize)
        ? Math.trunc(config.bankSize)
        : maxBank;
    return {
        suits: [...selection.suits],
        pieces: [...selection.pieces],
        bankSize
    };
}

/**
 * Validates a configuration before a game is started. Throws a user-facing
 * error when the selection cannot produce a playable game.
 */
function validateGameConfig(config = null) {
    const normalized = normalizeGameConfig(config);
    if (normalized.suits.length === 0) {
        throw new Error('Выберите хотя бы одну масть.');
    }
    if (normalized.pieces.length === 0) {
        throw new Error('Выберите хотя бы один тип фигур.');
    }

    // A deck shorter than 14 cards is allowed: the missing pieces are topped
    // up randomly from the selected suits and types before the deal.
    const total = getDeckCardCount(normalized);
    const maxBank = Math.max(0, total - 2 * STARTING_HAND_SIZE);
    if (normalized.bankSize < 0 || normalized.bankSize > maxBank) {
        throw new Error(`Размер банка должен быть от 0 до ${maxBank}.`);
    }
    if (
        normalized.suits.length === 1 &&
        normalized.pieces.some(type => type === 'B' || type === 'R' || type === 'Q')
    ) {
        throw new Error(
            'С одной мастью нельзя использовать слонов, ладей или ферзей: ' +
            'на заполненных базовых горизонталях они всегда имеют доступное взятие. ' +
            'Добавьте ещё масти или оставьте только пешек и коней.'
        );
    }
    return normalized;
}

/**
 * Creates one random card from the selected suits and piece types, using the
 * same type weights as the standard deck. Bishops get a random square color.
 */
function createRandomSelectionCard(suits, pieces) {
    const suit = suits[Math.floor(Math.random() * suits.length)];
    const totalWeight = pieces.reduce(
        (sum, type) => sum + DECK_PIECE_COUNTS[type], 0
    );
    let roll = Math.random() * totalWeight;
    let type = pieces[pieces.length - 1];
    for (const candidate of pieces) {
        roll -= DECK_PIECE_COUNTS[candidate];
        if (roll < 0) { type = candidate; break; }
    }
    const card = { type, suit };
    if (type === 'B') {
        card.squareColor = Math.random() < 0.5 ? 'light' : 'dark';
    }
    return card;
}

/**
 * Tops up a custom deck so that a valid 14-piece starting deal can be formed.
 * The added cards use only the selected suits and piece types. Returns the
 * number of added cards. The standard 44-card selection is left untouched.
 */
function completeDeckForStartingDeal(deck, config = null) {
    const { suits, pieces } = normalizeDeckSelection(config);
    if (suits.length === 0 || pieces.length === 0) return 0;

    const isStandardSelection =
        suits.length === ALL_SUIT_IDS.length &&
        pieces.length === ALL_PIECE_TYPES.length;
    if (isStandardSelection && deck.length >= 2 * STARTING_HAND_SIZE) return 0;

    const initialLength = deck.length;

    // Every selected suit must be present in both hands.
    for (const suit of suits) {
        while (deck.filter(card => card.suit === suit).length < 2) {
            deck.push(createRandomSelectionCard([suit], pieces));
        }
    }

    // Both hands together need at least 14 cards.
    while (deck.length < 2 * STARTING_HAND_SIZE) {
        deck.push(createRandomSelectionCard(suits, pieces));
    }

    const canDeal = () => {
        try {
            dealPiecesFromDeck(deck.slice(), null, config);
            return true;
        } catch {
            return false;
        }
    };

    let guard = 0;
    while (!canDeal()) {
        if (++guard > 200) {
            throw new Error(
                'Не удалось подобрать добор фигур для выбранных настроек. ' +
                'Попробуйте изменить набор мастей или типов.'
            );
        }
        deck.push(createRandomSelectionCard(suits, pieces));
    }

    const added = deck.length - initialLength;
    if (added > 0) {
        // Added cards must not cluster at the start or the end of the bank.
        for (let i = deck.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [deck[i], deck[j]] = [deck[j], deck[i]];
        }
    }
    return added;
}

/**
 * Creates the deck for the selected suits and piece types.
 * Kings are never part of the deck. The standard card counts per suit are kept.
 * The deck is shuffled with Fisher-Yates.
 */
function createDeck(config = null) {
    const { suits, pieces } = normalizeDeckSelection(config);
    const deck = [];
    const has = (type) => pieces.includes(type);

    for (const suit of suits) {
        if (has('P')) {
            for (let i = 0; i < DECK_PIECE_COUNTS.P; i++) deck.push({ type: 'P', suit });
        }
        if (has('N')) {
            for (let i = 0; i < DECK_PIECE_COUNTS.N; i++) deck.push({ type: 'N', suit });
        }
        if (has('B')) {
            deck.push({ type: 'B', suit, squareColor: 'light' });
            deck.push({ type: 'B', suit, squareColor: 'dark' });
        }
        if (has('R')) {
            for (let i = 0; i < DECK_PIECE_COUNTS.R; i++) deck.push({ type: 'R', suit });
        }
        if (has('Q')) {
            for (let i = 0; i < DECK_PIECE_COUNTS.Q; i++) deck.push({ type: 'Q', suit });
        }
    }

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
const STARTING_POINTS_RANGE = { min: 7, max: 41 };

/**
 * Returns a random odd integer from 7 to 41.
 * Any sum of 7 pieces with odd values (1, 3, 5, 9) is strictly odd.
 */
function getRandomStartingPoints() {
    const oddSums = [];
    for (let s = STARTING_POINTS_RANGE.min; s <= STARTING_POINTS_RANGE.max; s += 2) {
        oddSums.push(s);
    }
    return oddSums[Math.floor(Math.random() * oddSums.length)];
}

// Cached type-only combinations for every selected piece set. A combination
// lists 7 piece types (repetitions allowed); suits are assigned later.
const comboCache = new Map();

function getCombosForTypes(pieceTypes) {
    const orderedTypes = ALL_PIECE_TYPES.filter(type => pieceTypes.includes(type));
    const key = orderedTypes.join('');
    if (comboCache.has(key)) return comboCache.get(key);

    const combos = [];
    const bySum = new Map();

    const collect = (start, remaining, sum, chosen) => {
        if (remaining === 0) {
            const combo = {
                types: [...chosen],
                counts: countPieceTypes(chosen),
                sum
            };
            combos.push(combo);
            if (!bySum.has(sum)) bySum.set(sum, []);
            bySum.get(sum).push(combo);
            return;
        }
        for (let i = start; i < orderedTypes.length; i++) {
            const type = orderedTypes[i];
            chosen.push(type);
            collect(i, remaining - 1, sum + PIECE_VALUES_MAP[type], chosen);
            chosen.pop();
        }
    };

    if (orderedTypes.length > 0) collect(0, STARTING_HAND_SIZE, 0, []);
    const result = { combos, bySum };
    comboCache.set(key, result);
    return result;
}

/** Fisher-Yates shuffle that returns a shuffled copy. */
function shuffledCopy(items) {
    const copy = [...items];
    for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
}

// "BL"/"BD" are light- and dark-squared bishops; the order is scarcest-first,
// so queens and bishops consume their per-suit slots before the bulk pieces.
const CARD_CATEGORIES = ['Q', 'BL', 'BD', 'R', 'N', 'P'];

/**
 * Counts piece types in a type-only combination (as produced by genCombos).
 */
function countPieceTypes(combo) {
    const counts = { P: 0, N: 0, B: 0, R: 0, Q: 0 };
    for (const type of combo) counts[type]++;
    return counts;
}

/**
 * Expands type counts plus bishop color counts into a scarce-first category list.
 * Bishops are split into BL (light) and BD (dark) so square colors stay legal.
 */
function expandCategories(requirements) {
    const categories = [];
    for (const category of CARD_CATEGORIES) {
        const count = requirements[category] || 0;
        for (let i = 0; i < count; i++) categories.push(category);
    }
    return categories;
}

/**
 * Enumerates legal bishop color splits for the two hands.
 * White base rank has 4 light / 3 dark squares, black base rank 3 light / 4 dark.
 * The `totalLight`/`totalDark` limits are taken from the real deck, so topped-up
 * decks with extra bishops are handled correctly.
 */
function getBishopDistributions(bishopsWhite, bishopsBlack, totalLight = 4, totalDark = 4) {
    const distributions = [];
    for (let lW = Math.max(0, bishopsWhite - 3); lW <= Math.min(bishopsWhite, 4); lW++) {
        const dW = bishopsWhite - lW;
        for (let lB = Math.max(0, bishopsBlack - 4); lB <= Math.min(bishopsBlack, 3); lB++) {
            const dB = bishopsBlack - lB;
            if (lW + lB <= totalLight && dW + dB <= totalDark) {
                distributions.push({ lW, dW, lB, dB });
            }
        }
    }
    return distributions;
}

/**
 * Backtracking search that assigns a suit to every card of both hands.
 *
 * Guarantees:
 * - each hand gets exactly 7 cards and covers every selected suit;
 * - per-suit supplies come from the real deck (so topped-up duplicates work);
 * - when `requireSuitBalance` is set, every suit appears at most 7 times
 *   across both hands. The kings occupy one file, so the remaining 7 files
 *   must each hold a white and a black piece; a suit with 8+ pieces would
 *   force two same-suit pieces into one file, which is exactly what rooks and
 *   queens can capture. This condition is necessary and sufficient for such a
 *   pairing (Hall's theorem on the suit-conflict graph);
 * - the search is exhaustive (suits are tried in random order at every step), so
 *   `null` means the pair of combinations is genuinely impossible and the caller
 *   can safely try the next pair.
 *
 * `capacity` is mutated during the search and restored on backtracking.
 *
 * Returns { itemsWhite, suitsWhite, itemsBlack, suitsBlack } or null.
 */
function assignSuitsToBothHands(
    requirementsWhite,
    requirementsBlack,
    suits,
    capacity,
    requireSuitBalance = false
) {
    const itemsWhite = expandCategories(requirementsWhite);
    const itemsBlack = expandCategories(requirementsBlack);
    if (itemsWhite.length !== 7 || itemsBlack.length !== 7) return null;

    const suitsWhite = new Array(7);
    const suitsBlack = new Array(7);
    const suitBit = {};
    const suitIndex = {};
    suits.forEach((suit, index) => {
        suitBit[suit] = 1 << index;
        suitIndex[suit] = index;
    });
    const ALL_SUITS = (1 << suits.length) - 1;
    const suitTotals = new Array(suits.length).fill(0);

    const canUseSuit = (suit) => !requireSuitBalance ||
        suitTotals[suitIndex[suit]] < STARTING_HAND_SIZE;

    const countBits = (mask) => {
        let count = 0;
        for (let m = mask; m; m >>= 1) count += m & 1;
        return count;
    };

    const placeBlack = (index, mask) => {
        if (index === itemsBlack.length) return mask === ALL_SUITS;
        const category = itemsBlack[index];
        const slotsLeft = itemsBlack.length - index - 1;

        for (const suit of shuffledCopy(suits)) {
            if (capacity[suit][category] === 0) continue;
            if (!canUseSuit(suit)) continue;
            const nextMask = mask | suitBit[suit];
            if (suits.length - countBits(nextMask) > slotsLeft) continue;

            capacity[suit][category]--;
            suitTotals[suitIndex[suit]]++;
            suitsBlack[index] = suit;
            if (placeBlack(index + 1, nextMask)) return true;
            suitTotals[suitIndex[suit]]--;
            capacity[suit][category]++;
        }
        return false;
    };

    const placeWhite = (index, mask) => {
        if (index === itemsWhite.length) return placeBlack(0, 0);
        const category = itemsWhite[index];
        const slotsLeft = itemsWhite.length - index - 1;

        for (const suit of shuffledCopy(suits)) {
            if (capacity[suit][category] === 0) continue;
            if (!canUseSuit(suit)) continue;
            const nextMask = mask | suitBit[suit];
            if (suits.length - countBits(nextMask) > slotsLeft) continue;

            capacity[suit][category]--;
            suitTotals[suitIndex[suit]]++;
            suitsWhite[index] = suit;
            if (placeWhite(index + 1, nextMask)) return true;
            suitTotals[suitIndex[suit]]--;
            capacity[suit][category]++;
        }
        return false;
    };

    if (!placeWhite(0, 0)) return null;
    return { itemsWhite, suitsWhite, itemsBlack, suitsBlack };
}

/**
 * Deals 7 suited pieces for White and 7 for Black from the selected deck.
 * Guaranteed:
 * - Equal sums for White and Black
 * - Every hand contains at least one piece of each selected suit
 * - Dealt cards are removed from the deck; the remaining cards stay shuffled
 * - Cards are taken from the real deck, so topped-up duplicates are allowed
 * - Bishop squareColor constraints match board geometry
 * - For custom decks with rooks/queens, each suit is spread over at most 7
 *   pieces so the 7 free files can be paired without same-suit columns
 *
 * The caller may pass the game configuration explicitly. When it is omitted,
 * the suits and piece types are inferred from the deck itself.
 */
function dealPiecesFromDeck(deck, targetSum = null, config = null) {
    const selection = config
        ? normalizeDeckSelection(config)
        : {
            suits: [...new Set(deck.filter(card => card && card.suit).map(card => card.suit))],
            pieces: [...new Set(deck.filter(card => card && card.type).map(card => card.type))]
        };

    // Only consider cards actually present in this deck.
    const suits = selection.suits.filter(suit => deck.some(card => card && card.suit === suit));
    const pieceTypes = selection.pieces.filter(type =>
        ALL_PIECE_TYPES.includes(type) && deck.some(card => card && card.type === type)
    );

    const impossibleMessage = 'С выбранным составом колоды невозможно сформировать две равные стартовые руки. Попробуйте изменить набор мастей или фигур.';

    if (deck.length < 2 * STARTING_HAND_SIZE) {
        throw new Error(impossibleMessage);
    }
    if (suits.length === 0 || pieceTypes.length === 0 || suits.length > STARTING_HAND_SIZE) {
        throw new Error(impossibleMessage);
    }

    // Each hand needs at least one card of every selected suit.
    for (const suit of suits) {
        if (deck.filter(card => card && card.suit === suit).length < 2) {
            throw new Error(impossibleMessage);
        }
    }

    // The standard 44-card selection keeps its historical behaviour: mixed
    // deals can still be placed when one suit has 8+ pieces, because the
    // forced same-suit file pair may consist of pawns/knights, which cannot
    // capture along a file. Custom decks with rooks or queens need a strict
    // balance: every suit must fit into the 7 files left by the kings.
    const isStandardSelection =
        suits.length === ALL_SUIT_IDS.length &&
        pieceTypes.length === ALL_PIECE_TYPES.length;
    const requireSuitBalance = !isStandardSelection &&
        (pieceTypes.includes('R') || pieceTypes.includes('Q'));

    // Supply limits are derived from the real deck, not from the standard
    // per-suit counts: a topped-up deck may legitimately contain duplicates.
    const capacity = {};
    for (const suit of suits) {
        capacity[suit] = { P: 0, N: 0, B: 0, R: 0, Q: 0, BL: 0, BD: 0 };
    }
    for (const card of deck) {
        if (!card || !capacity[card.suit]) continue;
        if (card.type === 'B') {
            capacity[card.suit][card.squareColor === 'light' ? 'BL' : 'BD']++;
        } else if (capacity[card.suit][card.type] !== undefined) {
            capacity[card.suit][card.type]++;
        }
    }
    const totalLightBishops = suits.reduce((n, s) => n + capacity[s].BL, 0);
    const totalDarkBishops = suits.reduce((n, s) => n + capacity[s].BD, 0);

    const deckTypeCounts = {};
    for (const type of ALL_PIECE_TYPES) deckTypeCounts[type] = 0;
    for (const card of deck) {
        if (card && deckTypeCounts[card.type] !== undefined) deckTypeCounts[card.type]++;
    }

    const { bySum } = getCombosForTypes(pieceTypes);

    // Group the real deck by category so a solved suit assignment can draw
    // concrete cards without ever duplicating one.
    const cardsByCategory = new Map();
    for (const card of deck) {
        const key = card.type === 'B'
            ? `B|${card.suit}|${card.squareColor}`
            : `${card.type}|${card.suit}`;
        if (!cardsByCategory.has(key)) cardsByCategory.set(key, []);
        cardsByCategory.get(key).push(card);
    }

    let candidateSums;
    if (targetSum !== null && targetSum !== undefined) {
        const requested = Math.trunc(Number(targetSum));
        if (Number.isFinite(requested)) {
            // Custom decks can reach sums outside the standard 7-41 range
            // (for example rooks+queens reach 51). Pick the achievable sum
            // closest to the request instead of clamping it. An exact match
            // keeps redeals stable when the first deal locked its sum.
            let nearest = null;
            for (const sum of bySum.keys()) {
                if (nearest === null) {
                    nearest = sum;
                    continue;
                }
                const distance = Math.abs(sum - requested);
                const bestDistance = Math.abs(nearest - requested);
                // On a tie prefer the higher sum so even standard requests
                // round up exactly as before (40 -> 41).
                if (distance < bestDistance ||
                    (distance === bestDistance && sum > nearest)) {
                    nearest = sum;
                }
            }
            candidateSums = nearest === null ? [] : [nearest];
        } else {
            // A non-numeric target behaves like an omitted one.
            candidateSums = shuffledCopy([...bySum.keys()]);
        }
    } else {
        // Try feasible sums in random order so custom decks keep the deal random.
        candidateSums = shuffledCopy([...bySum.keys()]);
    }

    for (const sum of candidateSums) {
        const validCombos = bySum.get(sum);
        if (!validCombos || validCombos.length === 0) continue;

        const shuffledWhite = shuffledCopy(validCombos);
        const shuffledBlack = shuffledCopy(validCombos);

        for (const comboWhite of shuffledWhite) {
            const countW = comboWhite.counts;
            for (const comboBlack of shuffledBlack) {
                const countB = comboBlack.counts;

                let possible = true;
                for (const t of ALL_PIECE_TYPES) {
                    if (countW[t] + countB[t] > deckTypeCounts[t]) {
                        possible = false;
                        break;
                    }
                }
                if (!possible) continue;

                const distributions = shuffledCopy(
                    getBishopDistributions(
                        countW.B,
                        countB.B,
                        totalLightBishops,
                        totalDarkBishops
                    )
                );

                for (const dist of distributions) {
                    const reqW = {
                        P: countW.P, N: countW.N, R: countW.R, Q: countW.Q,
                        BL: dist.lW, BD: dist.dW
                    };
                    const reqB = {
                        P: countB.P, N: countB.N, R: countB.R, Q: countB.Q,
                        BL: dist.lB, BD: dist.dB
                    };

                    const assignment = assignSuitsToBothHands(
                        reqW, reqB, suits, capacity, requireSuitBalance
                    );
                    if (!assignment) continue;

                    const chosenCards = new Set();
                    const takeCard = (item, suit) => {
                        const key = item === 'BL'
                            ? `B|${suit}|light`
                            : (item === 'BD' ? `B|${suit}|dark` : `${item}|${suit}`);
                        const pile = cardsByCategory.get(key);
                        if (!pile || pile.length === 0) {
                            throw new Error(`Deck has no ${key} card left for target sum ${sum}`);
                        }
                        const card = pile.pop();
                        chosenCards.add(card);
                        return card;
                    };

                    const whiteCards = assignment.itemsWhite.map(
                        (item, i) => takeCard(item, assignment.suitsWhite[i])
                    );
                    const blackCards = assignment.itemsBlack.map(
                        (item, i) => takeCard(item, assignment.suitsBlack[i])
                    );

                    // Remaining cards form the remaining deck
                    const remainingDeck = deck.filter(card => !chosenCards.has(card));
                    for (let i = remainingDeck.length - 1; i > 0; i--) {
                        const j = Math.floor(Math.random() * (i + 1));
                        [remainingDeck[i], remainingDeck[j]] = [remainingDeck[j], remainingDeck[i]];
                    }

                    deck.length = 0;
                    deck.push(...remainingDeck);

                    const whitePieces = whiteCards.map(c =>
                        createPiece(c.type, 'white', c.suit, c.squareColor || null)
                    );
                    const blackPieces = blackCards.map(c =>
                        createPiece(c.type, 'black', c.suit, c.squareColor || null)
                    );

                    return { targetSum: sum, whitePieces, blackPieces };
                }
            }
        }
    }

    throw new Error(impossibleMessage);
}

// Crisp Vector SVGs for chess pieces.
//
// The geometry of each piece is defined once (PIECE_GEOMETRY) and reused for
// both colors, so a white and a black piece can never drift apart: only the
// fill/stroke colors change. The knight's eye and nostril use the special
// __CONTRAST__ token, which is replaced with the stroke color (the color
// opposite to the body fill).
const PIECE_STROKE = '#1c1917';
const PIECE_LIGHT = '#fff';

const PIECE_GEOMETRY = {
    K: `<path d="M22.5 11.63V6M20 8h5"/><path d="M22.5 25s4.5-7.5 3-10.5c0 0-1-2.5-3-2.5s-3 2.5-3 2.5c-1.5 3 3 10.5 3 10.5"/><path d="M11.5 37c5.5 3.5 15.5 3.5 21 0v-7s9-4.5 6-10.5c-4-6.5-13.5-3.5-16 4V23.5C20 16 10.5 13 6.5 19.5c-3 6 5.5 10.5 5.5 10.5v7z"/><path d="M11.5 30c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0m-21 3.5c5.5-3 15.5-3 21 0"/>`,
    // Five crown points, each topped by a ball touching its tip. Coordinates
    // are mirror-symmetric around x = 22.5.
    Q: `<circle cx="6" cy="12" r="2"/><circle cx="14" cy="8.5" r="2"/><circle cx="22.5" cy="7.5" r="2"/><circle cx="31" cy="8.5" r="2"/><circle cx="39" cy="12" r="2"/><path stroke-linecap="butt" d="M9 26c8.5-1.5 21-1.5 27 0l2-12-7 11V10.5l-5.5 14-3-15-3 15-5.5-14V25L7 14z"/><path stroke-linecap="butt" d="M9 26c0 2 1.5 2 2.5 4 1 1.5 1 1 .5 3.5-1.5 1-1.5 2.5-1.5 2.5-1.5 1.5.5 2.5.5 2.5 6.5 1 16.5 1 23 0 0 0 1.5-1 0-2.5 0 0 .5-1.5-1-2.5-.5-2.5-.5-2 .5-3.5 1-2 2.5-2 2.5-4-8.5-1.5-18.5-1.5-27 0z"/><path fill="none" d="M11.5 30c3.5-1 18.5-1 22 0M12 33.5c6-1 15-1 21 0"/>`,
    // The crenellated top is connected to the tapered body by two shoulders.
    R: `<path stroke-linecap="butt" d="M9 39h27v-3H9zm3-3v-4h21v4zm-1-22V9h4v2h5V9h5v2h5V9h4v5"/><path d="M34 14l-3 3H14l-3-3"/><path stroke-linecap="butt" stroke-linejoin="miter" d="M31 17v12.5H14V17"/><path d="M31 29.5l1.5 2.5h-20l1.5-2.5"/><path fill="none" stroke-linejoin="miter" d="M11 14h23"/>`,
    B: `<path d="M9 36c3.39-.97 10.11.43 13.5-2 3.39 2.43 10.11 1.03 13.5 2 0 0 1.65.54 3 2-.68.97-1.65.99-3 .5-3.39-.97-10.11.46-13.5-1-3.39 1.46-10.11.03-13.5 1-1.35.49-2.32.47-3-.5 1.35-1.46 3-2 3-2zM15 32c2.5 2.5 12.5 2.5 15 0 .5-1.5 0-2 0-2 0-2.5-2.5-4-2.5-4 5.5-1.5 6-11.5-5-15.5-11 4-10.5 14-5 15.5 0 0-2.5 1.5-2.5 4 0 0-.5.5 0 2zM25 8a2.5 2.5 0 1 1-5 0 2.5 2.5 0 1 1 5 0z"/><path d="M17.5 26h10M15 30h15m-7.5-14.5v5m-3-2.5h6"/>`,
    // The mane path ends exactly at the silhouette start (22,10), so the head
    // is a continuous part of the body with no gap.
    N: `<path d="M22 10c10.5 1 16.5 8 16 29H15c0-9 10-6.5 8-21"/><path d="M24 18c.38 2.91-5.55 7.37-8 9-3 2-2.82 4.34-5 4-1.042-.94 1.41-3.04 0-3-1 0 .19 1.23-1 2-1 0-4.003 1-4-4 0-2 6-12 6-12s1.89-1.9 2-3.5c-.73-.994-.5-2-.5-3 1-1 3 2.5 3 2.5h2s.78-1.992 2.5-3c1 0 1 3 1 3"/><circle cx="15.5" cy="15" r="1.25" fill="__CONTRAST__" stroke="none"/><circle cx="10" cy="24" r="0.75" fill="__CONTRAST__" stroke="none"/>`,
    P: `<path d="M22 9c-2.21 0-4 1.79-4 4 0 .89.29 1.71.78 2.38C17.33 16.5 16 18.59 16 21c0 2.03.94 3.84 2.41 5.03-3 1.06-7.41 5.55-7.41 13.47h23c0-7.92-4.41-12.41-7.41-13.47 1.47-1.19 2.41-3 2.41-5.03 0-2.41-1.33-4.5-2.78-5.62.49-.67.78-1.49.78-2.38 0-2.21-1.79-4-4-4z"/>`
};

function buildPieceSvg(type, fill, stroke) {
    const geometry = PIECE_GEOMETRY[type].replace(/__CONTRAST__/g, stroke);
    return `<svg viewBox="0 0 45 45"><g fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${geometry}</g></svg>`;
}
const PIECE_SVGS = {
    white: Object.fromEntries(
        Object.keys(PIECE_GEOMETRY).map(type => [type, buildPieceSvg(type, PIECE_LIGHT, PIECE_STROKE)])
    ),
    black: Object.fromEntries(
        Object.keys(PIECE_GEOMETRY).map(type => [type, buildPieceSvg(type, PIECE_STROKE, PIECE_LIGHT)])
    )
};

/**
 * Render HTML for a piece, including SVG and Suit Badge
 */
function renderPieceElement(piece) {
    const el = document.createElement('div');
    const isKing = piece.type === 'K';
    el.className = `chess-piece ${piece.color}-piece${piece.suit ? ' has-suit' : ''}${isKing ? ' is-king' : ''}`;
    el.dataset.id = piece.id;

    const svgContainer = document.createElement('div');
    svgContainer.className = 'piece-svg';
    svgContainer.innerHTML = PIECE_SVGS[piece.color][piece.type];
    el.appendChild(svgContainer);

    let bishopDesc = '';
    if (piece.type === 'B' && piece.squareColor) {
        bishopDesc = piece.squareColor === 'light' ? ' (белопольный)' : ' (чернопольный)';
    }

    if (piece.suit && SUITS[piece.suit]) {
        const suitInfo = SUITS[piece.suit];
        const badge = document.createElement('div');
        badge.className = `suit-badge ${suitInfo.badgeClass}`;
        badge.textContent = suitInfo.symbol;
        badge.title = `${PIECE_NAMES[piece.type]}${bishopDesc} (${suitInfo.name})`;
        el.appendChild(badge);
    } else if (isKing) {
        const crown = document.createElement('div');
        crown.className = 'king-crown-badge';
        crown.innerHTML = '★';
        crown.title = 'Король (любая масть)';
        el.appendChild(crown);
    } else {
        // A suitless piece (after the suit reset) gets a neutral empty badge.
        const badge = document.createElement('div');
        badge.className = 'suit-badge suit-none';
        badge.title = `${PIECE_NAMES[piece.type]}${bishopDesc} (без масти)`;
        el.appendChild(badge);
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
     * - Random target value chosen from the achievable odd sums
     * - White King at e1 (7, 4), Black King at e8 (0, 4)
     * - 7 pieces dealt directly from the selected deck to White summing to targetSum
     * - 7 pieces dealt directly from the selected deck to Black summing to targetSum
     * - Remaining cards stay in the deck for the bank
     *
     * The pieces are rearranged on the base ranks until isPlacementValid(this)
     * accepts the position. Up to 10 redeals and 2000 layouts per deal are tried.
     * A random starting sum is locked after the first deal, so replacing the
     * columns never changes the starting points.
     *
     * Returns targetSum.
     */
    setupInitialPosition(deck, targetSum = null, config = null, isPlacementValid = null) {
        completeDeckForStartingDeal(deck, config);
        const originalDeck = [...deck];
        let effectiveTargetSum = targetSum;
        let finalSum = null;

        // Helper to place 7 pieces on base rank strictly matching bishop square colors
        const placeRankPieces = (row, pieces, isWhite) => {
            // White row 7: light squares are [1, 3, 5, 7], dark squares are [0, 2, 6]
            // Black row 0: light squares are [0, 2, 6], dark squares are [1, 3, 5, 7]
            const lightCols = isWhite ? [1, 3, 5, 7] : [0, 2, 6];
            const darkCols = isWhite ? [0, 2, 6] : [1, 3, 5, 7];

            const availLight = [...lightCols].sort(() => Math.random() - 0.5);
            const availDark = [...darkCols].sort(() => Math.random() - 0.5);

            const lightBishops = pieces.filter(p => p.type === 'B' && p.squareColor === 'light');
            const darkBishops = pieces.filter(p => p.type === 'B' && p.squareColor === 'dark');
            const otherPieces = pieces.filter(p => p.type !== 'B');

            for (const b of lightBishops) {
                const col = availLight.pop();
                this.setPiece(row, col, b);
            }
            for (const b of darkBishops) {
                const col = availDark.pop();
                this.setPiece(row, col, b);
            }

            const remainingCols = [...availLight, ...availDark].sort(() => Math.random() - 0.5);
            for (const p of otherPieces) {
                const col = remainingCols.pop();
                this.setPiece(row, col, p);
            }
        };

        for (let dealAttempt = 0; dealAttempt < 10; dealAttempt++) {
            // Restore the untouched deck before every redeal
            deck.length = 0;
            deck.push(...originalDeck);

            const dealResult = dealPiecesFromDeck(deck, effectiveTargetSum, config);
            const { targetSum: dealtSum, whitePieces, blackPieces } = dealResult;
            finalSum = dealtSum;

            // Lock the random starting sum after the first deal
            if (effectiveTargetSum === null || effectiveTargetSum === undefined) {
                effectiveTargetSum = dealtSum;
            }

            // Kings are identical across all layouts of this deal
            const whiteKing = createPiece('K', 'white', null);
            const blackKing = createPiece('K', 'black', null);

            for (let placementAttempt = 0; placementAttempt < 2000; placementAttempt++) {
                // Clear the board and place the kings
                this.grid = Array(8).fill(null).map(() => Array(8).fill(null));
                this.setPiece(7, 4, whiteKing);
                this.setPiece(0, 4, blackKing);

                // Lay out both starting hands on their base ranks
                placeRankPieces(7, whitePieces, true);
                placeRankPieces(0, blackPieces, false);

                if (typeof isPlacementValid !== 'function' || isPlacementValid(this)) {
                    return finalSum;
                }
            }
        }

        throw new Error('Не удалось раздать фигуры без доступных взятий. Попробуйте изменить состав колоды.');
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
            // After the suit reset every board piece is suitless: any piece may
            // capture any enemy piece regardless of its (now absent) suit.
            if (suit === null && targetPiece.suit === null) return true;
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

                // Forward 2 from starting rank ONLY if piece has not moved yet
                const isPawnStart = !piece.hasMoved && (
                    (color === 'white' && (r === 6 || r === 7)) ||
                    (color === 'black' && (r === 1 || r === 0))
                );
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

    /**
     * True when at least one piece of either color has a legal capture.
     * Used to validate the starting placement.
     */
    static hasAnyCapture(board) {
        for (const color of ['white', 'black']) {
            if (this.getAllLegalMoves(board, color).some(m => m.isCapture)) return true;
        }
        return false;
    }
}

/**
 * Deterministic RNG used for base-rank spawn columns. It can be cloned so a
 * simulation starts from exactly the same random sequence as the real engine.
 */
class SeededRng {
    constructor(seed = 1) {
        this.state = seed >>> 0;
    }

    next() {
        // mulberry32
        let t = this.state += 0x6D2B79F5;
        t = Math.imul(t ^ (t >>> 15), t | 1);
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    clone() {
        const r = new SeededRng(0);
        r.state = this.state;
        return r;
    }
}

/**
 * Complete mutable game state plus the rules that do not need history.
 * GameEngine extends this with snapshots, notation and repetition tracking,
 * so the AI can clone and simulate the exact same state the engine uses.
 */
class GameState {
    constructor() {
        this.board = new Board();
        this.deck = [];
        this.turn = 'white';
        this.whiteReserve = [];
        this.blackReserve = [];
        this.capturedWhite = [];
        this.capturedBlack = [];
        this.delayedSpawns = [];
        this.spawnEvents = [];
        this.status = 'playing'; // 'playing' | 'check' | 'checkmate' | 'stalemate' | 'repetition'
        this.winner = null;      // 'white' | 'black' | 'draw' | null
        this.drawReason = null;  // 'stalemate' | 'agreement' | 'suits_agreement' | null
        this.suitsResolved = false;
        this.suitsReset = false;
        this.pendingSuitOffer = false;
        this.gameConfig = null;
        this.rng = null; // null => Math.random(); object with next()/clone() => seeded
    }

    /**
     * Single source of randomness for spawn columns.
     */
    nextRandom() {
        if (!this.rng) return Math.random();
        return typeof this.rng === 'function' ? this.rng() : this.rng.next();
    }

    /**
     * Suits available in the current game's deck. Standard games use all four.
     */
    getActiveSuits() {
        if (this.gameConfig && Array.isArray(this.gameConfig.suits) && this.gameConfig.suits.length > 0) {
            return [...this.gameConfig.suits];
        }
        return Object.keys(SUITS);
    }

    /**
     * Collects the suits the given player still has among their pieces:
     * board pieces (kings have no suit), their reserve and their pending
     * delayed appearances. Suitless pieces do not add a suit.
     */
    getPresentSuits(color) {
        const suits = new Set();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board.getPiece(r, c);
                if (piece && piece.color === color && piece.suit) {
                    suits.add(piece.suit);
                }
            }
        }
        const reserve = color === 'white' ? this.whiteReserve : this.blackReserve;
        for (const piece of reserve) {
            if (piece.suit) suits.add(piece.suit);
        }
        for (const delayed of this.delayedSpawns) {
            if (delayed.player === color && delayed.piece.suit) {
                suits.add(delayed.piece.suit);
            }
        }
        return suits;
    }

    /**
     * Draws a bank card for `color`. Normally the top card is taken, but when
     * the player is missing suits, the topmost card of a missing suit is
     * preferred. Returns the removed card or null when the bank is empty.
     * After a suit reset the rule does not apply (the bank is empty anyway).
     */
    drawBankCardFor(color) {
        if (this.deck.length === 0) return null;
        const takeTopCard = () => this.deck.pop();

        if (this.suitsReset) return takeTopCard();

        const present = this.getPresentSuits(color);
        const missing = this.getActiveSuits().filter(suit => !present.has(suit));
        if (missing.length === 0) return takeTopCard();

        for (let i = this.deck.length - 1; i >= 0; i--) {
            if (missing.includes(this.deck[i].suit)) {
                return this.deck.splice(i, 1)[0];
            }
        }
        return takeTopCard();
    }

    /**
     * Finds a suitable empty base-rank column for a piece of `playerColor`.
     * Bishops additionally require a square of their own color.
     * Returns null when no suitable square is free.
     * Used for delayed spawns, which ignore check by design.
     */
    findBaseColumn(playerColor, piece, preferCol = null) {
        const baseRow = playerColor === 'white' ? 7 : 0;
        let cols = this.board.getEmptyBaseCols(baseRow);
        if (piece.type === 'B') {
            cols = cols.filter(c => ((baseRow + c) % 2 === 0 ? 'light' : 'dark') === piece.squareColor);
        }
        if (cols.length === 0) return null;
        if (preferCol !== null && cols.includes(preferCol)) return preferCol;
        return cols[Math.floor(this.nextRandom() * cols.length)];
    }

    /**
     * Finds a base-rank square where `piece` can appear without giving check.
     * Possible results:
     * - { status: 'SAFE', column }  a safe square exists (preferCol wins when safe);
     * - { status: 'CHECK' }         suitable squares exist, but all give check;
     * - { status: 'NO_SPACE' }      no suitable empty square exists.
     */
    findBasePlacement(playerColor, piece, preferCol = null) {
        const baseRow = playerColor === 'white' ? 7 : 0;
        let cols = this.board.getEmptyBaseCols(baseRow);
        if (piece.type === 'B') {
            cols = cols.filter(c => ((baseRow + c) % 2 === 0 ? 'light' : 'dark') === piece.squareColor);
        }
        if (cols.length === 0) return { status: 'NO_SPACE' };

        const safeCols = cols.filter(c => !this.wouldGiveNewCheck(piece, baseRow, c, playerColor));
        if (safeCols.length === 0) return { status: 'CHECK' };

        const column = (preferCol !== null && safeCols.includes(preferCol))
            ? preferCol
            : safeCols[Math.floor(this.nextRandom() * safeCols.length)];
        return { status: 'SAFE', column };
    }

    /**
     * Checks whether the appearing `piece` itself attacks the enemy king from (r, c).
     * A check that already existed (e.g. created by the move that triggered the spawn)
     * is irrelevant: only the piece's own attacks count, so two checking pieces
     * cannot appear at the same time.
     */
    wouldGiveNewCheck(piece, r, c, playerColor) {
        const enemyColor = playerColor === 'white' ? 'black' : 'white';
        const enemyKing = this.board.findKing(enemyColor);
        if (!enemyKing) return false;

        const previousPiece = this.board.getPiece(r, c);
        this.board.setPiece(r, c, piece);
        try {
            return GameRules
                .getPseudoLegalMoves(this.board, r, c)
                .some(m => m.r === enemyKing.r && m.c === enemyKing.c);
        } finally {
            // Always restore the board, even if the attack check throws.
            if (previousPiece) {
                this.board.setPiece(r, c, previousPiece);
            } else {
                this.board.removePiece(r, c);
            }
        }
    }

    /**
     * Puts a delayed spawn onto the base rank, or queues it to the reserve when no square is free.
     */
    tryPlaceDelayedSpawn(delayed, playerColor, preferCol = null) {
        const col = this.findBaseColumn(playerColor, delayed.piece, preferCol);
        if (col === null) {
            (playerColor === 'white' ? this.whiteReserve : this.blackReserve).push(delayed.piece);
            this.spawnEvents.push({
                piece: delayed.piece,
                player: playerColor,
                type: 'reserve_queued'
            });
            return;
        }

        const baseRow = playerColor === 'white' ? 7 : 0;
        this.board.setPiece(baseRow, col, delayed.piece);
        this.spawnEvents.push({
            piece: delayed.piece,
            r: baseRow,
            c: col,
            type: 'delayed_spawn_placed'
        });
    }

    /**
     * Deploys the whole reserve of `playerColor` onto its base rank.
     * Pieces are scanned in reserve order: a piece without a suitable square is
     * skipped so the following pieces can still appear. A piece is delayed only
     * when every suitable square would give check.
     */
    deployReserves(playerColor, preferCol = null) {
        const reserve = playerColor === 'white' ? this.whiteReserve : this.blackReserve;
        const baseRow = playerColor === 'white' ? 7 : 0;

        while (reserve.length > 0) {
            let acted = false;

            for (let i = 0; i < reserve.length; i++) {
                const piece = reserve[i];
                const placement = this.findBasePlacement(
                    playerColor,
                    piece,
                    i === 0 ? preferCol : null
                );

                // No suitable square for this piece: keep it and try the next one.
                if (placement.status === 'NO_SPACE') continue;

                reserve.splice(i, 1);
                acted = true;

                if (placement.status === 'CHECK') {
                    // Rule: a piece that would give check on appearance is delayed by one own move
                    this.delayedSpawns.push({ piece, player: playerColor });
                    this.spawnEvents.push({
                        piece,
                        player: playerColor,
                        type: 'delayed_check_queued'
                    });
                } else {
                    this.board.setPiece(baseRow, placement.column, piece);
                    this.spawnEvents.push({
                        piece,
                        r: baseRow,
                        c: placement.column,
                        type: 'reserve_spawn'
                    });
                }

                // Restart the scan so the remaining pieces keep their order.
                break;
            }

            // Nothing can be placed or delayed: the base rank cannot accept the rest.
            if (!acted) break;
        }
    }

    /**
     * Places a freshly drawn bank piece using the same placement rules as reserves:
     * a safe square immediately, a checking-only board into delayedSpawns, and
     * no suitable square into the reserve.
     */
    placeBankPiece(piece, playerColor) {
        const baseRow = playerColor === 'white' ? 7 : 0;
        const placement = this.findBasePlacement(playerColor, piece);

        if (placement.status === 'NO_SPACE') {
            (playerColor === 'white' ? this.whiteReserve : this.blackReserve).push(piece);
            this.spawnEvents.push({
                piece,
                player: playerColor,
                type: 'reserve_queued'
            });
            return;
        }

        if (placement.status === 'CHECK') {
            // Rule: a piece that would give check on appearance is delayed by one own move
            this.delayedSpawns.push({ piece, player: playerColor });
            this.spawnEvents.push({
                piece,
                player: playerColor,
                type: 'delayed_check_queued'
            });
            return;
        }

        this.board.setPiece(baseRow, placement.column, piece);
        this.spawnEvents.push({
            piece,
            player: playerColor,
            r: baseRow,
            c: placement.column,
            type: 'bank_spawn'
        });
    }

    /**
     * Applies one legal move and every consequence of it: promotion, capture,
     * bank draw, delayed spawns, reserve deployment, status and turn switch.
     * It intentionally does not touch history, notation, repetition or the
     * suit-draw offer; GameEngine.makeMove() adds those on top.
     */
    applyMoveCore(fromR, fromC, toR, toC, promotionChoice = null) {
        this.spawnEvents = [];
        const movingColor = this.turn;
        const opponentColor = movingColor === 'white' ? 'black' : 'white';
        const capturedPiece = this.board.getPiece(toR, toC);
        const piece = this.board.getPiece(fromR, fromC);

        // 1. Move piece
        this.board.removePiece(fromR, fromC);
        this.board.setPiece(toR, toC, piece);
        piece.hasMoved = true;

        const movingPieceType = piece.type;
        const movingPieceSuit = piece.suit;

        // 2. Handle Pawn Promotion (any stronger piece + any suit chosen by player)
        // After a suit reset there are no suits left, so only the piece type is chosen.
        let isPromotion = false;
        if (piece.type === 'P') {
            const promoRank = movingColor === 'white' ? 0 : 7;
            if (toR === promoRank) {
                isPromotion = true;
                const suitsAreReset = this.suitsReset;
                const hasValidChoice = promotionChoice && promotionChoice.type &&
                    (suitsAreReset || promotionChoice.suit);
                if (hasValidChoice) {
                    piece.type = promotionChoice.type;
                    piece.suit = suitsAreReset ? null : promotionChoice.suit;
                    if (piece.type === 'B') {
                        piece.squareColor = (toR + toC) % 2 === 0 ? 'light' : 'dark';
                    } else {
                        piece.squareColor = null;
                    }
                } else {
                    piece.type = 'Q'; // Fallback to Queen
                    if (suitsAreReset) piece.suit = null;
                    piece.squareColor = null;
                }
            }
        }

        // 3. Handle Capture and Bank Draw (placement is deferred: reserves get priority)
        let bankPiece = null;
        if (capturedPiece) {
            if (capturedPiece.color === 'white') {
                this.capturedWhite.push(capturedPiece);
            } else {
                this.capturedBlack.push(capturedPiece);
            }

            // Opponent draws a replacement card from the bank
            if (this.deck.length > 0) {
                const card = this.drawBankCardFor(opponentColor);
                bankPiece = createPiece(card.type, opponentColor, card.suit, card.squareColor || null);
            }
        }

        // 4. Handle Moving Player's Delayed Spawns (Rule: appears after the player's move)
        const movingBaseRow = movingColor === 'white' ? 7 : 0;
        const preferCol = fromR === movingBaseRow ? fromC : null;
        const remainingDelayed = [];
        for (const delayed of this.delayedSpawns) {
            if (delayed.player === movingColor) {
                this.tryPlaceDelayedSpawn(delayed, movingColor, preferCol);
            } else {
                remainingDelayed.push(delayed);
            }
        }
        this.delayedSpawns = remainingDelayed;

        // 5. Deploy reserves for BOTH sides after every move (repeatedly, while
        //    a matching empty base-rank square remains). Reserves always get
        //    priority over a freshly drawn bank piece.
        this.deployReserves(movingColor, preferCol);
        this.deployReserves(opponentColor);

        // 5b. Only now place the bank replacement drawn in step 3, so that
        //     reservists are never bypassed by a new card.
        if (bankPiece) {
            this.placeBankPiece(bankPiece, opponentColor);
        }

        // 6. Check Game Status for Opponent
        const isOpponentInCheck = GameRules.isKingInCheck(this.board, opponentColor);
        const opponentMoves = GameRules.getAllLegalMoves(this.board, opponentColor);

        // A move clears any previous draw reason; only a stalemate below can set it again
        this.drawReason = null;

        if (opponentMoves.length === 0) {
            if (isOpponentInCheck) {
                this.status = 'checkmate';
                this.winner = movingColor;
            } else {
                this.status = 'stalemate';
                this.winner = 'draw';
                this.drawReason = 'stalemate';
            }
        } else if (isOpponentInCheck) {
            this.status = 'check';
        } else {
            this.status = 'playing';
        }

        // 7. Switch turn
        this.turn = opponentColor;

        return {
            movingColor,
            opponentColor,
            movingPiece: piece,
            capturedPiece,
            isPromotion,
            movingPieceType,
            movingPieceSuit,
            opponentInCheck: isOpponentInCheck,
            opponentMoves,
            spawnEvents: [...this.spawnEvents]
        };
    }

    /**
     * Independent copy of the complete state, used by the AI search.
     */
    cloneState() {
        const s = new GameState();
        s.board = this.board.clone();
        s.deck = [...this.deck]; // bank cards are only read and popped, never mutated
        s.whiteReserve = this.whiteReserve.map(p => ({ ...p }));
        s.blackReserve = this.blackReserve.map(p => ({ ...p }));
        s.capturedWhite = this.capturedWhite.map(p => ({ ...p }));
        s.capturedBlack = this.capturedBlack.map(p => ({ ...p }));
        s.delayedSpawns = this.delayedSpawns.map(d => ({
            piece: { ...d.piece },
            player: d.player
        }));
        s.spawnEvents = [];
        s.turn = this.turn;
        s.status = this.status;
        s.winner = this.winner;
        s.drawReason = this.drawReason;
        s.suitsResolved = this.suitsResolved;
        s.suitsReset = this.suitsReset;
        s.pendingSuitOffer = this.pendingSuitOffer;
        s.gameConfig = this.gameConfig;
        s.rng = this.rng && typeof this.rng.clone === 'function'
            ? this.rng.clone()
            : this.rng;
        return s;
    }
}

/**
 * Game Engine managing game loop, bank, reserves, turn cycle, and notation
 */
class GameEngine extends GameState {
    constructor() {
        super();
        this.moveHistory = [];
        this.lastMove = null;
        this.snapshots = [];     // State snapshots for undo
        this.positionHistory = {}; // Key -> count for threefold repetition
        this.startingPoints = 0; // Total starting points per player
    }

    /**
     * Starts a new game. A custom configuration may be supplied; the standard
     * 44-card setup is used when it is omitted.
     *
     * All potentially failing work happens on local state first, so an
     * impossible custom configuration leaves the current game untouched.
     */
    startNewGame(targetSum = null, config = null) {
        const gameConfig = validateGameConfig(config);
        const deck = createDeck(gameConfig);
        const newBoard = new Board();

        const finalSum = newBoard.setupInitialPosition(
            deck,
            targetSum,
            gameConfig,
            board => !GameRules.hasAnyCapture(board)
        );

        // Keep exactly the requested number of bank cards. The remaining deck
        // is already shuffled, so truncation is a random subset.
        if (deck.length < gameConfig.bankSize) {
            throw new Error('В колоде недостаточно карт для выбранного размера банка.');
        }
        if (deck.length > gameConfig.bankSize) {
            for (let i = deck.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [deck[i], deck[j]] = [deck[j], deck[i]];
            }
            deck.length = gameConfig.bankSize;
        }

        this.board = newBoard;
        this.deck = deck;
        this.gameConfig = gameConfig;
        this.startingPoints = finalSum;
        this.turn = 'white';
        this.whiteReserve = [];
        this.blackReserve = [];
        this.capturedWhite = [];
        this.capturedBlack = [];
        this.moveHistory = [];
        this.status = 'playing';
        this.winner = null;
        this.drawReason = null;
        this.lastMove = null;
        this.spawnEvents = [];
        this.snapshots = [];
        this.delayedSpawns = [];
        this.positionHistory = {};
        this.suitsResolved = false;
        this.suitsReset = false;
        this.pendingSuitOffer = false;
        this.rng = new SeededRng((Math.random() * 0x100000000) >>> 0);

        const initialKey = this.getPositionKey();
        this.positionHistory[initialKey] = 1;
    }

    /**
     * True when the current status means the game is over (no further moves allowed)
     */
    isGameOver() {
        return this.status === 'checkmate' ||
               this.status === 'stalemate' ||
               this.status === 'repetition';
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
                    key += `${r}${c}:${p.color}${p.type}${p.suit || 'X'}${p.squareColor || ''}`;
                    // Pawn's two-square right depends on hasMoved, so it is part of the position
                    if (p.type === 'P') {
                        key += `H${p.hasMoved ? 1 : 0}`;
                    }
                    key += ';';
                }
            }
        }
        key += '|W_RES:';
        for (const p of this.whiteReserve) {
            key += `${p.type}${p.suit}${p.squareColor || ''};`;
        }
        key += '|B_RES:';
        for (const p of this.blackReserve) {
            key += `${p.type}${p.suit}${p.squareColor || ''};`;
        }
        key += '|DELAY:';
        for (const d of this.delayedSpawns) {
            key += `${d.player}:${d.piece.type}${d.piece.suit || 'X'}${d.piece.squareColor || ''};`;
        }
        return key;
    }

    /**
     * Records the current position in the threefold repetition history and
     * returns its key. Used after a suit reset, because the resulting position
     * is new and its first appearance must be counted.
     */
    recordCurrentPosition() {
        const key = this.getPositionKey();
        this.positionHistory[key] = (this.positionHistory[key] || 0) + 1;
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
        this.deck = prev.deck ? [...prev.deck] : [];
        this.whiteReserve = prev.whiteReserve ? prev.whiteReserve.map(p => ({ ...p })) : [];
        this.blackReserve = prev.blackReserve ? prev.blackReserve.map(p => ({ ...p })) : [];
        this.capturedWhite = prev.capturedWhite ? prev.capturedWhite.map(p => ({ ...p })) : [];
        this.capturedBlack = prev.capturedBlack ? prev.capturedBlack.map(p => ({ ...p })) : [];
        this.moveHistory = prev.moveHistory;
        this.status = prev.status;
        this.winner = prev.winner;
        this.drawReason = prev.drawReason ?? null;
        this.lastMove = prev.lastMove;
        this.spawnEvents = [];
        this.delayedSpawns = prev.delayedSpawns ? prev.delayedSpawns.map(d => ({ piece: { ...d.piece }, player: d.player })) : [];
        this.positionHistory = prev.positionHistory ? { ...prev.positionHistory } : {};
        this.suitsResolved = !!prev.suitsResolved;
        this.suitsReset = !!prev.suitsReset;
        this.pendingSuitOffer = !!prev.pendingSuitOffer;
        this.rng = prev.rng && typeof prev.rng.clone === 'function'
            ? prev.rng.clone()
            : prev.rng;
        return true;
    }

    /**
     * Execute a move from (fromR, fromC) to (toR, toC)
     * Optional promotionChoice: { type: 'Q'|'R'|'B'|'N', suit: 'spades'|'clubs'|'hearts'|'diamonds' }
     * After engine.suitsReset the suit is omitted (or null) and the piece stays suitless.
     * Returns result object with move details
     */
    makeMove(fromR, fromC, toR, toC, promotionChoice = null) {
        if (this.pendingSuitOffer) {
            return { success: false, reason: 'Pending suit offer' };
        }
        if (this.isGameOver()) {
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

        // Remember whether any spawn queue (reserves / delayed appearance)
        // existed before the move: emptying queues is an offer trigger.
        const hadSpawnQueue = this.whiteReserve.length > 0 ||
            this.blackReserve.length > 0 ||
            this.delayedSpawns.length > 0;

        // Save state snapshot before mutating. Pieces are shallow-copied because
        // every piece field is a primitive, but lists and the board must be
        // independent so that undo restores suits exactly.
        this.snapshots.push({
            board: this.board.clone(),
            turn: this.turn,
            deck: [...this.deck],
            whiteReserve: this.whiteReserve.map(p => ({ ...p })),
            blackReserve: this.blackReserve.map(p => ({ ...p })),
            capturedWhite: this.capturedWhite.map(p => ({ ...p })),
            capturedBlack: this.capturedBlack.map(p => ({ ...p })),
            moveHistory: [...this.moveHistory],
            status: this.status,
            winner: this.winner,
            drawReason: this.drawReason,
            lastMove: this.lastMove ? { ...this.lastMove } : null,
            delayedSpawns: this.delayedSpawns.map(d => ({ piece: { ...d.piece }, player: d.player })),
            positionHistory: { ...this.positionHistory },
            suitsResolved: this.suitsResolved,
            suitsReset: this.suitsReset,
            pendingSuitOffer: this.pendingSuitOffer,
            rng: this.rng && typeof this.rng.clone === 'function' ? this.rng.clone() : this.rng
        });

        // Apply the complete move once. History, notation, the suit-draw offer
        // and threefold repetition are added by this wrapper on top of it.
        const core = this.applyMoveCore(fromR, fromC, toR, toC, promotionChoice);
        const capturedPiece = core.capturedPiece;
        const isPromotion = core.isPromotion;

        const moveNotation = this.formatNotation(
            core.movingPieceType, core.movingPieceSuit, core.movingPiece,
            fromR, fromC, toR, toC, capturedPiece, isPromotion,
            core.opponentInCheck,
            core.opponentMoves.length === 0 && core.opponentInCheck
        );

        this.lastMove = {
            from: { r: fromR, c: fromC },
            to: { r: toR, c: toC },
            piece: core.movingPiece,
            captured: capturedPiece,
            notation: moveNotation,
            spawnEvents: [...core.spawnEvents]
        };

        this.moveHistory.push(this.lastMove);

        // 8. Empty-bank suit offer: evaluated once per move, after captures, reserve
        //    deployment and delayed spawns are fully processed, and after the
        //    mate/stalemate status is known. While the offer is pending, threefold
        //    repetition is intentionally not processed for this move.
        const suitDrawOffer = this.shouldOfferSuitDraw({
            hadCapture: !!capturedPiece,
            hadPromotion: isPromotion,
            hadSpawnQueue
        });

        if (suitDrawOffer) {
            this.pendingSuitOffer = true;
            return {
                success: true,
                lastMove: this.lastMove,
                status: this.status,
                winner: this.winner,
                threefold: false,
                suitDrawOffer: true,
                positionKey: this.getPositionKey()
            };
        }

        // 9. Check Threefold Repetition
        const currentPosKey = this.getPositionKey();
        this.positionHistory[currentPosKey] = (this.positionHistory[currentPosKey] || 0) + 1;
        const isThreefold = this.positionHistory[currentPosKey] >= 3;

        return {
            success: true,
            lastMove: this.lastMove,
            status: this.status,
            winner: this.winner,
            threefold: isThreefold,
            suitDrawOffer: false,
            positionKey: currentPosKey
        };
    }

    /**
     * Collects the sets of suits still present on each side's board pieces.
     * Kings and suitless pieces are ignored: only real suited pieces count.
     */
    getBoardSuitSets() {
        const white = new Set();
        const black = new Set();
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const p = this.board.getPiece(r, c);
                if (!p || !p.suit || p.type === 'K') continue;
                (p.color === 'white' ? white : black).add(p.suit);
            }
        }
        return { white, black };
    }

    /**
     * True when the "empty bank + different suits" draw should be offered.
     * All conditions must hold:
     * - the bank (deck) is empty, both reserves and the delayed queue are empty;
     * - both sides still have at least one suited board piece and their suit sets
     *   do not intersect;
     * - the offer was not resolved earlier this game;
     * - the move did not finish the game by mate or stalemate;
     * - this move captured, promoted, or emptied the spawn queues.
     */
    shouldOfferSuitDraw({ hadCapture = false, hadPromotion = false, hadSpawnQueue = false } = {}) {
        if (this.suitsResolved || this.pendingSuitOffer) return false;
        if (!hadCapture && !hadPromotion && !hadSpawnQueue) return false;
        if (this.deck.length !== 0) return false;
        if (this.whiteReserve.length > 0 || this.blackReserve.length > 0 || this.delayedSpawns.length > 0) {
            return false;
        }
        if (this.status === 'checkmate' || this.status === 'stalemate') return false;

        const { white, black } = this.getBoardSuitSets();
        if (white.size === 0 || black.size === 0) return false;
        for (const suit of white) {
            if (black.has(suit)) return false;
        }
        return true;
    }

    /**
     * Removes suits from every piece that is still in play (board, reserves and the
     * delayed queue). Captured pieces keep the suit they were captured with, and
     * bishop square colours are never touched.
     */
    resetSuits() {
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = this.board.getPiece(r, c);
                if (piece) piece.suit = null;
            }
        }
        for (const piece of this.whiteReserve) piece.suit = null;
        for (const piece of this.blackReserve) piece.suit = null;
        for (const delayed of this.delayedSpawns) delayed.piece.suit = null;
        this.suitsReset = true;
    }


    formatNotation(originalType, originalSuit, currentPiece, fromR, fromC, toR, toC, captured, isPromotion, isCheck, isCheckmate) {
        const fromNot = Board.toNotation(fromR, fromC);
        const toNot = Board.toNotation(toR, toC);
        const pieceSymbol = originalType === 'P' ? '' : (originalType === 'N' ? 'N' : originalType);
        const suitSymbol = originalSuit ? SUITS[originalSuit].symbol : '';
        const capSymbol = captured ? 'x' : '-';
        let notStr = `${pieceSymbol}${suitSymbol ? suitSymbol : ''}${fromNot}${capSymbol}${toNot}`;
        if (isPromotion) {
            const promoPieceSym = currentPiece.type === 'N' ? 'N' : currentPiece.type;
            const promoSuitSym = currentPiece.suit ? SUITS[currentPiece.suit].symbol : '';
            notStr += `=${promoPieceSym}${promoSuitSym}`;
        }
        if (isCheckmate) notStr += '#';
        else if (isCheck) notStr += '+';
        return notStr;
    }
}

/**
 * Chess Durak - Intelligent AI Engine
 *
 * Medium and hard search the complete game state (board, bank, reserves,
 * delayed spawns, captures, suit-reset flag and status) by cloning a
 * GameState and applying real moves through applyMoveCore().
 */
const MATE = 100000;
const RESERVE_WEIGHT = 0.9;
const DELAYED_WEIGHT = 0.9;
class ChessDurakAI {
    constructor(engine) {
        this.engine = engine;
        this.searchDeadline = 0;
        this._nodes = 0;
        this.searchAborted = false;
    }

    /**
     * Choose the best move for the AI color.
     */
    async findBestMove(color, difficulty = 'medium') {
        const root = this.engine.cloneState();
        const legalMoves = GameRules.getAllLegalMoves(root.board, color);
        if (legalMoves.length === 0) return null;

        const opponentColor = color === 'white' ? 'black' : 'white';

        if (difficulty === 'easy') {
            // Easy: prioritize captures, otherwise random. No search.
            const captures = legalMoves.filter(m => m.isCapture);
            let chosenMove = null;
            if (captures.length > 0 && Math.random() < 0.7) {
                chosenMove = captures[Math.floor(Math.random() * captures.length)];
            } else {
                chosenMove = legalMoves[Math.floor(Math.random() * legalMoves.length)];
            }
            if (chosenMove) {
                chosenMove.promotionChoice = this.getPromotionChoice(this.engine, chosenMove, color);
            }
            return chosenMove;
        }

        const isHard = (difficulty === 'hard');
        const maxDepth = isHard ? 3 : 2;
        const timeLimitMs = isHard ? 1500 : 800;
        const deadline = Date.now() + timeLimitMs;
        this.searchDeadline = deadline;
        this._nodes = 0;

        // Ordering is computed once per root call; it uses Math.random() only
        // for medium noise and never consumes the state RNG.
        const orderedMoves = this.orderMoves(root, legalMoves, color, isHard);

        let bestMove = null;

        // Iterative deepening: only a fully completed depth may replace the
        // best move. A depth that ran out of time inside minimax is discarded,
        // so the result of the last fully completed depth remains selected.
        for (let depth = 1; depth <= maxDepth; depth++) {
            if (Date.now() >= deadline) break;

            this.searchAborted = false;
            let iterationBest = null;
            let iterationScore = -Infinity;
            let completed = true;
            const scoreByMove = new Map();

            for (const move of orderedMoves) {
                // The deadline may pass between root moves; an incomplete
                // iteration can never be accepted.
                if (Date.now() >= deadline) {
                    completed = false;
                    break;
                }

                await new Promise(r => setTimeout(r, 0));

                const state = root.cloneState();
                const promotionChoice = this.getPromotionChoice(state, move, color);
                state.applyMoveCore(
                    move.from.r, move.from.c,
                    move.to.r, move.to.c,
                    promotionChoice
                );

                let score;
                if (state.status === 'checkmate') {
                    score = state.winner === color ? MATE : -MATE;
                } else if (state.status === 'stalemate') {
                    score = 0;
                } else {
                    // Root is maximizing: the best score so far is a valid
                    // alpha bound for the remaining moves.
                    score = this.minimax(
                        state, depth - 1, iterationScore, Infinity,
                        color, state.turn, isHard, 1
                    );
                }

                // minimax() reports an aborted search through searchAborted:
                // the partial score is meaningless and must not be recorded.
                if (this.searchAborted) {
                    completed = false;
                    break;
                }

                scoreByMove.set(move, score);
                if (iterationBest === null || score > iterationScore) {
                    iterationScore = score;
                    iterationBest = move;
                }
            }

            if (iterationBest && completed && !this.searchAborted) {
                bestMove = iterationBest;

                // Search the most promising root moves first at the next depth.
                orderedMoves.sort(
                    (a, b) => scoreByMove.get(b) - scoreByMove.get(a)
                );
            }
            if (!completed || this.searchAborted || Date.now() >= deadline) break;
        }

        const finalMove = bestMove || orderedMoves[0] || legalMoves[0];
        if (finalMove) {
            const promotionChoice = this.getPromotionChoice(this.engine, finalMove, color);
            if (promotionChoice) finalMove.promotionChoice = promotionChoice;
        }

        return finalMove;
    }

    /**
     * Orders moves with MVV-LVA. Uses only the board and the average bank
     * value; it never clones the full state and never consumes state.rng.
     */
    orderMoves(state, moves, color, isHard) {
        const board = state.board;
        const oppColor = color === 'white' ? 'black' : 'white';
        const avgBank = state.deck.length
            ? state.deck.reduce((sum, c) => sum + (PIECE_VALUES[c.type] || 0), 0) / state.deck.length
            : 0;

        const scoredMoves = moves.map(m => {
            let priority = 0;
            const attacker = board.getPiece(m.from.r, m.from.c);
            const target = board.getPiece(m.to.r, m.to.c);

            if (m.isCapture && target) {
                const victimVal = PIECE_VALUES[target.type] || 100;
                const attackerVal = attacker ? (PIECE_VALUES[attacker.type] || 100) : 100;
                // The victim is replaced from the bank, so the net gain is
                // reduced by the average replacement value.
                priority += 1000 + (victimVal - avgBank) - attackerVal * 0.1;
            }

            // Checks priority (board-only simulation, used for ordering only)
            const simBoard = board.clone();
            const p = simBoard.getPiece(m.from.r, m.from.c);
            simBoard.removePiece(m.to.r, m.to.c);
            simBoard.removePiece(m.from.r, m.from.c);
            simBoard.setPiece(m.to.r, m.to.c, p);
            if (p) p.hasMoved = true;
            if (GameRules.isKingInCheck(simBoard, oppColor)) {
                priority += 300;
            }

            if (p && p.type === 'P') {
                const rankProgress = color === 'white' ? (7 - m.to.r) : m.to.r;
                priority += rankProgress * 15;
            }

            // Tiny random noise only in medium mode to vary play.
            if (!isHard) {
                priority += Math.random() * 20;
            }

            return { move: m, priority };
        });

        scoredMoves.sort((a, b) => b.priority - a.priority);
        return scoredMoves.map(sm => sm.move);
    }

    /**
     * Picks the promotion suit: the one the opponent currently has the most
     * material in. After a suit reset the promoted piece stays suitless.
     */
    getBestPromotionSuit(state, opponentColor) {
        if (state.suitsReset) return null;
        const suitScores = { spades: 10, clubs: 10, hearts: 10, diamonds: 10 };
        for (let r = 0; r < 8; r++) {
            for (let c = 0; c < 8; c++) {
                const piece = state.board.getPiece(r, c);
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

    /**
     * Returns { type: 'Q', suit } when the move promotes a pawn, otherwise null.
     */
    getPromotionChoice(state, move, color) {
        const piece = state.board.getPiece(move.from.r, move.from.c);
        if (!piece || piece.type !== 'P') return null;
        const promoRank = color === 'white' ? 0 : 7;
        if (move.to.r !== promoRank) return null;
        return {
            type: 'Q',
            suit: this.getBestPromotionSuit(state, color === 'white' ? 'black' : 'white')
        };
    }

    timeUp() {
        if (!this.searchDeadline) return false;
        if (this.searchAborted) return true;
        this._nodes++;
        if ((this._nodes & 127) !== 0) return false;
        if (Date.now() >= this.searchDeadline) {
            this.searchAborted = true;
            return true;
        }
        return false;
    }

    minimax(state, depth, alpha, beta, myColor, opponentColor, isHard, ply) {
        const currentColor = state.turn;
        const isMaximizing = currentColor === myColor;
        const legalMoves = GameRules.getAllLegalMoves(state.board, currentColor);

        if (legalMoves.length === 0) {
            if (state.status === 'checkmate') {
                return state.winner === myColor
                    ? MATE - ply
                    : -MATE + ply;
            }
            if (state.status === 'stalemate') return 0;
            // Safety for manually assembled states
            return GameRules.isKingInCheck(state.board, currentColor)
                ? (isMaximizing ? -MATE + ply : MATE - ply)
                : 0;
        }

        if (depth === 0 || this.timeUp()) {
            return this.evaluateState(state, myColor, opponentColor, isHard);
        }

        const orderedMoves = isHard
            ? this.orderMoves(state, legalMoves, currentColor, true)
            : legalMoves;

        if (isMaximizing) {
            let maxEval = -Infinity;
            for (const move of orderedMoves) {
                if (this.timeUp()) {
                    return this.evaluateState(state, myColor, opponentColor, isHard);
                }

                const next = state.cloneState();
                const promotionChoice = this.getPromotionChoice(next, move, currentColor);
                next.applyMoveCore(
                    move.from.r, move.from.c,
                    move.to.r, move.to.c,
                    promotionChoice
                );

                let evaluation;
                if (next.status === 'checkmate') {
                    evaluation = next.winner === myColor ? MATE - (ply + 1) : -MATE + (ply + 1);
                } else if (next.status === 'stalemate') {
                    evaluation = 0;
                } else {
                    evaluation = this.minimax(
                        next, depth - 1, alpha, beta,
                        myColor, opponentColor, isHard, ply + 1
                    );
                }

                maxEval = Math.max(maxEval, evaluation);
                alpha = Math.max(alpha, evaluation);
                if (beta <= alpha) break;
            }
            return maxEval;
        }

        let minEval = Infinity;
        for (const move of orderedMoves) {
            if (this.timeUp()) {
                return this.evaluateState(state, myColor, opponentColor, isHard);
            }

            const next = state.cloneState();
            const promotionChoice = this.getPromotionChoice(next, move, currentColor);
            next.applyMoveCore(
                move.from.r, move.from.c,
                move.to.r, move.to.c,
                promotionChoice
            );

            let evaluation;
            if (next.status === 'checkmate') {
                evaluation = next.winner === myColor ? MATE - (ply + 1) : -MATE + (ply + 1);
            } else if (next.status === 'stalemate') {
                evaluation = 0;
            } else {
                evaluation = this.minimax(
                    next, depth - 1, alpha, beta,
                    myColor, opponentColor, isHard, ply + 1
                );
            }

            minEval = Math.min(minEval, evaluation);
            beta = Math.min(beta, evaluation);
            if (beta <= alpha) break;
        }
        return minEval;
    }

    /**
     * Full-state evaluation: board heuristic plus reserves and delayed spawns.
     * The bank itself is neutral (it serves both sides); its effect is already
     * modelled by the real capture simulation.
     */
    evaluateState(state, myColor, opponentColor, isHard) {
        let score = this.evaluateBoard(state.board, myColor, opponentColor, isHard);

        const sign = myColor === 'white' ? 1 : -1;
        const reserveValue = list => list.reduce(
            (sum, p) => sum + (PIECE_VALUES[p.type] || 0), 0
        );

        score += sign * RESERVE_WEIGHT * (
            reserveValue(state.whiteReserve) - reserveValue(state.blackReserve)
        );

        const delayedValue = player => state.delayedSpawns
            .filter(d => d.player === player)
            .reduce((sum, d) => sum + (PIECE_VALUES[d.piece.type] || 0), 0);

        score += sign * DELAYED_WEIGHT * (
            delayedValue('white') - delayedValue('black')
        );

        return score;
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
            // 1. Check if my pieces are threatened by enemy pieces (matching suit or enemy King)
            for (const oppP of oppPieces) {
                const oppMoves = GameRules.getPseudoLegalMoves(board, oppP.r, oppP.c);
                for (const m of oppMoves) {
                    if (m.isCapture) {
                        const threatened = myPieces.find(p => p.r === m.r && p.c === m.c);
                        if (threatened && threatened.piece.type !== 'K') {
                            score -= (threatened.val * 0.65);
                        }
                    }
                }
            }

            // 2. Check if enemy pieces are vulnerable to my attacks (matching suit or my King)
            for (const myP of myPieces) {
                const myMoves = GameRules.getPseudoLegalMoves(board, myP.r, myP.c);
                for (const m of myMoves) {
                    if (m.isCapture) {
                        const targetOpp = oppPieces.find(p => p.r === m.r && p.c === m.c);
                        if (targetOpp && targetOpp.piece.type !== 'K') {
                            score += (targetOpp.val * 0.6);
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

        this.gameMode = 'hotseat'; // 'hotseat' | 'ai-white' | 'ai-black' | 'tutorial' | 'custom'
        this.difficulty = 'medium';
        this.aiSelectedSide = 'white'; // 'white' | 'black' | 'random'
        this.aiSelectedDiff = 'medium';// 'easy' | 'medium' | 'hard'
        this.customGameConfig = null;  // Last successfully started custom configuration

        // Custom opponent: committed state of the current game
        this.customOpponent = 'human';        // 'human' | 'ai'
        this.customAiSide = 'white';          // 'white' | 'black'
        this.customAiDifficulty = 'medium';   // 'easy' | 'medium' | 'hard'

        // Custom opponent: draft shown in the settings modal
        this.customOpponentDraft = 'human';

        // AI settings modal context
        this.aiModalContext = 'standard';     // 'standard' | 'custom'
        this.aiModalReturnToCustom = false;   // opened from the custom settings modal

        this.isFlipped = false;
        this.selectedSquare = null;    // { r, c }
        this.legalMoves = [];          // array of { r, c, isCapture }
        this.isAiThinking = false;
        this.hintSquares = null;       // { from: {r,c}, to: {r,c} }
        this.tutorialStep = 1;
        this.animatedPieceIds = new Set(); // Track pieces that already animated spawn
        this.aiTimer = null;           // Timeout id for AI turn
        this.gameToken = 0;            // Game session token to prevent race conditions
        this.drawOfferDeclined = false; // The player refused the threefold draw offer in this game
        this.toastTimer = null;         // Timeout id for the transient in-board notification

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
            gameMenuBtn: document.getElementById('gameMenuBtn'),
            gameMenuPanel: document.getElementById('gameMenuPanel'),
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
            modeCustomBtn: document.getElementById('modeCustomBtn'),
            aiActiveStatus: document.getElementById('aiActiveStatus'),
            aiStatusTag: document.getElementById('aiStatusTag'),
            changeAiSettingsBtn: document.getElementById('changeAiSettingsBtn'),

            // Custom Game Settings Modal
            customSettingsModal: document.getElementById('customSettingsModal'),
            closeCustomSettingsBtn: document.getElementById('closeCustomSettingsBtn'),
            cancelCustomSettingsBtn: document.getElementById('cancelCustomSettingsBtn'),
            startCustomGameBtn: document.getElementById('startCustomGameBtn'),
            customSuitCheckboxes: document.querySelectorAll('.custom-suit-checkbox'),
            customPieceCheckboxes: document.querySelectorAll('.custom-piece-checkbox'),
            customBankSlider: document.getElementById('customBankSlider'),
            customBankValue: document.getElementById('customBankValue'),
            customBankMaxLabel: document.getElementById('customBankMaxLabel'),
            customSummaryTotal: document.getElementById('customSummaryTotal'),
            customSummaryBank: document.getElementById('customSummaryBank'),
            customSummaryUnused: document.getElementById('customSummaryUnused'),
            customSummaryTopUpRow: document.getElementById('customSummaryTopUpRow'),
            customSummaryTopUp: document.getElementById('customSummaryTopUp'),
            customTopUpHint: document.getElementById('customTopUpHint'),
            customSettingsError: document.getElementById('customSettingsError'),
            customOpponentBtns: document.querySelectorAll('.custom-opponent-btn'),

            // AI Settings Modal
            aiSettingsModal: document.getElementById('aiSettingsModal'),
            closeAiSettingsBtn: document.getElementById('closeAiSettingsBtn'),
            cancelAiSettingsBtn: document.getElementById('cancelAiSettingsBtn'),
            startAiGameBtn: document.getElementById('startAiGameBtn'),
            sideOptionBtns: document.querySelectorAll('.side-option-btn[data-side]'),
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
            declineDrawBtn: document.getElementById('declineDrawBtn'),

            // Suit Draw Offer Modal (Empty bank, disjoint suits)
            suitDrawModal: document.getElementById('suitDrawModal'),
            acceptSuitDrawBtn: document.getElementById('acceptSuitDrawBtn'),
            declineSuitDrawBtn: document.getElementById('declineSuitDrawBtn'),

            // Promotion prompt (changes when suits are reset)
            promotionPrompt: document.getElementById('promotionPrompt'),

            // Ephemeral in-board notification
            gameToast: document.getElementById('gameToast')
        };
    }

    bindEvents() {
        // Floating game menu (Rules / Sound / Flip / New game)
        if (this.dom.gameMenuBtn && this.dom.gameMenuPanel) {
            this.dom.gameMenuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.toggleGameMenu();
            });

            // Choosing any menu item performs its own action and closes the menu
            this.dom.gameMenuPanel.addEventListener('click', (e) => {
                if (e.target.closest('button')) {
                    this.closeGameMenu(true);
                }
            });

            // Keyboard navigation inside the menu
            this.dom.gameMenuPanel.addEventListener('keydown', (e) => {
                const items = Array.from(this.dom.gameMenuPanel.querySelectorAll('button'));
                if (items.length === 0) return;
                const index = items.indexOf(document.activeElement);
                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    items[index < 0 ? 0 : (index + 1) % items.length].focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    items[index < 0 ? items.length - 1 : (index - 1 + items.length) % items.length].focus();
                } else if (e.key === 'Home') {
                    e.preventDefault();
                    items[0].focus();
                } else if (e.key === 'End') {
                    e.preventDefault();
                    items[items.length - 1].focus();
                }
            });

            // A click outside the menu and its trigger closes the menu
            document.addEventListener('click', (e) => {
                if (!this.dom.gameMenuPanel.classList.contains('open')) return;
                if (this.dom.gameMenuBtn.contains(e.target) ||
                    this.dom.gameMenuPanel.contains(e.target)) return;
                this.closeGameMenu();
            });

            // Escape closes the menu and returns focus to its trigger
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && this.dom.gameMenuPanel.classList.contains('open')) {
                    this.closeGameMenu(true);
                }
            });
        }

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
                this.engine.drawReason = 'agreement';
                // Refresh immediately so the player panels reflect the draw
                this.renderAll();
                this.showVictoryModal('Ничья!', 'Партия завершена ничьей по соглашению игроков (троекратное повторение позиции).');
            });
        }
        if (this.dom.declineDrawBtn) {
            this.dom.declineDrawBtn.addEventListener('click', () => {
                this.dom.drawOfferModal.classList.remove('open');
                // Refusing once silences the offer for the rest of the game,
                // otherwise it would pop up again on every later move.
                this.drawOfferDeclined = true;
                // In tutorial mode the bot may still owe a reply
                this.checkTriggerAI();
            });
        }
        if (this.dom.drawOfferModal) {
            this.dom.drawOfferModal.addEventListener('click', (e) => {
                if (e.target === this.dom.drawOfferModal) {
                    this.dom.drawOfferModal.classList.remove('open');
                    // Closing the modal counts as a refusal as well
                    this.drawOfferDeclined = true;
                    this.checkTriggerAI();
                }
            });
        }

        // Suit draw offer (empty bank, disjoint suits). It cannot be dismissed
        // without an explicit choice: no backdrop click handler is attached.
        if (this.dom.acceptSuitDrawBtn) {
            this.dom.acceptSuitDrawBtn.addEventListener('click', () => this.acceptSuitDrawOffer());
        }
        if (this.dom.declineSuitDrawBtn) {
            this.dom.declineSuitDrawBtn.addEventListener('click', () => this.declineSuitDrawOffer());
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
            this.openAiSettings('standard');
        });
        this.dom.changeAiSettingsBtn.addEventListener('click', () => {
            const context = this.isCustomAiGame() ? 'custom' : 'standard';
            this.openAiSettings(context);
        });
        this.dom.closeAiSettingsBtn.addEventListener('click', () => {
            this.closeAiSettings();
        });
        this.dom.cancelAiSettingsBtn.addEventListener('click', () => {
            this.closeAiSettings();
        });

        // Custom opponent selection («Своя игра»)
        this.dom.customOpponentBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                const choice = btn.dataset.opponent;
                if (choice !== 'human' && choice !== 'ai') return;

                this.customOpponentDraft = choice;
                this.refreshCustomOpponentButtons();

                if (choice === 'ai') {
                    this.openAiSettings('custom', { returnToCustom: true });
                }
            });
        });

        // AI Side Selection
        this.dom.sideOptionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.aiSelectedSide = e.currentTarget.dataset.side;
                this.refreshAiSelectionButtons();
            });
        });

        // AI Difficulty Selection
        this.dom.diffOptionBtns.forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.aiSelectedDiff = e.currentTarget.dataset.diff;
                this.refreshAiSelectionButtons();
            });
        });

        // Start AI Game Button
        this.dom.startAiGameBtn.addEventListener('click', () => {
            if (this.aiModalContext === 'custom') {
                this.startCustomAiGame();
            } else {
                this.startStandardAiGame();
            }
        });

        // Mode Switching: Tutorial Mode
        this.dom.modeTutorialBtn.addEventListener('click', () => {
            this.setActiveModeBtn(this.dom.modeTutorialBtn);
            this.gameMode = 'tutorial';
            this.difficulty = 'easy'; // Tutorial always plays against the beginner bot
            this.dom.aiActiveStatus.style.display = 'none';
            this.dom.tutorialCard.style.display = 'block';
            this.dom.tutorialTipText.textContent = '💡 Вы играете белыми против бота-новичка. Наводите на фигуры для подсветки целей, используйте подсказки и отмену ходов!';
            this.isFlipped = false;
            this.startNewGame();
        });

        // Mode Switching: Custom Game (the click only opens the settings modal)
        this.dom.modeCustomBtn.addEventListener('click', () => this.openCustomSettings());
        this.dom.closeCustomSettingsBtn.addEventListener('click', () => this.closeCustomSettings());
        this.dom.cancelCustomSettingsBtn.addEventListener('click', () => this.closeCustomSettings());
        this.dom.startCustomGameBtn.addEventListener('click', () => this.startCustomGame());

        this.dom.customSuitCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => this.refreshCustomSettings());
        });
        this.dom.customPieceCheckboxes.forEach(cb => {
            cb.addEventListener('change', () => this.refreshCustomSettings());
        });
        this.dom.customBankSlider.addEventListener('input', () => this.refreshCustomSettings());

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

    /**
     * Toggles the floating game menu.
     */
    toggleGameMenu() {
        if (this.dom.gameMenuPanel.classList.contains('open')) {
            this.closeGameMenu(true);
        } else {
            this.openGameMenu();
        }
    }

    openGameMenu() {
        this.dom.gameMenuPanel.classList.add('open');
        this.dom.gameMenuBtn.setAttribute('aria-expanded', 'true');
    }

    closeGameMenu(returnFocus = false) {
        const wasOpen = this.dom.gameMenuPanel.classList.contains('open');
        this.dom.gameMenuPanel.classList.remove('open');
        this.dom.gameMenuBtn.setAttribute('aria-expanded', 'false');
        if (wasOpen && returnFocus) {
            this.dom.gameMenuBtn.focus();
        }
    }

    setActiveModeBtn(activeBtn) {
        this.dom.modeButtons.forEach(b => b.classList.remove('active'));
        if (activeBtn) activeBtn.classList.add('active');
    }

    isCustomAiGame() {
        return this.gameMode === 'custom' && this.customOpponent === 'ai';
    }

    /**
     * Returns the color played by the computer, or null in human-only modes.
     * `customAiSide` is the human player's side, so the AI takes the opposite.
     */
    getAiSide() {
        if (this.gameMode === 'ai-white') return 'black';
        if (this.gameMode === 'ai-black') return 'white';
        if (this.gameMode === 'tutorial') return 'black';
        if (this.isCustomAiGame()) {
            return this.customAiSide === 'white' ? 'black' : 'white';
        }
        return null;
    }

    refreshCustomOpponentButtons() {
        this.dom.customOpponentBtns.forEach(btn => {
            btn.classList.toggle(
                'active',
                btn.dataset.opponent === this.customOpponentDraft
            );
        });
    }

    refreshAiSelectionButtons() {
        this.dom.sideOptionBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.side === this.aiSelectedSide);
        });
        this.dom.diffOptionBtns.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.diff === this.aiSelectedDiff);
        });
    }

    getDifficultyLabel(diff = this.difficulty) {
        const names = {
            easy: 'Новичок',
            medium: 'Гроссмейстер',
            hard: 'Аналитик'
        };
        return names[diff] || names.medium;
    }

    updateCustomAiStatusTag() {
        if (!this.isCustomAiGame()) return;
        const sideName = this.customAiSide === 'white' ? 'Белые' : 'Чёрные';
        this.dom.aiStatusTag.textContent =
            `🤖 ИИ: ${this.getDifficultyLabel(this.customAiDifficulty)} (вы: ${sideName})`;
    }

    openAiSettings(context = 'standard', options = {}) {
        this.aiModalContext = context;
        this.aiModalReturnToCustom = Boolean(options.returnToCustom);

        if (context === 'custom') {
            // Keep the custom settings window open behind the AI settings.
            // Only this layered case needs the raised overlay; opening the
            // AI settings from the HUD uses the normal modal style.
            if (this.aiModalReturnToCustom) {
                this.dom.aiSettingsModal.classList.add('modal-stacked');
                this.dom.customSettingsModal.classList.add('modal-behind');
            } else {
                this.dom.aiSettingsModal.classList.remove('modal-stacked');
                this.dom.customSettingsModal.classList.remove('modal-behind');
            }

            // Show the settings of the active custom AI game, if any.
            if (this.isCustomAiGame()) {
                this.aiSelectedSide = this.customAiSide;
                this.aiSelectedDiff = this.customAiDifficulty;
            }
        } else {
            this.dom.aiSettingsModal.classList.remove('modal-stacked');
            this.dom.customSettingsModal.classList.remove('modal-behind');
        }

        this.refreshAiSelectionButtons();
        this.dom.aiSettingsModal.classList.add('open');
    }

    closeAiSettings() {
        this.dom.aiSettingsModal.classList.remove('open');
        this.dom.aiSettingsModal.classList.remove('modal-stacked');
        this.dom.customSettingsModal.classList.remove('modal-behind');

        const returnToCustom = this.aiModalContext === 'custom' &&
            this.aiModalReturnToCustom;

        this.aiModalContext = 'standard';
        this.aiModalReturnToCustom = false;

        if (returnToCustom) {
            // Cancelling the AI settings discards the AI choice but keeps the
            // custom configuration draft untouched. The custom modal stayed
            // open the whole time; make sure it is still visible.
            this.customOpponentDraft = 'human';
            this.refreshCustomOpponentButtons();
            this.dom.customSettingsModal.classList.add('open');
        }
    }

    startStandardAiGame() {
        this.dom.aiSettingsModal.classList.remove('open');
        this.dom.aiSettingsModal.classList.remove('modal-stacked');
        this.dom.customSettingsModal.classList.remove('modal-behind');
        this.aiModalContext = 'standard';
        this.aiModalReturnToCustom = false;
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

        const sideName = chosenSide === 'white' ? 'Белые' : 'Чёрные';
        this.dom.aiStatusTag.textContent =
            `🤖 ИИ: ${this.getDifficultyLabel(this.difficulty)} (вы: ${sideName})`;
        this.dom.aiActiveStatus.style.display = 'flex';
        this.dom.tutorialCard.style.display = 'none';

        this.startNewGame();
    }

    startCustomAiGame() {
        let config;
        try {
            // Launching from «Своя игра» uses its current draft. Restarting
            // from the in-game AI settings button must ignore a cancelled
            // draft and reuse the last successfully applied configuration.
            const source = this.aiModalReturnToCustom
                ? this.getCustomFormConfig()
                : (this.customGameConfig || this.getCustomFormConfig());
            config = validateGameConfig(source);
        } catch (err) {
            this.returnToCustomSettings(err.message);
            return;
        }

        let chosenSide = this.aiSelectedSide;
        if (chosenSide === 'random') {
            chosenSide = Math.random() < 0.5 ? 'white' : 'black';
        }

        const result = this.startNewGame(config, {
            opponent: 'ai',
            aiSide: chosenSide,
            aiDifficulty: this.aiSelectedDiff
        });

        if (!result || !result.ok) {
            const message = result && result.error && result.error.message
                ? result.error.message
                : 'Не удалось начать игру с выбранными настройками.';
            this.returnToCustomSettings(message);
            return;
        }

        this.dom.aiSettingsModal.classList.remove('open');
        this.dom.aiSettingsModal.classList.remove('modal-stacked');
        this.dom.customSettingsModal.classList.remove('open');
        this.dom.customSettingsModal.classList.remove('modal-behind');
        this.aiModalContext = 'standard';
        this.aiModalReturnToCustom = false;
    }

    returnToCustomSettings(message) {
        this.dom.aiSettingsModal.classList.remove('open');
        this.dom.aiSettingsModal.classList.remove('modal-stacked');
        this.dom.customSettingsModal.classList.remove('modal-behind');
        this.aiModalContext = 'standard';
        this.aiModalReturnToCustom = false;
        this.dom.customSettingsError.textContent = message;
        this.refreshCustomOpponentButtons(); // keep «Против ИИ» selected
        this.dom.customSettingsModal.classList.add('open');
    }

    /**
     * Opens the custom game settings. The form shows the last successfully
     * applied configuration, or the full standard deck on first launch.
     */
    openCustomSettings() {
        this.dom.customSettingsModal.classList.remove('modal-behind');
        this.customOpponentDraft = this.customOpponent;
        this.refreshCustomOpponentButtons();

        const config = this.customGameConfig || getDefaultGameConfig();
        const normalized = normalizeGameConfig(config);
        const suitSet = new Set(normalized.suits);
        const pieceSet = new Set(normalized.pieces);

        this.dom.customSuitCheckboxes.forEach(cb => {
            cb.checked = suitSet.has(cb.value);
        });
        this.dom.customPieceCheckboxes.forEach(cb => {
            cb.checked = pieceSet.has(cb.value);
        });

        const maxBank = getMaxBankSize(normalized);
        this.dom.customBankSlider.max = String(maxBank);
        this.dom.customBankSlider.value = String(Math.min(Math.max(normalized.bankSize, 0), maxBank));
        this.dom.customSettingsError.textContent = '';
        this.refreshCustomSettings();
        this.dom.customSettingsModal.classList.add('open');
    }

    /**
     * Closes the modal and discards the draft: nothing is applied until the
     * game starts successfully.
     */
    closeCustomSettings() {
        this.dom.customSettingsModal.classList.remove('open');
    }

    getCustomFormConfig() {
        return {
            suits: Array.from(this.dom.customSuitCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value),
            pieces: Array.from(this.dom.customPieceCheckboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value),
            bankSize: Number(this.dom.customBankSlider.value)
        };
    }

    /**
     * Recalculates the bank limit and the summary from the current draft.
     */
    refreshCustomSettings() {
        const config = this.getCustomFormConfig();
        const total = getDeckCardCount(config);
        const maxBank = getMaxBankSize(config);
        const slider = this.dom.customBankSlider;

        slider.max = String(maxBank);
        let bankSize = Number(slider.value);
        if (!Number.isFinite(bankSize)) bankSize = 0;
        bankSize = Math.trunc(bankSize);
        if (bankSize < 0) bankSize = 0;
        if (bankSize > maxBank) bankSize = maxBank;
        slider.value = String(bankSize);

        const unused = Math.max(0, total - 2 * STARTING_HAND_SIZE - bankSize);
        const shortfall = getStartingDealShortfall(config);

        this.dom.customBankValue.textContent = String(bankSize);
        this.dom.customBankMaxLabel.textContent = String(maxBank);
        this.dom.customSummaryTotal.textContent = String(total);
        this.dom.customSummaryBank.textContent = String(bankSize);
        this.dom.customSummaryUnused.textContent = String(unused);

        if (this.dom.customSummaryTopUpRow) {
            this.dom.customSummaryTopUpRow.style.display = shortfall > 0 ? '' : 'none';
        }
        if (this.dom.customSummaryTopUp) {
            this.dom.customSummaryTopUp.textContent = String(shortfall);
        }
        if (this.dom.customTopUpHint) {
            this.dom.customTopUpHint.style.display = shortfall > 0 ? '' : 'none';
        }

        // A previous error no longer applies after the user edits the form.
        if (this.dom.customSettingsError.textContent) {
            this.dom.customSettingsError.textContent = '';
        }
    }

    /**
     * Validates the draft and only then starts a new game. On failure the
     * modal stays open with an explanation and the current game is untouched.
     */
    startCustomGame() {
        if (this.customOpponentDraft === 'ai') {
            this.openAiSettings('custom', { returnToCustom: true });
            return;
        }

        let config;
        try {
            config = validateGameConfig(this.getCustomFormConfig());
        } catch (err) {
            this.dom.customSettingsError.textContent = err.message;
            return;
        }

        const result = this.startNewGame(config, { opponent: 'human' });
        if (!result || !result.ok) {
            const message = result && result.error && result.error.message
                ? result.error.message
                : 'Не удалось начать игру с выбранными настройками.';
            this.dom.customSettingsError.textContent = message;
            return;
        }

        this.closeCustomSettings();
    }

    /**
     * Accepting the empty-bank suit offer ends the game in an agreed draw.
     */
    acceptSuitDrawOffer() {
        if (!this.engine.pendingSuitOffer) return;
        if (this.dom.suitDrawModal) {
            this.dom.suitDrawModal.classList.remove('open');
        }
        this.engine.status = 'stalemate';
        this.engine.winner = 'draw';
        this.engine.drawReason = 'suits_agreement';
        this.engine.pendingSuitOffer = false;
        this.engine.suitsResolved = true;
        this.renderAll();
        this.showVictoryModal(
            'Ничья!',
            'Партия завершена ничьей: у игроков фигуры разных мастей, а банк закончился.'
        );
    }

    /**
     * Declining the offer drops all suits and continues the game.
     */
    declineSuitDrawOffer() {
        if (!this.engine.pendingSuitOffer) return;
        if (this.dom.suitDrawModal) {
            this.dom.suitDrawModal.classList.remove('open');
        }
        this.engine.resetSuits();
        this.engine.suitsResolved = true;
        this.engine.pendingSuitOffer = false;
        // The suitless position is new, so its first occurrence must be counted
        this.engine.recordCurrentPosition();
        this.selectedSquare = null;
        this.legalMoves = [];
        this.renderAll();
        this.showToast('Масти сброшены');
        this.checkTriggerAI();
    }

    /**
     * Shows a short non-blocking notification over the board.
     */
    showToast(message) {
        if (!this.dom.gameToast) return;
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
            this.toastTimer = null;
        }
        this.dom.gameToast.textContent = message;
        this.dom.gameToast.classList.add('visible');
        this.toastTimer = setTimeout(() => {
            this.dom.gameToast.classList.remove('visible');
            this.toastTimer = null;
        }, 3000);
    }

    hideToast() {
        if (this.toastTimer) {
            clearTimeout(this.toastTimer);
            this.toastTimer = null;
        }
        if (this.dom.gameToast) {
            this.dom.gameToast.classList.remove('visible');
            this.dom.gameToast.textContent = '';
        }
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

    async showTutorialHint() {
        if (this.isAiThinking) return;
        this.isAiThinking = true;
        const gameToken = this.gameToken;

        let bestMove = null;
        try {
            bestMove = await this.ai.findBestMove(this.engine.turn, 'hard');
        } finally {
            // Only release the flag if this game session is still the active one
            if (this.gameToken === gameToken) {
                this.isAiThinking = false;
            }
        }

        // A "New Game" (or mode switch) happened while the AI was calculating: discard the result
        if (this.gameToken !== gameToken) return;

        if (!bestMove) {
            this.dom.tutorialTipText.textContent = 'Нет доступных ходов.';
            return;
        }

        this.hintSquares = { from: bestMove.from, to: bestMove.to };
        this.renderBoard();

        const p = this.engine.board.getPiece(bestMove.from.r, bestMove.from.c);
        if (!p) {
            // The piece disappeared (e.g. the position was replaced): drop the stale hint
            this.hintSquares = null;
            this.renderBoard();
            return;
        }
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

        // Undo always dismisses an open empty-bank offer; the restored snapshot
        // also brings back the pending/suits flags from before the move.
        if (this.dom.suitDrawModal) {
            this.dom.suitDrawModal.classList.remove('open');
        }

        const success = this.engine.undoMove();
        if (!success) {
            if (this.gameMode === 'tutorial') {
                this.dom.tutorialTipText.textContent = 'Вы в начале партии, ходов для отмены нет.';
            }
            return;
        }

        // If playing against AI, undo once more if we landed on AI's turn
        if (this.isVersusBot() && this.isAiTurn()) {
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

        // If after undo it is AI's turn, trigger AI
        if (this.isAiTurn()) {
            this.checkTriggerAI();
        }
    }

    isVersusBot() {
        return this.gameMode === 'ai-white' ||
               this.gameMode === 'ai-black' ||
               this.gameMode === 'tutorial' ||
               this.isCustomAiGame();
    }

    isAiTurn() {
        if (this.gameMode === 'custom') {
            return this.isCustomAiGame() &&
                   this.engine.turn !== this.customAiSide;
        }

        return (this.gameMode === 'ai-white' && this.engine.turn === 'black') ||
               (this.gameMode === 'ai-black' && this.engine.turn === 'white') ||
               (this.gameMode === 'tutorial' && this.engine.turn === 'black');
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
                // Rebuild in reverse chronological order as well.
                this.dom.historyTableBody.prepend(tr);
            } else {
                const blackTd = document.getElementById(`move-${moveNum}-black`);
                if (blackTd) {
                    blackTd.innerHTML = `<strong>${move.notation}</strong>`;
                }
            }
        }

        const container = document.querySelector('.history-table-container');
        if (container) {
            container.scrollTop = 0;
        }
    }

    /**
     * Starts a new game.
     *
     * An explicit custom configuration is validated and dealt inside the engine
     * before any UI state is touched, so a failed configuration cannot disturb
     * the current game. Without an explicit configuration the standard deck is
     * used, except that an active custom game reuses its saved settings.
     */
    startNewGame(config = undefined, customOptions = null) {
        const explicitCustom = config !== undefined && config !== null;
        const effectiveConfig = explicitCustom
            ? config
            : (this.gameMode === 'custom' ? this.customGameConfig : null);

        let appliedConfig = null;
        try {
            this.engine.startNewGame(null, effectiveConfig);
            if (effectiveConfig) {
                appliedConfig = normalizeGameConfig(effectiveConfig);
            }
        } catch (err) {
            return { ok: false, error: err };
        }

        if (appliedConfig) {
            const opponent = (customOptions && customOptions.opponent)
                ? customOptions.opponent
                : this.customOpponent;

            this.customGameConfig = appliedConfig;
            this.gameMode = 'custom';
            this.customOpponent = opponent;

            if (opponent === 'ai') {
                // customAiSide is the human player's side, so the AI takes the
                // opposite color and the board is flipped when the human is black.
                let aiSide = (customOptions && customOptions.aiSide)
                    ? customOptions.aiSide
                    : this.customAiSide;
                if (aiSide === 'random') {
                    aiSide = Math.random() < 0.5 ? 'white' : 'black';
                }
                this.customAiSide = aiSide;

                if (customOptions && customOptions.aiDifficulty) {
                    this.customAiDifficulty = customOptions.aiDifficulty;
                }
                this.difficulty = this.customAiDifficulty;

                this.updateCustomAiStatusTag();
                this.dom.aiActiveStatus.style.display = 'flex';
                this.isFlipped = aiSide === 'black';
            } else {
                this.dom.aiActiveStatus.style.display = 'none';
                this.isFlipped = false;
            }

            this.setActiveModeBtn(this.dom.modeCustomBtn);
            this.dom.tutorialCard.style.display = 'none';
        }

        if (this.aiTimer) {
            clearTimeout(this.aiTimer);
            this.aiTimer = null;
        }
        this.gameToken++;
        this.isAiThinking = false;
        this.drawOfferDeclined = false;

        this.selectedSquare = null;
        this.legalMoves = [];
        this.hintSquares = null;
        this.animatedPieceIds.clear();
        this.dom.historyTableBody.innerHTML = '';
        const historyContainer = document.querySelector('.history-table-container');
        if (historyContainer) {
            historyContainer.scrollTop = 0;
        }
        this.dom.victoryModal.classList.remove('open');
        if (this.dom.drawOfferModal) {
            this.dom.drawOfferModal.classList.remove('open');
        }
        if (this.dom.suitDrawModal) {
            this.dom.suitDrawModal.classList.remove('open');
        }
        this.hideToast();
        if (this.dom.promotionModal) {
            this.dom.promotionModal.classList.remove('open');
        }

        this.renderAll();
        sounds.spawn();

        this.checkTriggerAI();

        return { ok: true, config: appliedConfig };
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
    }

    renderBoard() {
        this.dom.board.innerHTML = '';
        this.renderCoordinates();

        const rows = this.isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];
        const cols = this.isFlipped ? [7, 6, 5, 4, 3, 2, 1, 0] : [0, 1, 2, 3, 4, 5, 6, 7];

        const kingInCheck = !this.engine.drawReason &&
            (this.engine.status === 'check' || this.engine.status === 'checkmate');
        // NOTE: 'repetition', 'stalemate' and agreed draws are game-over conditions, never a check,
        // so the king is not highlighted for them.

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
                // A suitless piece (after the suit reset) can capture any enemy piece,
                // so every enemy piece is highlighted.
                if (piece.type === 'K' || !piece.suit || targetPiece.type === 'K' ||
                    (targetPiece.suit === piece.suit)) {
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
        if (this.engine.pendingSuitOffer) return;
        if (this.engine.isGameOver()) return;

        // Check if it's user's turn in AI mode
        if (this.isAiTurn()) return;

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
        const suitKeys = this.engine.getActiveSuits();
        const suitsReset = this.engine.suitsReset;

        if (this.dom.promotionPrompt) {
            this.dom.promotionPrompt.textContent = suitsReset
                ? 'Выберите новую фигуру (масти сброшены):'
                : 'Выберите новую фигуру и её масть:';
        }

        pieceTypes.forEach(type => {
            if (suitsReset) {
                // After the suit reset only the piece type can be chosen.
                const btn = document.createElement('button');
                btn.className = 'promotion-option-btn';
                btn.title = `${PIECE_NAMES[type]} (без масти)`;
                btn.innerHTML = `
                    <div class="piece-svg">${PIECE_SVGS[color][type]}</div>
                    <div class="suit-badge suit-none"></div>
                `;

                btn.addEventListener('click', () => {
                    this.dom.promotionModal.classList.remove('open');
                    sounds.spawn();
                    onSelect({ type, suit: null });
                });

                grid.appendChild(btn);
                return;
            }

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
            if (this.gameMode === 'tutorial') {
                if (result.winner === 'white') {
                    this.showVictoryModal('Мат! Вы победили!', 'Вы поставили мат боту-новичку. Отличная работа!');
                } else {
                    this.showVictoryModal('Мат! Победил бот-новичок', 'Бот-новичок поставил мат. Попробуйте ещё раз — подсказка и отмена хода помогут.');
                }
            } else if (this.isCustomAiGame()) {
                const aiSideName = this.customAiSide === 'white' ? 'Чёрные' : 'Белые';

                if (result.winner === this.customAiSide) {
                    this.showVictoryModal(
                        'Мат! Вы победили!',
                        `Вы поставили мат компьютеру (${this.customAiSide === 'white' ? 'Белые' : 'Чёрные'}).`
                    );
                } else {
                    this.showVictoryModal(
                        'Мат! Победил компьютер',
                        `Компьютер (${aiSideName}) поставил мат.`
                    );
                }
            } else {
                const winnerName = result.winner === 'white' ? 'Белых' : 'Чёрных';
                this.showVictoryModal(`Мат! Победа ${winnerName}`, `Игрок (${winnerName}) поставил мат сопернику.`);
            }
            return;
        } else if (result.status === 'stalemate') {
            this.showVictoryModal(`Пат! Ничья`, `У игрока нет доступных ходов, но король не под шахом.`);
            return;
        }

        // Empty-bank suit draw offer: the game is paused until the player chooses.
        if (result.suitDrawOffer) {
            if (this.dom.suitDrawModal) {
                this.dom.suitDrawModal.classList.add('open');
            }
            return;
        }

        // Threefold Repetition Check
        if (result.threefold) {
            const aiOpponentMode = this.gameMode === 'ai-white' ||
                                   this.gameMode === 'ai-black' ||
                                   this.isCustomAiGame();

            if (aiOpponentMode) {
                const aiSide = this.getAiSide();
                // Dedicated status: it is a loss, but NOT a check/mate (no "МАТ!" text, no check highlight)
                this.engine.status = 'repetition';
                this.engine.winner = aiSide;
                this.renderAll();
                sounds.check();
                this.showVictoryModal('Поражение игроку!', 'Зафиксировано троекратное повторение позиции. При игре против ИИ засчитано поражение игроку.');
                return;
            } else {
                // The offer was already refused once in this game: keep playing silently
                if (this.dom.drawOfferModal && !this.drawOfferDeclined) {
                    this.dom.drawOfferModal.classList.add('open');
                }
                return;
            }
        }

        // Trigger AI if necessary
        this.checkTriggerAI();
    }

    checkTriggerAI() {
        if (this.aiTimer) {
            clearTimeout(this.aiTimer);
            this.aiTimer = null;
        }

        const isAiTurn = this.isAiTurn();
        if (!isAiTurn || this.engine.isGameOver() || this.engine.pendingSuitOffer) {
            this.isAiThinking = false;
            return;
        }

        this.isAiThinking = true;
        this.renderPlayerPanels();
        const currentToken = this.gameToken;

        this.aiTimer = setTimeout(async () => {
            this.aiTimer = null;

            // Validate state before making move: token matches, still AI turn, game not over
            if (this.gameToken !== currentToken) return;
            if (!this.isAiTurn() || this.engine.isGameOver() || this.engine.pendingSuitOffer) {
                this.isAiThinking = false;
                this.renderAll();
                return;
            }

            try {
                const bestMove = await this.ai.findBestMove(this.engine.turn, this.difficulty);
                // Check again after async calculation
                if (this.gameToken !== currentToken) return;
                if (!this.isAiTurn() || this.engine.isGameOver() || this.engine.pendingSuitOffer) return;

                if (bestMove) {
                    this.executeMove(bestMove.from.r, bestMove.from.c, bestMove.to.r, bestMove.to.c, bestMove.promotionChoice);
                }
            } finally {
                if (this.gameToken === currentToken) {
                    this.isAiThinking = false;
                    // executeMove() rendered while the "thinking" flag was still set, so the
                    // panels were skipped. Always refresh them afterwards (mate included).
                    this.renderAll();
                }
            }
        }, 650);
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
        const aiSide = this.getAiSide();
        const sideName = isWhite ? 'Белые' : 'Чёрные';
        let displayName;

        if (aiSide === color) {
            displayName = `Компьютер (${sideName})`;
        } else if (aiSide) {
            displayName = this.gameMode === 'tutorial'
                ? `Вы (${sideName})`
                : `Игрок (${sideName})`;
        } else {
            displayName = sideName;
        }

        if (avatarEl) {
            avatarEl.className = `player-avatar ${isWhite ? 'white-avatar' : 'black-avatar'}`;
            avatarEl.textContent = isWhite ? '♔' : '♚';
        }

        nameEl.textContent = displayName;

        const isAiSide = aiSide === color;

        if (isTurn) {
            const inCheck = this.engine.status === 'check';
            if (inCheck) {
                statusEl.textContent = '⚠️ Король под шахом!';
                statusEl.style.color = '#f43f5e';
            } else if (isAiSide) {
                statusEl.textContent = this.isAiThinking ? 'Компьютер думает…' : 'Ход компьютера';
                statusEl.style.color = '#fbbf24';
            } else {
                statusEl.textContent = 'Ваш ход';
                statusEl.style.color = '#fbbf24';
            }
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
                const badgeHtml = p.suit && SUITS[p.suit]
                    ? `<div class="suit-badge suit-${p.suit}">${SUITS[p.suit].symbol}</div>`
                    : '<div class="suit-badge suit-none"></div>';
                miniCard.innerHTML = `
                    <div class="piece-svg">${PIECE_SVGS[p.color][p.type]}</div>
                    ${badgeHtml}
                `;
                let bishopDesc = '';
                if (p.type === 'B' && p.squareColor) {
                    bishopDesc = p.squareColor === 'light' ? ' (белопольный)' : ' (чернопольный)';
                }
                const suitDesc = p.suit && SUITS[p.suit] ? SUITS[p.suit].name : 'без масти';
                miniCard.title = `${PIECE_NAMES[p.type]}${bishopDesc} (${suitDesc}) в резерве`;
                reserveSlotsEl.appendChild(miniCard);
            });
        }

        // Captures
        const captures = isWhite ? this.engine.capturedBlack : this.engine.capturedWhite;
        capturesListEl.innerHTML = '';
        captures.forEach(c => {
            const capSpan = document.createElement('span');
            capSpan.className = 'capture-item';
            const suitInfo = c.suit ? SUITS[c.suit] : null;
            const sym = suitInfo ? suitInfo.symbol : '';
            capSpan.innerHTML = `<strong>${c.type}</strong><span style="color:${suitInfo ? suitInfo.color : '#fff'}">${sym}</span>`;
            capturesListEl.appendChild(capSpan);
        });
    }

    renderDeck() {
        this.dom.deckCounter.textContent = this.engine.deck.length;
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
            // Newest move goes first: the history is read top-to-bottom.
            this.dom.historyTableBody.prepend(tr);
        } else {
            const blackTd = document.getElementById(`move-${moveNum}-black`);
            if (blackTd) {
                blackTd.innerHTML = `<strong>${lastMove.notation}</strong>`;
            }
        }

        // The newest move is at the top, so keep the history scrolled there.
        const container = document.querySelector('.history-table-container');
        if (container) {
            container.scrollTop = 0;
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
