/**
 * Chess Durak - Board representation and coordinate helpers
 */

import { createPiece, generatePiecesWithSum, getRandomStartingPoints } from './pieces.js';

export class Board {
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
