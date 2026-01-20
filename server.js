const express = require('express');
const app = express();
const http = require('http').createServer(app);
const io = require('socket.io')(http);
const path = require('path');
const fs = require('fs');

// Serve public files
app.use(express.static(path.join(__dirname, 'public')));

// API endpoint to get list of videos from assets folder
app.get('/api/videos', (req, res) => {
    const assetsPath = path.join(__dirname, 'public', 'assets');
    
    fs.readdir(assetsPath, (err, files) => {
        if (err) {
            return res.status(500).json({ error: 'Unable to read assets folder' });
        }
        
        // Filter only video files (mp4, webm, mov, etc.)
        const videoFiles = files.filter(file => {
            const ext = path.extname(file).toLowerCase();
            return ['.mp4', '.webm', '.mov', '.avi', '.mkv'].includes(ext);
        });
        
        // Return as array of objects with filename and path
        const videos = videoFiles.map(file => ({
            name: file,
            path: `assets/${file}`
        }));
        
        res.json(videos);
    });
});

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
    socket.on('start_call', (data) => {
        const roomId = typeof data === 'string' ? data : data.roomId;
        const videoSrc = typeof data === 'object' ? data.videoSrc : 'assets/fake-video.mp4';
        
        console.log(`Admin triggered call in room: ${roomId} with video: ${videoSrc}`);
        socket.to(roomId).emit('incoming_call', { videoSrc });
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
