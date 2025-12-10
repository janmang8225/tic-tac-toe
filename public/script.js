// Replace socket.io with WebSocket
// We need to determine protocol (ws or wss) based on page protocol
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}`;
const ws = new WebSocket(wsUrl);

const lobby = document.getElementById('lobby');
const game = document.getElementById('game');
const createBtn = document.getElementById('createBtn');
const joinBtn = document.getElementById('joinBtn');
const roomInput = document.getElementById('roomInput');
const errorMsg = document.getElementById('errorMsg');
const currentRoomSpan = document.getElementById('currentRoom');
const mySymbolSpan = document.getElementById('mySymbol');
const statusText = document.getElementById('statusText');
const boardDiv = document.getElementById('board');
const resultModal = document.getElementById('resultModal');
const winnerText = document.getElementById('winnerText');
const countdownSpan = document.getElementById('countdown');
const leaveBtn = document.getElementById('leaveBtn');
const winningLine = document.getElementById('winningLine');

let mySymbol = null;
let currentTurn = 'X';
let roomId = null;
let timerInterval = null;

ws.onopen = () => {
    console.log('Connected to WebSocket');
};

ws.onmessage = (event) => {
    try {
        const data = JSON.parse(event.data);
        handleServerMessage(data);
    } catch (e) {
        console.error('Invalid JSON:', event.data);
    }
};

ws.onclose = () => {
    console.log('Disconnected');
    // Optional: show reconnection UI
};

createBtn.addEventListener('click', () => {
    if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'create_room' }));
    } else {
        showError('Connection lost. Please refresh.');
    }
});

joinBtn.addEventListener('click', () => {
    const code = roomInput.value.toUpperCase();
    if (code.length > 0) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'join_room', roomId: code }));
        }
    } else {
        showError('Please enter a room code');
    }
});

leaveBtn.addEventListener('click', () => {
    if (roomId && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'leave_room', roomId }));
    }
    location.reload();
});

boardDiv.addEventListener('click', (e) => {
    if (e.target.classList.contains('cell') && !e.target.classList.contains('taken')) {
        if (currentTurn === mySymbol) {
            const index = e.target.dataset.index;
            ws.send(JSON.stringify({
                type: 'make_move',
                roomId,
                index: parseInt(index),
                symbol: mySymbol
            }));
        }
    }
});

function handleServerMessage(data) {
    switch (data.type) {
        case 'room_created':
            roomId = data.roomId;
            mySymbol = 'X';
            showWaiting();
            break;
        case 'game_start':
            roomId = data.roomId;
            if (!mySymbol) mySymbol = 'O';
            startGame();
            break;
        case 'error':
            showError(data.message);
            break;
        case 'move_made':
            const cell = document.querySelector(`.cell[data-index="${data.index}"]`);
            cell.classList.add(data.symbol.toLowerCase(), 'taken');
            cell.textContent = data.symbol;
            currentTurn = data.nextTurn;
            updateStatus();
            break;
        case 'game_over':
            setTimeout(() => {
                if (data.line) drawWinningLine(data.line);
                setTimeout(() => {
                    showResult(data.winner);
                }, 1000);
            }, 100);
            break;
        case 'restart_game':
            resetBoard(data);
            break;
        case 'user_left':
            alert('Opponent disconnected or left the room.');
            location.reload();
            break;
    }
}

function drawWinningLine(line) {
    const combination = getLineClass(line);
    winningLine.className = `winning-line ${combination}`;
}

function getLineClass(line) {
    const str = line.join('');
    if (str === '012') return 'row-0';
    if (str === '345') return 'row-1';
    if (str === '678') return 'row-2';
    if (str === '036') return 'col-0';
    if (str === '147') return 'col-1';
    if (str === '258') return 'col-2';
    if (str === '048') return 'diag-0';
    if (str === '246') return 'diag-1';
    return '';
}

function showWaiting() {
    lobby.innerHTML = `
        <div class="card">
            <h2>Waiting for opponent...</h2>
            <p>Share this code:</p>
            <div style="font-size: 2.5rem; font-weight: 800; margin: 20px; color: var(--primary); letter-spacing: 5px; user-select: text;">${roomId}</div>
            <div class="spinner"></div> 
            <p style="font-size: 0.8rem; opacity: 0.7;">Game will start automatically when someone joins.</p>
        </div>
    `;
}

function startGame() {
    lobby.classList.add('hidden');
    game.classList.remove('hidden');
    game.style.display = 'block';
    lobby.style.display = 'none';
    currentRoomSpan.textContent = roomId;
    mySymbolSpan.textContent = mySymbol;
    currentTurn = 'X';
    updateStatus();
}

function updateStatus() {
    if (currentTurn === mySymbol) {
        statusText.textContent = "Your Turn";
        statusText.style.color = "var(--primary)";
    } else {
        statusText.textContent = "Opponent's Turn";
        statusText.style.color = "var(--text-color)";
    }
}

function resetBoard(data) {
    document.querySelectorAll('.cell').forEach(cell => {
        cell.classList.remove('x', 'o', 'taken');
        cell.textContent = '';
    });
    winningLine.className = 'winning-line';
    resultModal.classList.add('hidden');
    clearInterval(timerInterval);
    currentTurn = data.turn;
    updateStatus();
}

function showResult(winner) {
    resultModal.classList.remove('hidden');
    if (winner === 'draw') {
        winnerText.textContent = "It's a Draw!";
        winnerText.style.background = "none";
        winnerText.style.webkitTextFillColor = "var(--text-color)";
    } else if (winner === mySymbol) {
        winnerText.textContent = "You Win!";
    } else {
        winnerText.textContent = "You Lose!";
    }
    startRestartTimer();
}

function startRestartTimer() {
    let timeLeft = 5;
    countdownSpan.textContent = timeLeft;
    timerInterval = setInterval(() => {
        timeLeft--;
        countdownSpan.textContent = timeLeft;
        if (timeLeft <= 0) {
            clearInterval(timerInterval);
            if (mySymbol === 'X') {
                // Only one client needs to trigger restart
                // But wait, with WS, who is X ??
                // Logic: mySymbol is set locally. 
                // If I am X, I trigger.
                ws.send(JSON.stringify({ type: 'restart', roomId }));
            }
        }
    }, 1000);
}

function showError(msg) {
    errorMsg.textContent = msg;
    setTimeout(() => errorMsg.textContent = '', 3000);
}
