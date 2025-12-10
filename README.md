# Tic Tac Toe Multiplayer

A modern, real-time Tic Tac Toe game built with Node.js, Socket.io, and Vanilla HTML/CSS/JS.

## Features
- **Real-time Multiplayer**: Play against friends instantly using WebSockets.
- **Easy Room System**: Create a room and share the short 5-character code.
- **Sleek UI**: Dark mode design with neon accents and smooth animations.
- **Responsive**: Works on desktop and mobile.

## Prerequisites
- Node.js installed.

## Setup & Run

1.  Install dependencies:
    ```bash
    npm install
    ```

2.  Start the server:
    ```bash
    node server.js
    ```

3.  Open your browser at `http://localhost:3000`.

4.  **To Play**:
    - Open one tab and click **Create New Room**.
    - Copy the Room Code (e.g., `ABC12`).
    - Open a second tab (or share with a friend).
    - Enter the code and click **Join**.
    - The game starts automatically!

## Tech Stack
- **Backend**: Node.js, Express, Socket.io
- **Frontend**: HTML5, CSS3 (Variables, Flexbox/Grid), JavaScript (Socket.io Client)
