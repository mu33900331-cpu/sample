// グリッドの設定
const COLS = 6;
const ROWS = 12;
const COLORS = [1, 2, 3, 4]; // 4色

// ===== Pieceクラス =====
// 落下中のペア（2つのボール）を管理する
class Piece {
    constructor(topColor, bottomColor) {
        this.x = Math.floor(COLS / 2) - 1; // 初期水平位置（中央）
        this.y = -1; // 画面外から開始
        this.rotation = 0; // 0:縦 1:横 2:逆縦 3:逆横
        this.colors = [topColor, bottomColor];
    }

    // 現在の回転に基づいて2つのボールの位置を返す
    getPositions() {
        const { x, y, rotation } = this;
        switch (rotation) {
            case 0: return [{ x, y }, { x, y: y + 1 }];       // 上が colors[0], 下が colors[1]
            case 1: return [{ x, y }, { x: x + 1, y }];       // 左が colors[0], 右が colors[1]
            case 2: return [{ x, y: y + 1 }, { x, y }];       // 下が colors[0], 上が colors[1]（逆さ）
            case 3: return [{ x: x + 1, y }, { x, y }];       // 右が colors[0], 左が colors[1]（逆さ）
            default: return [{ x, y }, { x, y: y + 1 }];
        }
    }

    // 時計回りに90度回転
    rotateClockwise() {
        this.rotation = (this.rotation + 1) % 4;
    }
}

// ===== Boardクラス =====
// 6x12グリッドのデータと消去・重力ロジックを管理する
class Board {
    constructor(cols, rows) {
        this.cols = cols;
        this.rows = rows;
        this.grid = this._createEmptyGrid();
    }

    // 空のグリッドを生成
    _createEmptyGrid() {
        return Array(this.rows).fill(null).map(() => Array(this.cols).fill(0));
    }

    // グリッドをリセット
    clear() {
        this.grid = this._createEmptyGrid();
    }

    // 指定位置にピースを配置できるか判定
    isValidPosition(x, y, rotation) {
        const tempPiece = new Piece(0, 0);
        tempPiece.x = x;
        tempPiece.y = y;
        tempPiece.rotation = rotation;
        const positions = tempPiece.getPositions();

        for (const pos of positions) {
            if (pos.x < 0 || pos.x >= this.cols) return false;
            if (pos.y >= this.rows) return false;
            if (pos.y >= 0 && this.grid[pos.y][pos.x] !== 0) return false;
        }
        return true;
    }

    /**
     * ピースをグリッドに固定する。
     * ボールをy座標の降順（下から）に1つずつグリッドに書き込みながら落下先を計算することで、
     * 縦並び時に下のボールが先に着地し、上のボールがその直上に正しく止まるようにする。
     */
    addPiece(piece) {
        const positions = piece.getPositions();
        const balls = positions.map((pos, index) => ({
            x: pos.x,
            y: pos.y,
            color: piece.colors[index],
        }));

        // 下にあるボール（y が大きい）から先に処理することで
        // 縦並び時に下のボールが着地済みの状態で上のボールの落下先を計算できる
        balls.sort((a, b) => b.y - a.y);

        balls.forEach(ball => {
            if (ball.y < 0) return; // 画面外はスキップ

            // このボールの最終着地点を探す（既に配置済みのボールも考慮）
            let finalY = ball.y;
            while (
                finalY + 1 < this.rows &&
                this.grid[finalY + 1][ball.x] === 0
            ) {
                finalY++;
            }

            if (ball.x >= 0 && ball.x < this.cols) {
                this.grid[finalY][ball.x] = ball.color;
            }
        });
    }

    // 4個以上連結しているボールのグループをすべて取得（BFS）
    findMatches() {
        const visited = Array(this.rows).fill(null).map(() => Array(this.cols).fill(false));
        let matches = [];

        for (let y = 0; y < this.rows; y++) {
            for (let x = 0; x < this.cols; x++) {
                if (this.grid[y][x] !== 0 && !visited[y][x]) {
                    const color = this.grid[y][x];
                    const group = this._floodFill(x, y, color, visited);
                    if (group.length >= 4) {
                        matches = matches.concat(group);
                    }
                }
            }
        }
        return matches;
    }

