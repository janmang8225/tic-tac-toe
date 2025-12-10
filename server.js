const express = require('express');
const http = require('http');
const { Server } = require("socket.io");
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const rooms = {};

function generateRoomId() {
    return Math.random().toString(36).substring(2, 7).toUpperCase();
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('create_room', () => {
        const roomId = generateRoomId();
        rooms[roomId] = {
            players: [socket.id],
            board: Array(9).fill(null),
            turn: 'X', // Player 1 is always X
            gameStarter: 'X',
            nextStarter: 'X'
        };
        socket.join(roomId);
        socket.emit('room_created', roomId);
        console.log(`Room created: ${roomId}`);
    });

    socket.on('join_room', (roomId) => {
        roomId = roomId.toUpperCase();
        if (rooms[roomId] && rooms[roomId].players.length < 2) {
            rooms[roomId].players.push(socket.id);
            socket.join(roomId);

            // Notify both to start
            io.to(roomId).emit('game_start', {
                roomId,
                players: rooms[roomId].players
            });
            console.log(`User joined room: ${roomId}`);
        } else {
            socket.emit('error', 'Room not found or full');
        }
    });

    socket.on('make_move', ({ roomId, index, symbol }) => {
        if (!rooms[roomId]) return;

        // Validation could go here
        rooms[roomId].board[index] = symbol;
        rooms[roomId].turn = symbol === 'X' ? 'O' : 'X';

        io.to(roomId).emit('move_made', { index, symbol, nextTurn: rooms[roomId].turn });

        const winData = checkWinner(rooms[roomId].board);
        if (winData) {
            rooms[roomId].nextStarter = winData.winner; // Winner starts next
            io.to(roomId).emit('game_over', { winner: winData.winner, line: winData.line });
        } else if (rooms[roomId].board.every(cell => cell !== null)) {
            // Draw: The one who didn't start this game starts next
            rooms[roomId].nextStarter = rooms[roomId].gameStarter === 'X' ? 'O' : 'X';
            io.to(roomId).emit('game_over', { winner: 'draw' });
        }
    });

    socket.on('restart', (roomId) => {
        if (rooms[roomId]) {
            rooms[roomId].board = Array(9).fill(null);
            rooms[roomId].turn = rooms[roomId].nextStarter;
            rooms[roomId].gameStarter = rooms[roomId].nextStarter;

            io.to(roomId).emit('restart_game', { turn: rooms[roomId].turn });
        }
    });

    socket.on('leave_room', (roomId) => {
        if (rooms[roomId]) {
            socket.to(roomId).emit('user_left'); // Notify opponent
            socket.leave(roomId);
            delete rooms[roomId]; // Destroy room
        }
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        // Clean up rooms
        for (const roomId in rooms) {
            if (rooms[roomId].players.includes(socket.id)) {
                io.to(roomId).emit('user_left');
                delete rooms[roomId]; // Close room
            }
        }
    });
});

function checkWinner(board) {
    const lines = [
        [0, 1, 2], [3, 4, 5], [6, 7, 8], // rows
        [0, 3, 6], [1, 4, 7], [2, 5, 8], // cols
        [0, 4, 8], [2, 4, 6]             // diags
    ];
    for (let line of lines) {
        const [a, b, c] = line;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return { winner: board[a], line };
        }
    }
    return null;
}

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
