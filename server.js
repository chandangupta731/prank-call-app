const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve files from the 'public' folder
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join a specific room (e.g., room-1)
    socket.on('join_room', (roomId) => {
        socket.join(roomId);
        console.log(`User ${socket.id} joined room: ${roomId}`);
    });

    // Admin triggers the call
    socket.on('start_call', (roomId) => {
        // Send 'incoming_call' signal ONLY to the user in that room
        socket.to(roomId).emit('incoming_call');
    });

    // WebRTC Signaling (To let Admin see User's face)
    // When User sends their video stream offer
    socket.on('webrtc_offer', (data) => {
        socket.to(data.roomId).emit('webrtc_offer', data.sdp);
    });
    // When Admin answers
    socket.on('webrtc_answer', (data) => {
        socket.to(data.roomId).emit('webrtc_answer', data.sdp);
    });
    // ICE Candidates (Network details)
    socket.on('webrtc_ice_candidate', (data) => {
        socket.to(data.roomId).emit('webrtc_ice_candidate', data.candidate);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});