    // BFSで同色の連結グループを探索
    _floodFill(x, y, color, visited) {
        const queue = [{ x, y }];
        const group = [];
        visited[y][x] = true;

        while (queue.length > 0) {
            const { x: cx, y: cy } = queue.shift();
            group.push({ x: cx, y: cy });

            const dirs = [[0, 1], [0, -1], [1, 0], [-1, 0]];
            for (const [dx, dy] of dirs) {
                const nx = cx + dx;
                const ny = cy + dy;

                if (nx >= 0 && nx < this.cols && ny >= 0 && ny < this.rows) {
                    if (!visited[ny][nx] && this.grid[ny][nx] === color) {
                        visited[ny][nx] = true;
                        queue.push({ x: nx, y: ny });
                    }
                }
            }
        }
        return group;
    }

    // マッチしたボールをグリッドから削除する
    removeMatches(matches) {
        matches.forEach(pos => {
            this.grid[pos.y][pos.x] = 0;
        });
        return matches.length; // 消去したボール数を返す
    }

    // 重力を適用（ボールを下に落とす）
    applyGravity() {
        let moved = false;
        for (let x = 0; x < this.cols; x++) {
            for (let y = this.rows - 1; y >= 0; y--) {
                if (this.grid[y][x] === 0) {
                    for (let k = y - 1; k >= 0; k--) {
                        if (this.grid[k][x] !== 0) {
                            this.grid[y][x] = this.grid[k][x];
                            this.grid[k][x] = 0;
                            moved = true;
                            break;
                        }
                    }
                }
            }
        }
        return moved;
    }
}

// ===== Rendererクラス =====
// DOM更新を担当するレンダリングモジュール
class Renderer {
    constructor(board) {
        this.board = board;
        this.boardElement = document.getElementById('game-board');
        this._initGrid();
    }

    // DOMグリッドを初期化
    _initGrid() {
        this.boardElement.innerHTML = '';
        this.cells = [];
        for (let y = 0; y < this.board.rows; y++) {
            for (let x = 0; x < this.board.cols; x++) {
                const cell = document.createElement('div');
                cell.className = 'cell';
                this.boardElement.appendChild(cell);
                this.cells.push(cell);
            }
        }
    }

    // ボードと現在のアクティブピースを描画
    drawBoard(activePiece) {
        const activeCells = new Map();
        if (activePiece) {
            const positions = activePiece.getPositions();
            positions.forEach((pos, index) => {
                if (pos.y >= 0 && pos.y < this.board.rows) {
                    activeCells.set(pos.y * this.board.cols + pos.x, activePiece.colors[index]);
                }
            });
        }

        for (let y = 0; y < this.board.rows; y++) {
            for (let x = 0; x < this.board.cols; x++) {
                const cellIndex = y * this.board.cols + x;
                const cell = this.cells[cellIndex];
                const boardColor = this.board.grid[y][x];
                const activeColor = activeCells.get(cellIndex);
                const color = activeColor !== undefined ? activeColor : boardColor;

                const currentType = cell.dataset.colorType || '0';
                const newType = String(color);
                if (currentType === newType) continue;

                cell.dataset.colorType = newType;
                cell.innerHTML = '';

                if (color !== 0) {
                    const ball = document.createElement('div');
                    ball.className = `ball type-${color}`;
                    cell.appendChild(ball);
                }
            }
        }
    }

    // 消去アニメーション（ポップして消える）
    animateMatchRemoval(matches) {
        return new Promise(resolve => {
            matches.forEach(pos => {
                const cellIndex = pos.y * this.board.cols + pos.x;
                const cell = this.cells[cellIndex];
                if (cell && cell.firstChild) {
                    cell.firstChild.classList.add('pop');
                }
            });
            setTimeout(resolve, 350);
        });
    }

    // スタート/ゲームオーバーオーバーレイの表示切替
    toggleOverlay(show, message = 'NEON DROP', subMessage = 'SPACE でスタート') {
        const overlay = document.getElementById('overlay');
        const title = document.getElementById('overlay-title');
        const sub = document.getElementById('overlay-sub');
        if (show) {
            overlay.classList.add('active');
            title.innerText = message;
            if (sub) sub.innerText = subMessage;
        } else {
            overlay.classList.remove('active');
        }
    }

