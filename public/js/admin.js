const socket = io();
const callBtn = document.getElementById('call-btn');
const roomInput = document.getElementById('room-input');
const remoteView = document.getElementById('remote-view');

let peerConnection;
const rtcConfig = {
    iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
};

// Join Room as Admin
const roomId = roomInput.value;
socket.emit('join_room', roomId);

// Trigger Call
callBtn.addEventListener('click', () => {
    const currentRoom = roomInput.value;
    socket.emit('start_call', currentRoom);
    alert(`Call Signal Sent to ${currentRoom}`);
});

// --- WebRTC Logic (Receive User Stream) ---
socket.on('webrtc_offer', async (sdp) => {
    peerConnection = new RTCPeerConnection(rtcConfig);

    // Show user's video in admin panel
    peerConnection.ontrack = (event) => {
        remoteView.srcObject = event.streams[0];
    };

    // Handle ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc_ice_candidate', {
                roomId: roomInput.value,
                candidate: event.candidate
            });
        }
    };

    // Set user's offer
    await peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));

    // Create and send answer
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    socket.emit('webrtc_answer', {
        roomId: roomInput.value,
        sdp: peerConnection.localDescription
    });
});

// Receive ICE candidates from user
socket.on('webrtc_ice_candidate', (candidate) => {
    if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
});

// 🔹 NEW: When User Ends Call
socket.on('call_ended', () => {
    alert("User ended the call.");

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // Clear video
    remoteView.srcObject = null;
});
