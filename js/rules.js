/**
 * Chess Durak - Core Rules, Move Validation, Suit Captures, Bank Spawning & Reserves
 */

import { SUITS, createPiece, createDeck, PIECE_NAMES } from './pieces.js';
import { Board } from './board.js';

export class GameRules {
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
export class GameEngine {
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