    // 一時停止オーバーレイの表示切替
    togglePauseOverlay(show) {
        const overlay = document.getElementById('pause-overlay');
        if (show) {
            overlay.classList.add('active');
        } else {
            overlay.classList.remove('active');
        }
    }

    // ネクストピースのプレビューを描画（2セット分）
    drawNextPieces(pieces) {
        for (let i = 0; i < 2; i++) {
            const container = document.getElementById(`next-${i + 1}`);
            if (!container) continue;
            container.innerHTML = '';

            if (pieces[i]) {
                const ball1 = document.createElement('div');
                ball1.className = `ball type-${pieces[i].topColor}`;

                const ball2 = document.createElement('div');
                ball2.className = `ball type-${pieces[i].bottomColor}`;

                container.appendChild(ball1);
                container.appendChild(ball2);
            }
        }
    }

    // スコアとレベルの表示を更新
    updateStats(score, level) {
        document.getElementById('score-display').innerText = score;
        document.getElementById('level-display').innerText = level;
    }
}

// ===== Gameクラス =====
// ゲーム全体を管理するメインクラス
class Game {
    constructor() {
        this.board = new Board(COLS, ROWS);
        this.renderer = new Renderer(this.board);
        this.isRunning = false;
        this.isPaused = false;      // 一時停止フラグ
        this.isProcessing = false;  // 消去・落下処理中のフラグ
        this.lastTime = 0;
        this.dropCounter = 0;
        this.dropInterval = 1000;   // 1秒ごとに落下

        this.pieces = [];           // ピースキュー
        this.currentPiece = null;

        this.score = 0;
        this.level = 1;
        this.chainCount = 0;        // 連鎖数

        this._initInput();
        this._initTouchControls();
        this._refillPieces();
        this.renderer.drawNextPieces(this.pieces);
        this.renderer.updateStats(this.score, this.level);
    }

    // ゲームを開始（またはリスタート）
    start() {
        this._reset();
        this.isRunning = true;
        this.isPaused = false;
        this.renderer.toggleOverlay(false);
        this.renderer.togglePauseOverlay(false);
        this._spawnPiece();
        requestAnimationFrame((t) => this._gameLoop(t));
    }

    // 一時停止のトグル
    togglePause() {
        if (!this.isRunning) return;
        this.isPaused = !this.isPaused;
        this.renderer.togglePauseOverlay(this.isPaused);
        if (!this.isPaused) {
            // 再開時はlastTimeをリセットして時間ずれを防ぐ
            this.lastTime = 0;
            requestAnimationFrame((t) => this._gameLoop(t));
        }
    }

    // 状態をリセット
    _reset() {
        this.board.clear();
        this.score = 0;
        this.level = 1;
        this.dropInterval = 1000;
        this.dropCounter = 0;
        this.chainCount = 0;
        this.isProcessing = false;
        this.isPaused = false;
        this.currentPiece = null;
        this.pieces = [];
        this._refillPieces();
        this.renderer._initGrid();
        this.renderer.drawBoard(null);
        this.renderer.updateStats(this.score, this.level);
    }

    // ピースキューを補充（3個以上を維持）
    _refillPieces() {
        while (this.pieces.length < 3) {
            this.pieces.push({
                topColor: COLORS[Math.floor(Math.random() * COLORS.length)],
                bottomColor: COLORS[Math.floor(Math.random() * COLORS.length)],
            });
        }
    }

    // 次のピースを生成してフィールドに出す
    _spawnPiece() {
        this._refillPieces();
        const next = this.pieces.shift();
        this.currentPiece = new Piece(next.topColor, next.bottomColor);
        this.renderer.drawNextPieces(this.pieces);

        if (!this.board.isValidPosition(
            this.currentPiece.x,
            this.currentPiece.y,
            this.currentPiece.rotation
        )) {
            this._gameOver();
        } else {
            this.renderer.drawBoard(this.currentPiece);
        }
    }

    // メインゲームループ
    _gameLoop(time = 0) {
        if (!this.isRunning || this.isPaused) return;

        const deltaTime = this.lastTime === 0 ? 0 : time - this.lastTime;
        this.lastTime = time;

        if (!this.isProcessing) {
            this.dropCounter += deltaTime;
            if (this.dropCounter >= this.dropInterval) {
                this._softDrop();
            }
        }

        requestAnimationFrame((t) => this._gameLoop(t));
    }

