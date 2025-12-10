const express = require('express');
const http = require('http');
const WebSocket = require('ws');
const path = require('path');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

function generateRoomId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8],
        [0, 3, 6], [1, 4, 7], [2, 5, 8],
        [0, 4, 8], [2, 4, 6]
    ];
    for (let line of lines) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], line };
        }
    }
    return null;
}

wss.on('connection', (ws) => {
    console.log('User connected');
    let currentRoomId = null;

    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);

            switch (data.type) {
                case 'create_room': {
                    const roomId = generateRoomId();
                    rooms[roomId] = {
                        players: [],
                        board: Array(9).fill(null),
                        turn: 'X',
                        gameStarter: 'X',
                        nextStarter: 'X'
                    };
                    handleJoin(roomId);
                    ws.send(JSON.stringify({ type: 'room_created', roomId }));
                    break;
                }

                case 'join_room': {
                    handleJoin(data.roomId.toUpperCase());
                    break;
                }

                case 'make_move': {
                    const { roomId, index, symbol } = data;
                    if (!rooms[roomId]) return;

                    // Validation
                    if (rooms[roomId].board[index] !== null) return; // Cell taken
                    if (rooms[roomId].turn !== symbol) return; // Wrong turn

                    rooms[roomId].board[index] = symbol;
                    rooms[roomId].turn = symbol === 'X' ? 'O' : 'X';

                    broadcastToRoom(roomId, {
                        type: 'move_made',
                        index,
                        symbol,
                        nextTurn: rooms[roomId].turn
                    });

                    const winData = checkWinner(rooms[roomId].board);
                    if (winData) {
                        rooms[roomId].nextStarter = winData.winner;
                        broadcastToRoom(roomId, {
                            type: 'game_over',
                            winner: winData.winner,
                            line: winData.line
                        });
                    } else if (rooms[roomId].board.every(cell => cell !== null)) {
                        rooms[roomId].nextStarter = rooms[roomId].gameStarter === 'X' ? 'O' : 'X';
                        broadcastToRoom(roomId, { type: 'game_over', winner: 'draw' });
                    }
                    break;
                }

                case 'restart': {
                    const { roomId } = data;
                    if (rooms[roomId]) {
                        rooms[roomId].board = Array(9).fill(null);
                        rooms[roomId].turn = rooms[roomId].nextStarter;
                        rooms[roomId].gameStarter = rooms[roomId].nextStarter;

                        broadcastToRoom(roomId, {
                            type: 'restart_game',
                            turn: rooms[roomId].turn
                        });
                    }
                    break;
                }

                case 'leave_room': {
                    const { roomId } = data;
                    handleLeave(roomId);
                    break;
                }
            }
        } catch (error) {
            console.error('Error processing message:', error);
        }
    });

    ws.on('close', () => {
        if (currentRoomId) {
            handleLeave(currentRoomId);
        }
    });

    function handleJoin(roomId) {
        if (rooms[roomId]) {
            if (rooms[roomId].players.length < 2) {
                rooms[roomId].players.push(ws);
                currentRoomId = roomId;

                // If joining existing room
                if (rooms[roomId].players.length === 2) {
                    // Notify everyone game starts
                    rooms[roomId].players.forEach((player, index) => {
                        if (player.readyState === WebSocket.OPEN) {
                            // First player joined is index 0 -> X ??
                            // No, first player who joined is index 0, they should be X already?
                            // Wait, logic in socket.io was: creator gets X immediately.
                            // Here logic is: push to array.
                            // If index 0 => probably creator.
                            // Let's stick to simple: if you are the one joining second, you are O.
                            // Wait, we need to tell them their symbol.
                            // Creator got symbol X on 'room_created'.
                            // Joiner needs symbol O.
                            // Or better: just tell Game Start.
                            // And in Game Start, tell them who is who?
                            // The client logic expects: if I get game_start and I don't have a symbol, I am O.
                            // If I got room_created, I am X.
                            // So we just need to send 'game_start'.
                        }
                    });

                    broadcastToRoom(roomId, { type: 'game_start', roomId });
                } else {
                    // Just joined as 1st player (creator case mostly handled in create_room reply, 
                    // but if they joined via code on empty room, same logic)
                    // We only send room_created to creator.
                    // If joiner joins empty room?
                    // We treat it same.
                }
            } else {
                ws.send(JSON.stringify({ type: 'error', message: 'Room full' }));
            }
        } else {
            ws.send(JSON.stringify({ type: 'error', message: 'Room not found' }));
        }
    }

    function handleLeave(roomId) {
        if (rooms[roomId]) {
            rooms[roomId].players = rooms[roomId].players.filter(player => player !== ws);

            // Notify other player
            rooms[roomId].players.forEach(player => {
                if (player.readyState === WebSocket.OPEN) {
                    player.send(JSON.stringify({ type: 'user_left' }));
                }
            });

            if (rooms[roomId].players.length === 0) {
                delete rooms[roomId];
            }
        }
        currentRoomId = null;
    }

    function broadcastToRoom(roomId, messageObj) {
        if (rooms[roomId]) {
            const msgString = JSON.stringify(messageObj);
            rooms[roomId].players.forEach(player => {
                if (player.readyState === WebSocket.OPEN) {
                    player.send(msgString);
                }
            });
        }
    }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
