"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
const vscode = require("vscode");
function activate(context) {
    // 1. サイドバーの「箱」を作る (ID: inspector.view)
    const provider = new InspectorViewProvider(context.extensionUri);
    context.subscriptions.push(vscode.window.registerWebviewViewProvider('inspector.view', provider));
    // 2. コマンドで「データ」を流し込む (ID: inspector.open)
    let disposable = vscode.commands.registerCommand('inspector.open', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('ソースファイルを開いてから実行してください');
            return;
        }
        const text = editor.document.getText();
        const fenList = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (fenList.length === 0) {
            vscode.window.showErrorMessage('データが見つかりません');
            return;
        }
        // プロバイダー経由でデータを渡して再生開始
        provider.startInspection(fenList);
    });
    context.subscriptions.push(disposable);
}
class InspectorViewProvider {
    constructor(_extensionUri) {
        this._extensionUri = _extensionUri;
    }
    resolveWebviewView(webviewView, context, _token) {
        this._view = webviewView;
        webviewView.webview.options = {
            enableScripts: true,
        };
        // 初期状態は待機画面
        webviewView.webview.html = this._getHtmlForWebview([]);
    }
    // 外部からデータを渡されて再生を開始するメソッド
    startInspection(fenList) {
        if (this._view) {
            this._view.webview.html = this._getHtmlForWebview(fenList);
        }
    }
    _getHtmlForWebview(fenList) {
        // データがない場合は「待機中」表示
        if (fenList.length === 0) {
            return `<!DOCTYPE html>
            <html lang="en">
            <body style="background-color: transparent; color: #555; display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: sans-serif;">
                <div style="font-size: 12px; opacity: 0.5;">No active inspections</div>
            </body>
            </html>`;
        }
        const fenJson = JSON.stringify(fenList);
        // ステルスチェス盤（サイドバー用）
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { 
            background-color: transparent;
            color: var(--vscode-editor-foreground);
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            margin: 0;
            padding-top: 20px;
            font-family: 'Consolas', 'Courier New', monospace;
            overflow: hidden;
            opacity: 0.8;
        }
        
        #board {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            grid-template-rows: repeat(8, 1fr);
            border: none;
            width: 90%; 
            aspect-ratio: 1 / 1; 
            max-width: 300px;
        }

        .cell {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 14px; 
            font-weight: normal;
            box-sizing: border-box;
            overflow: hidden;
        }
        
        @media (min-width: 200px) { .cell { font-size: 18px; } }
        @media (min-width: 300px) { .cell { font-size: 24px; } }

        .white-cell { background-color: transparent; }
        .black-cell { background-color: rgba(128, 128, 128, 0.1); } 
        
        .piece { cursor: default; }
        .black-piece { transform: rotate(180deg); display: inline-block; opacity: 0.7; font-weight: bold; }
        .white-piece { opacity: 1.0; font-weight: bold; }
    </style>
</head>
<body>
    <div id="board"></div>
    <script>
        const fenList = ${fenJson};
        let currentIndex = 0;
        const boardEl = document.getElementById('board');
        const pieceMap = { 'P': '○', 'N': 'N', 'B': 'B', 'R': 'L', 'Q': 'Q', 'K': 'K', 'p': '●', 'n': 'N', 'b': 'B', 'r': 'L', 'q': 'Q', 'k': 'K' };

        function createCell(row, col, content = '') {
            const isBlackCell = (row + col) % 2 === 1;
            const cell = document.createElement('div');
            cell.className = 'cell ' + (isBlackCell ? 'black-cell' : 'white-cell');
            if (content) {
                const span = document.createElement('span');
                span.className = 'piece';
                if (content === content.toLowerCase()) span.classList.add('black-piece');
                else span.classList.add('white-piece');
                span.textContent = pieceMap[content] || content;
                cell.appendChild(span);
            }
            return cell;
        }

        function drawBoard(fen) {
            boardEl.innerHTML = '';
            const placement = fen.split(' ')[0];
            let row = 0; let col = 0;
            for (let char of placement) {
                if (char === '/') { row++; col = 0; }
                else if (/[0-9]/.test(char)) {
                    const count = parseInt(char);
                    for (let i = 0; i < count; i++) { boardEl.appendChild(createCell(row, col, '')); col++; }
                } else {
                    boardEl.appendChild(createCell(row, col, char)); col++;
                }
            }
        }

        function update() {
            if (currentIndex >= fenList.length) {
                currentIndex = 0; // ループ
            }
            const currentFen = fenList[currentIndex];
            drawBoard(currentFen);
            currentIndex++;
        }

        update();
        setInterval(update, 60000); // 1分ごとに更新
    </script>
</body>
</html>`;
    }
}
//# sourceMappingURL=extension.js.map