    // ピースを1マス下に落とす（自動落下・ソフトドロップ兼用）
    _softDrop() {
        if (!this.currentPiece || this.isProcessing) return;
        this.currentPiece.y++;
        if (!this.board.isValidPosition(
            this.currentPiece.x,
            this.currentPiece.y,
            this.currentPiece.rotation
        )) {
            this.currentPiece.y--;
            this._lockPiece();
        } else {
            this.renderer.drawBoard(this.currentPiece);
        }
        this.dropCounter = 0;
    }

    // ハードドロップ（一気に最下段まで落とす）
    _hardDrop() {
        if (!this.currentPiece || this.isProcessing) return;
        while (this.board.isValidPosition(
            this.currentPiece.x,
            this.currentPiece.y + 1,
            this.currentPiece.rotation
        )) {
            this.currentPiece.y++;
        }
        this._lockPiece();
    }

    // ピースを固定してマッチ処理へ
    _lockPiece() {
        this.board.addPiece(this.currentPiece);
        this.currentPiece = null;
        this.chainCount = 0;
        this.isProcessing = true;
        this.renderer.drawBoard(null);
        this._processMatches();
    }

    // マッチ（4個以上連結）を処理する非同期チェーン
    async _processMatches() {
        const matches = this.board.findMatches();

        if (matches.length > 0) {
            this.chainCount++;

            await this.renderer.animateMatchRemoval(matches);

            const cleared = this.board.removeMatches(matches);
            this._addScore(cleared, this.chainCount);

            this.board.applyGravity();
            this.renderer.drawBoard(null);

            await this._delay(300);
            this._processMatches();
        } else {
            this.isProcessing = false;
            this._spawnPiece();
        }
    }

    // スコアを加算（連鎖ボーナスあり）
    _addScore(clearedCount, chain) {
        const baseScore = clearedCount * 10;
        const chainBonus = chain > 1 ? Math.pow(2, chain - 1) : 1;
        this.score += Math.floor(baseScore * chainBonus * this.level);

        const newLevel = Math.floor(this.score / 500) + 1;
        if (newLevel > this.level) {
            this.level = Math.min(newLevel, 10);
            this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
        }

        this.renderer.updateStats(this.score, this.level);
    }

    // 指定ミリ秒待つユーティリティ
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    // ゲームオーバー処理
    _gameOver() {
        this.isRunning = false;
        this.currentPiece = null;
        this.renderer.toggleOverlay(
            true,
            'GAME OVER',
            `Score: ${this.score}\nSPACE / タップ でリトライ`
        );
    }

    // ===== キーボード入力の初期化 =====
    _initInput() {
        document.addEventListener('keydown', (e) => {
            // スペース：スタート / ハードドロップ
            if (e.code === 'Space') {
                e.preventDefault();
                if (!this.isRunning) {
                    this.start();
                } else if (!this.isPaused && !this.isProcessing && this.currentPiece) {
                    this._hardDrop();
                }
                return;
            }

            // P / Escape：一時停止トグル
            if (e.code === 'KeyP' || e.code === 'Escape') {
                e.preventDefault();
                this.togglePause();
                return;
            }

            if (!this.isRunning || this.isPaused || this.isProcessing || !this.currentPiece) return;

            switch (e.code) {
                case 'ArrowLeft':
                    e.preventDefault();
                    this._move(-1);
                    break;
                case 'ArrowRight':
                    e.preventDefault();
                    this._move(1);
                    break;
                case 'ArrowDown':
                    e.preventDefault();
                    this._softDrop();
                    break;
                case 'ArrowUp':
                    e.preventDefault();
                    this._rotate();
                    break;
            }
        });
    }

