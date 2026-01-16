const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');

// Serve public files
app.use(express.static(path.join(__dirname, 'public')));

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Join room
    socket.on('join_room', async (roomId) => {
        socket.join(roomId);

        const clients = await io.in(roomId).allSockets();
        console.log(`User ${socket.id} joined room: ${roomId}`);
        console.log(`Room ${roomId} now has ${clients.size} client(s)`);
    });

    // Admin starts call → notify everyone else in room
    socket.on('start_call', (roomId) => {
        console.log(`Admin triggered call in room: ${roomId}`);
        socket.to(roomId).emit('incoming_call');
    });

    // ---------- WEBRTC SIGNALING ----------

    // Forward Offer (User → Admin)
    socket.on('webrtc_offer', (data) => {
        console.log(`Forwarding OFFER in room ${data.roomId}`);
        socket.to(data.roomId).emit('webrtc_offer', data.sdp);
    });

    // Forward Answer (Admin → User)
    socket.on('webrtc_answer', (data) => {
        console.log(`Forwarding ANSWER in room ${data.roomId}`);
        socket.to(data.roomId).emit('webrtc_answer', data.sdp);
    });

    // Forward ICE Candidates (both sides)
    socket.on('webrtc_ice_candidate', (data) => {
        socket.to(data.roomId).emit('webrtc_ice_candidate', data.candidate);
    });

    // ---------- NEW: END CALL HANDLING ----------
    socket.on('end_call', (roomId) => {
        console.log(`Call ended in room: ${roomId}`);
        socket.to(roomId).emit('call_ended');
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
