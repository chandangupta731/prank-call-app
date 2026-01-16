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

            callModal.classList.add('hidden');
            videoInterface.classList.remove('hidden');

            localStream = stream;
            myVideo.srcObject = stream;
            mainVideo.play();

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

    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('webrtc_offer', {
                roomId,
                sdp: peerConnection.localDescription
            });
        });

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

// END CALL (CUT CALL)
endCallBtn.addEventListener('click', () => {

    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    mainVideo.pause();
    mainVideo.src = "";
    mainVideo.srcObject = null;
    mainVideo.load();
    mainVideo.muted = true;

    if (peerConnection) {
        peerConnection.close();
        peerConnection = null;
    }

    videoInterface.classList.add('hidden');
    waitingRoom.classList.remove('hidden');

    socket.emit('end_call', roomId);
});

// =========================
// 🎯 DRAGGABLE + EDGE-STICKY CAMERA (NEW)
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

// Release + Snap to nearest EDGE (not corner)
document.addEventListener('mouseup', stopDrag);
document.addEventListener('touchend', stopDrag);

function stopDrag() {
    if (!isDragging) return;

    isDragging = false;
    myVideo.style.cursor = "grab";

    const rect = myVideo.getBoundingClientRect();
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const distLeft = rect.left;
    const distRight = screenWidth - rect.right;
    const distTop = rect.top;
    const distBottom = screenHeight - rect.bottom;

    const minDist = Math.min(distLeft, distRight, distTop, distBottom);

    // Reset positioning
    myVideo.style.top = "";
    myVideo.style.bottom = "";
    myVideo.style.left = "";
    myVideo.style.right = "";

    // Snap to nearest EDGE
    if (minDist === distLeft) {
        myVideo.style.left = "10px";
        myVideo.style.top = `${rect.top}px`;
    } 
    else if (minDist === distRight) {
        myVideo.style.right = "10px";
        myVideo.style.top = `${rect.top}px`;
    } 
    else if (minDist === distTop) {
        myVideo.style.top = "10px";
        myVideo.style.left = `${rect.left}px`;
    } 
    else {
        myVideo.style.bottom = "10px";
        myVideo.style.left = `${rect.left}px`;
    }
}