    // ===== タッチ操作の初期化（スマホ対応） =====
    _initTouchControls() {
        // タッチデバイスの場合はbodyにクラスを付与してレイアウト調整
        if (window.matchMedia('(pointer: coarse)').matches) {
            document.body.classList.add('touch-ui');
        }

        // スタート/ゲームオーバー画面をタップしてゲーム開始
        document.getElementById('overlay').addEventListener('touchend', (e) => {
            e.preventDefault();
            if (!this.isRunning) this.start();
        }, { passive: false });

        // 一時停止画面をタップして再開
        document.getElementById('pause-overlay').addEventListener('touchend', (e) => {
            e.preventDefault();
            if (this.isPaused) this.togglePause();
        }, { passive: false });

        // 仮想ボタンへのイベント登録
        const bindBtn = (id, action) => {
            const el = document.getElementById(id);
            if (!el) return;

            let repeatTimer = null;
            const startAction = (e) => {
                e.preventDefault();
                action();
                // 長押し時のリピート（移動・ソフトドロップのみ）
                if (id === 'btn-left' || id === 'btn-right' || id === 'btn-down') {
                    repeatTimer = setInterval(action, 120);
                }
            };
            const stopAction = () => {
                if (repeatTimer) {
                    clearInterval(repeatTimer);
                    repeatTimer = null;
                }
            };

            el.addEventListener('touchstart', startAction, { passive: false });
            el.addEventListener('touchend', stopAction, { passive: false });
            el.addEventListener('touchcancel', stopAction, { passive: false });
            // マウスでも操作できるようにする（PCでのデバッグ用）
            el.addEventListener('mousedown', startAction);
            el.addEventListener('mouseup', stopAction);
            el.addEventListener('mouseleave', stopAction);
        };

        bindBtn('btn-left', () => { if (this.isRunning && !this.isPaused && !this.isProcessing && this.currentPiece) this._move(-1); });
        bindBtn('btn-right', () => { if (this.isRunning && !this.isPaused && !this.isProcessing && this.currentPiece) this._move(1); });
        bindBtn('btn-down', () => { if (this.isRunning && !this.isPaused && !this.isProcessing && this.currentPiece) this._softDrop(); });
        bindBtn('btn-rotate', () => { if (this.isRunning && !this.isPaused && !this.isProcessing && this.currentPiece) this._rotate(); });
        bindBtn('btn-drop', () => { if (this.isRunning && !this.isPaused && !this.isProcessing && this.currentPiece) this._hardDrop(); });
        bindBtn('btn-pause', () => this.togglePause());

        // ゲームボードのタップで回転（ゲーム中のみ）
        let touchStartX = 0;
        let touchStartY = 0;
        const gameBoard = document.getElementById('game-board');
        gameBoard.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].clientX;
            touchStartY = e.touches[0].clientY;
        }, { passive: true });
        gameBoard.addEventListener('touchend', (e) => {
            const dx = e.changedTouches[0].clientX - touchStartX;
            const dy = e.changedTouches[0].clientY - touchStartY;
            if (!this.isRunning || this.isPaused || this.isProcessing || !this.currentPiece) return;
            if (Math.abs(dx) < 10 && Math.abs(dy) < 10) {
                this._rotate();
            }
        }, { passive: true });
    }

    // 水平移動
    _move(dir) {
        if (!this.currentPiece) return;
        this.currentPiece.x += dir;
        if (!this.board.isValidPosition(
            this.currentPiece.x,
            this.currentPiece.y,
            this.currentPiece.rotation
        )) {
            this.currentPiece.x -= dir;
        } else {
            this.renderer.drawBoard(this.currentPiece);
        }
    }

    // 回転（壁に当たる場合は位置補正あり）
    _rotate() {
        if (!this.currentPiece) return;
        const originalRotation = this.currentPiece.rotation;
        this.currentPiece.rotateClockwise();

        if (!this.board.isValidPosition(
            this.currentPiece.x,
            this.currentPiece.y,
            this.currentPiece.rotation
        )) {
            // 左にずらして試みる（壁蹴り）
            this.currentPiece.x--;
            if (!this.board.isValidPosition(
                this.currentPiece.x,
                this.currentPiece.y,
                this.currentPiece.rotation
            )) {
                // 右にずらして試みる
                this.currentPiece.x += 2;
                if (!this.board.isValidPosition(
                    this.currentPiece.x,
                    this.currentPiece.y,
                    this.currentPiece.rotation
                )) {
                    // 回転できない場合は元に戻す
                    this.currentPiece.x--;
                    this.currentPiece.rotation = originalRotation;
                    return;
                }
            }
        }
        this.renderer.drawBoard(this.currentPiece);
    }
}

// ゲームインスタンスを生成して起動準備
const game = new Game();
