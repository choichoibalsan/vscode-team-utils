"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));

function activate(context) {
    /* ★コマンドIDを inspector.open に変更 */
    let disposable = vscode.commands.registerCommand('inspector.open', () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active file.');
            return;
        }
        const text = editor.document.getText();
        const fenList = text.split(/\r?\n/).filter(line => line.trim().length > 0);
        if (fenList.length === 0) {
            vscode.window.showErrorMessage('No data found.');
            return;
        }
        /* ★パネル名を Inspector に変更 */
        const panel = vscode.window.createWebviewPanel('inspector', 'Inspector', vscode.ViewColumn.Two, { enableScripts: true });
        panel.webview.html = getWebviewContent(fenList);
    });
    context.subscriptions.push(disposable);
}

function getWebviewContent(fenList) {
    const fenJson = JSON.stringify(fenList);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { 
            /* 背景色をVS Codeに完全同期 */
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex; 
            flex-direction: column; 
            align-items: center; 
            justify-content: center; 
            height: 100vh; 
            margin: 0;
            font-family: 'Consolas', 'Courier New', monospace;
            overflow: hidden;
            opacity: 0.6; /* 全体を少し薄くしてコメントアウトっぽく */
        }
        
        #board {
            display: grid;
            grid-template-columns: repeat(8, 1fr);
            grid-template-rows: repeat(8, 1fr);
            border: none;
            width: 90vmin;
            height: 90vmin;
            max-width: 600px;
            max-height: 600px;
        }

        .cell {
            width: 100%;
            height: 100%;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: calc(90vmin / 10); 
            font-weight: normal;
            box-sizing: border-box;
            overflow: hidden;
        }

        @media (min-width: 600px) and (min-height: 600px) {
            .cell {
                font-size: 40px;
            }
        }

        /* 背景色は透明 */
        .white-cell { background-color: transparent; }
        /* 黒マスはうっすら色付け */
        .black-cell { background-color: rgba(255, 255, 255, 0.04); } 
        
        .piece { cursor: default; }

        .black-piece {
            transform: rotate(180deg);
            display: inline-block;
            color: inherit; 
            font-weight: bold;
            opacity: 0.7;
            text-shadow: 0 0 1px currentColor;
        }

        .white-piece {
            color: inherit;
            font-weight: bold;
            text-shadow: none;
            opacity: 1.0;
        }
    </style>
</head>
<body>
    <div id="board"></div>

    <script>
        const fenList = ${fenJson};
        let currentIndex = 0;
        const boardEl = document.getElementById('board');

        const pieceMap = {
            'P': '○', 'N': 'N', 'B': 'B', 'R': 'L', 'Q': 'Q', 'K': 'K',
            'p': '●', 'n': 'N', 'b': 'B', 'r': 'L', 'q': 'Q', 'k': 'K'
        };

        function createCell(row, col, content = '') {
            const cellIndex = row * 8 + col;
            const isBlackCell = (row + col) % 2 === 1;
            const cell = document.createElement('div');
            cell.className = 'cell ' + (isBlackCell ? 'black-cell' : 'white-cell');
            
            if (content) {
                const span = document.createElement('span');
                span.className = 'piece';
                
                if (content === content.toLowerCase()) {
                     span.classList.add('black-piece');
                } else {
                     span.classList.add('white-piece');
                }

                span.textContent = pieceMap[content] || content;
                cell.appendChild(span);
            }
            return cell;
        }

        function drawBoard(fen) {
            boardEl.innerHTML = '';
            const placement = fen.split(' ')[0];
            let row = 0;
            let col = 0;

            for (let char of placement) {
                if (char === '/') {
                    row++;
                    col = 0;
                } else if (/[0-9]/.test(char)) { /* ★ここを修正！数字を確実に認識させる */
                    const count = parseInt(char);
                    for (let i = 0; i < count; i++) {
                        boardEl.appendChild(createCell(row, col, ''));
                        col++;
                    }
                } else {
                    boardEl.appendChild(createCell(row, col, char));
                    col++;
                }
            }
        }

        function update() {
            if (currentIndex >= fenList.length) {
                currentIndex = 0;
            }
            const currentFen = fenList[currentIndex];
            drawBoard(currentFen);
            currentIndex++;
        }

        update();
        setInterval(update, 60000); 
    </script>
</body>
</html>`;
}
function deactivate() { }