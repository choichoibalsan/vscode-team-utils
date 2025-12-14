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

let currentPanel = undefined;
let currentDocUri = undefined; 

function parseFenLines(document) {
    const lines = [];
    let markedIndex = -1;
    const totalLines = document.lineCount;

    for (let i = 0; i < totalLines; i++) {
        const line = document.lineAt(i);
        const text = line.text;
        if (text.trim().length === 0) continue;

        const hasMark = text.includes('★');
        const cleanFen = text.replace(/★/g, '').trim();

        if (hasMark) {
            markedIndex = lines.length;
        }

        lines.push({
            lineNumber: i,
            text: text,
            fen: cleanFen
        });
    }

    return { lines, markedIndex };
}

function activate(context) {
    let openCommand = vscode.commands.registerCommand('inspector.open', () => {
        const editor = vscode.window.activeTextEditor;
        
        if (!editor && !currentDocUri) {
             vscode.window.showErrorMessage('No active file.');
             return;
        }

        if (editor) {
            currentDocUri = editor.document.uri;
        }

        vscode.workspace.openTextDocument(currentDocUri).then(doc => {
            const { lines, markedIndex } = parseFenLines(doc);
            
            if (lines.length === 0) {
                vscode.window.showErrorMessage('No data found.');
                return;
            }

            const startIndex = (markedIndex !== -1) ? markedIndex : 0;
            const startFen = lines[startIndex].fen;

            if (currentPanel) {
                currentPanel.reveal(vscode.ViewColumn.Active);
                currentPanel.webview.postMessage({ command: 'update', fen: startFen });
            } else {
                currentPanel = vscode.window.createWebviewPanel(
                    'inspector', 
                    'Inspector', 
                    vscode.ViewColumn.Active, 
                    { enableScripts: true, retainContextWhenHidden: true }
                );

                currentPanel.onDidDispose(() => {
                    currentPanel = undefined;
                }, null, context.subscriptions);

                currentPanel.webview.html = getWebviewContent(startFen);
            }
        });
    });

    let nextCommand = vscode.commands.registerCommand('inspector.next', async () => {
        if (!currentDocUri) return;
        await moveIndex(1);
    });

    let prevCommand = vscode.commands.registerCommand('inspector.prev', async () => {
        if (!currentDocUri) return;
        await moveIndex(-1);
    });

    async function moveIndex(direction) {
        try {
            const document = await vscode.workspace.openTextDocument(currentDocUri);
            const { lines, markedIndex } = parseFenLines(document);
            if (lines.length === 0) return;

            const currentIndex = (markedIndex !== -1) ? markedIndex : 0;
            const nextIndex = (currentIndex + direction + lines.length) % lines.length;

            const currentLineObj = lines[currentIndex];
            const nextLineObj = lines[nextIndex];

            const edit = new vscode.WorkspaceEdit();

            if (markedIndex !== -1) {
                const text = currentLineObj.text;
                const starPos = text.indexOf('★');
                if (starPos !== -1) {
                    const start = new vscode.Position(currentLineObj.lineNumber, starPos);
                    const end = new vscode.Position(currentLineObj.lineNumber, starPos + 1);
                    edit.delete(currentDocUri, new vscode.Range(start, end));
                }
            }

            const lineLen = nextLineObj.text.length;
            const insertPos = new vscode.Position(nextLineObj.lineNumber, lineLen);
            edit.insert(currentDocUri, insertPos, '★');

            await vscode.workspace.applyEdit(edit);

            if (currentPanel) {
                currentPanel.webview.postMessage({ command: 'update', fen: nextLineObj.fen });
            }

        } catch (e) {
            console.error(e);
        }
    }

    let panicCommand = vscode.commands.registerCommand('inspector.panic', () => {
        if (currentPanel) {
            currentPanel.dispose();
            currentPanel = undefined;
        }
    });

    context.subscriptions.push(openCommand);
    context.subscriptions.push(nextCommand);
    context.subscriptions.push(prevCommand);
    context.subscriptions.push(panicCommand);
}

function getWebviewContent(initialFen) {
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <style>
        body { 
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
            display: flex; flex-direction: column; 
            align-items: flex-end; justify-content: center; 
            height: 100vh; margin: 0; padding-right: 20px;
            font-family: 'Consolas', 'Courier New', monospace;
            overflow: hidden; opacity: 0.6;
        }
        #board {
            display: grid; grid-template-columns: repeat(8, 1fr);
            grid-template-rows: repeat(8, 1fr);
            border: none;
            width: 90vmin; height: 90vmin;
            max-width: 600px; max-height: 600px;
        }
        .cell {
            width: 100%; height: 100%; display: flex;
            align-items: center; justify-content: center;
            font-size: calc(90vmin / 10);
            font-weight: normal; box-sizing: border-box; overflow: hidden;
        }
        @media (min-width: 600px) and (min-height: 600px) {
            .cell { font-size: 40px; }
        }
        .white-cell { background-color: rgba(255, 255, 255, 0.1); }
        .black-cell { background-color: rgba(255, 255, 255, 0.02); } 
        
        .piece { cursor: default; }
        .black-piece {
            transform: rotate(180deg); display: inline-block;
            color: inherit; font-weight: bold; opacity: 0.7;
            text-shadow: 0 0 1px currentColor;
        }
        .white-piece {
            color: inherit; font-weight: bold;
            text-shadow: none; opacity: 1.0;
        }
    </style>
</head>
<body>
    <div id="board"></div>
    <script>
        const board = document.getElementById('board');
        const map = {
            'P':'●', 'N':'⧱', 'B':'▲', 'R':'■', 'Q':'★', 'K':'◉',
            'p':'○', 'n':'⧰', 'b':'△', 'r':'▢', 'q':'☆', 'k':'◎'
        };

        function draw(fen) {
            board.innerHTML = '';
            if(!fen) return;
            
            const parts = fen.split(' ');
            const place = parts[0];
            const turn = parts[1] || 'w';

            if(turn === 'b') board.style.transform = 'rotate(180deg)';
            else board.style.transform = 'none';

            let r=0, c=0;
            for(let ch of place) {
                if(ch==='/'){ r++; c=0; }
                else if(/[0-9]/.test(ch)) {
                    let n = parseInt(ch);
                    for(let i=0; i<n; i++) { board.appendChild(cell(r,c,'')); c++; }
                } else {
                    board.appendChild(cell(r,c,ch)); c++;
                }
            }
        }

        function cell(r,c,ch) {
            const isBlack = (r+c)%2===1;
            const d = document.createElement('div');
            d.className = 'cell ' + (isBlack ? 'black-cell' : 'white-cell');
            if(ch) {
                const s = document.createElement('span');
                const isLower = (ch === ch.toLowerCase());
                s.className = 'piece ' + (isLower ? 'black-piece' : 'white-piece');
                s.textContent = map[ch] || ch;
                d.appendChild(s);
            }
            return d;
        }

        draw("${initialFen}");

        window.addEventListener('message', event => {
            const msg = event.data;
            if(msg.command === 'update') {
                draw(msg.fen);
            }
        });
    </script>
</body>
</html>`;
}
function deactivate() { }
