/**
 * Chess Durak - Main Application Controller
 */

import { GameEngine, GameRules } from './rules.js';
import { renderPieceElement, SUITS, PIECE_NAMES, PIECE_SVGS } from './pieces.js';
import { ChessDurakAI } from './ai.js';
import { sounds } from './sound.js';

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
