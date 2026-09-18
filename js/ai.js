/**
 * Chess Durak - Intelligent AI Engine
 */

import { GameRules } from './rules.js';
import { PIECE_VALUES } from './pieces.js';

export class ChessDurakAI {
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
