const socket = io();
let localStream = null;

// --- DOM Elements ---
const waitingRoom = document.getElementById('waiting-room');
const callModal = document.getElementById('call-modal');
const videoInterface = document.getElementById('video-interface');
const mainVideo = document.getElementById('main-video'); // The Prank Video
const myCamera = document.getElementById('my-camera');   // The User's Selfie

// --- Buttons ---
const acceptBtn = document.getElementById('accept-btn');
const endCallBtn = document.getElementById('end-call');
const toggleMicBtn = document.getElementById('toggle-mic');
const toggleVideoBtn = document.getElementById('toggle-video');
const declineBtns = document.querySelectorAll('.red-btn'); // Handles all decline buttons

// 1. Join the Room automatically on load
const urlParams = new URLSearchParams(window.location.search);
const roomID = urlParams.get('room') || 'room-1';
console.log("Joining room:", roomID);
socket.emit('join-room', roomID);

// 2. Listen for the Admin Trigger
socket.on('start-call', () => {
    console.log("Admin started the call!");
    waitingRoom.classList.add('hidden');
    callModal.classList.remove('hidden');
});

// 3. Accept Call Logic
acceptBtn.addEventListener('click', async () => {
    // Hide incoming screen, show video interface
    callModal.classList.add('hidden');
    videoInterface.classList.remove('hidden');

    try {
        // Request Camera & Mic permissions
        localStream = await navigator.mediaDevices.getUserMedia({ 
            video: true, 
            audio: true 
        });
        
        // Show user's face in the small box
        myCamera.srcObject = localStream;

        // Play the Prank Video
        mainVideo.play().catch(err => console.log("Video play error:", err));
        
        // Mobile Fullscreen Mode (Optional immersion)
        if (document.documentElement.requestFullscreen) {
             document.documentElement.requestFullscreen().catch(e => console.log(e));
        }

    } catch (err) {
        console.error("Camera access denied:", err);
        alert("You need to allow camera access for the video call to work!");
    }
});

// 4. End Call Button Logic
endCallBtn.addEventListener('click', () => {
    hangUpAndReload();
});

// Also handle the "Decline" button on the incoming screen
declineBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        // If they decline, just reload the page (or you could show a "Call Ended" screen)
        window.location.reload();
    });
});

// 5. Toggle Microphone Logic
toggleMicBtn.addEventListener('click', () => {
    if (localStream) {
        const audioTrack = localStream.getAudioTracks()[0];
        if (audioTrack) {
            // Toggle the enabled state
            audioTrack.enabled = !audioTrack.enabled;
            // Toggle the visual class (turns button white/black)
            toggleMicBtn.classList.toggle('off');
        }
    }
});

// 6. Toggle Camera Logic
toggleVideoBtn.addEventListener('click', () => {
    if (localStream) {
        const videoTrack = localStream.getVideoTracks()[0];
        if (videoTrack) {
            // Toggle the enabled state
            videoTrack.enabled = !videoTrack.enabled;
            // Toggle the visual class
            toggleVideoBtn.classList.toggle('off');
        }
    }
});

// Helper function to stop camera and reset
function hangUpAndReload() {
    if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
    }
    // Reloads page to go back to "Waiting Room" state
    window.location.reload();
}