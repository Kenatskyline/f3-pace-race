/* ========================================
   F3 PACE RACE - Main Application Logic
   PWA with Real-time Pace Tracking
   ======================================== */

// ========== Configuration ==========

const CONFIG = {
  teams: {
    gazelles: {
      name: 'GAZELLES',
      minPace: 420,      // 7:00 in seconds
      maxPace: 660,      // 11:00 in seconds
      weightFactor: 0.92 // Slight bias towards faster paces
    },
    clydesdales: {
      name: 'CLYDESDALES',
      minPace: 540,      // 9:00 in seconds
      maxPace: 780,      // 13:00 in seconds
      weightFactor: 1.08 // Slight bias towards slower paces
    }
  },
  totalSegments: 16,
  storageKeys: {
    gazellesCount: 'f3-gazelles-count',
    clydesdalesCount: 'f3-clydesdales-count',
    gazellesPace: 'f3-gazelles-pace',
    clydesdalesPace: 'f3-clydesdales-pace'
  }
};

// ========== State Management ==========

const state = {
  selectedTeam: 'gazelles',
  gazellesCount: 0,
  clydesdalesCount: 0,
  gazellesPace: null,
  clydesdalesPace: null,
  motionEnabled: false,
  deviceAlpha: 0,
  deviceBeta: 0,
  deviceGamma: 0
};

// ========== DOM Elements ==========

const elements = {
  motionButton: document.getElementById('motionButton'),
  spinButton: document.getElementById('spinButton'),
  resetButton: document.getElementById('resetButton'),
  teamButtons: document.querySelectorAll('.team-button'),
  checkinButtons: document.querySelectorAll('.checkin-button'),
  teamName: document.getElementById('teamName'),
  paceDisplay: document.getElementById('paceDisplay'),
  needle: document.getElementById('needle'),
  watchTilt: document.getElementById('watchTilt'),
  gazellesCount: document.getElementById('gazellesCount'),
  clydesdalesCount: document.getElementById('clydesdalesCount'),
  gazellesProgress: document.getElementById('gazellesProgress'),
  clydesdalesProgress: document.getElementById('clydesdalesProgress'),
  gazellesMarker: document.getElementById('gazellesMarker'),
  clydesdalesMarker: document.getElementById('clydesdalesMarker'),
  gazellesPace: document.getElementById('gazellesPace'),
  clydesdalesPace: document.getElementById('clydesdalesPace')
};

// ========== Utility Functions ==========

/**
 * Convert seconds to MM:SS format
 */
function formatPace(seconds) {
  if (seconds === null || seconds === undefined) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Generate a weighted random pace for a team
 * Independent random generation with subtle weighting
 */
function generatePace(team) {
  const config = CONFIG.teams[team];
  const range = config.maxPace - config.minPace;
  
  // Use a cubic distribution for more natural clustering
  // This creates independent randomness while allowing subtle weighting
  let random = Math.random();
  
  // Apply team-specific weighting factor
  // Gazelles weighted toward faster (smaller seconds), Clydesdales toward slower
  random = Math.pow(random, config.weightFactor);
  
  // Map to pace range
  const pace = config.minPace + (random * range);
  
  return Math.round(pace);
}

/**
 * Update needle rotation based on pace
 * Needle spans from 7:00 (0°) to 13:00 (360°)
 */
function updateNeedle(pace) {
  // Full range: 7:00 (420s) to 13:00 (780s) = 360s range
  const minPace = 420;    // 7:00 min possible
  const maxPace = 780;    // 13:00 max possible
  const range = maxPace - minPace;
  
  // Constrain pace to range
  const constrainedPace = Math.max(minPace, Math.min(maxPace, pace));
  
  // Calculate rotation: 0° at 7:00, 360° at 13:00
  const rotation = ((constrainedPace - minPace) / range) * 360;
  
  elements.needle.style.transform = `rotate(${rotation}deg)`;
}

/**
 * Update UI for selected team
 */
function updateTeamDisplay() {
  const config = CONFIG.teams[state.selectedTeam];
  elements.teamName.textContent = config.name;
  
  // Update team button active state
  elements.teamButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.team === state.selectedTeam);
  });
  
  // Update pace display and needle
  const pace = state.selectedTeam === 'gazelles' ? state.gazellesPace : state.clydesdalesPace;
  elements.paceDisplay.textContent = formatPace(pace);
  
  if (pace !== null) {
    updateNeedle(pace);
  }
}

/**
 * Update progress trackers
 */
function updateTrackers() {
  const gazellesPercent = (state.gazellesCount / CONFIG.totalSegments) * 100;
  const clydesdalesPercent = (state.clydesdalesCount / CONFIG.totalSegments) * 100;
  
  elements.gazellesCount.textContent = state.gazellesCount;
  elements.clydesdalesCount.textContent = state.clydesdalesCount;
  
  elements.gazellesProgress.style.width = `${gazellesPercent}%`;
  elements.clydesdalesProgress.style.width = `${clydesdalesPercent}%`;
  
  elements.gazellesMarker.style.left = `${gazellesPercent}%`;
  elements.clydesdalesMarker.style.left = `${clydesdalesPercent}%`;
}

/**
 * Update assignments display
 */
function updateAssignments() {
  elements.gazellesPace.textContent = formatPace(state.gazellesPace);
  elements.clydesdalesPace.textContent = formatPace(state.clydesdalesPace);
}

/**
 * Load state from localStorage
 */
function loadState() {
  const savedGazellesCount = localStorage.getItem(CONFIG.storageKeys.gazellesCount);
  const savedClydesdalesCount = localStorage.getItem(CONFIG.storageKeys.clydesdalesCount);
  const savedGazellesPace = localStorage.getItem(CONFIG.storageKeys.gazellesPace);
  const savedClydesdalesPace = localStorage.getItem(CONFIG.storageKeys.clydesdalesPace);
  
  if (savedGazellesCount !== null) state.gazellesCount = parseInt(savedGazellesCount, 10);
  if (savedClydesdalesCount !== null) state.clydesdalesCount = parseInt(savedClydesdalesCount, 10);
  if (savedGazellesPace !== null) state.gazellesPace = parseInt(savedGazellesPace, 10);
  if (savedClydesdalesPace !== null) state.clydesdalesPace = parseInt(savedClydesdalesPace, 10);
}

/**
 * Save state to localStorage
 */
function saveState() {
  localStorage.setItem(CONFIG.storageKeys.gazellesCount, state.gazellesCount);
  localStorage.setItem(CONFIG.storageKeys.clydesdalesCount, state.clydesdalesCount);
  localStorage.setItem(CONFIG.storageKeys.gazellesPace, state.gazellesPace);
  localStorage.setItem(CONFIG.storageKeys.clydesdalesPace, state.clydesdalesPace);
}

/**
 * Reset all data
 */
function resetData() {
  if (confirm('Reset all progress and pace assignments?')) {
    state.gazellesCount = 0;
    state.clydesdalesCount = 0;
    state.gazellesPace = null;
    state.clydesdalesPace = null;
    
    localStorage.clear();
    
    updateTrackers();
    updateAssignments();
    
    // Reset pace display
    elements.paceDisplay.textContent = '--:--';
    updateNeedle(450); // Reset needle to middle
  }
}

/**
 * Spin pace for both teams independently
 */
function spinPace() {
  state.gazellesPace = generatePace('gazelles');
  state.clydesdalesPace = generatePace('clydesdales');
  
  saveState();
  updateTeamDisplay();
  updateAssignments();
}

/**
 * Add check-in for a team
 */
function addCheckin(team) {
  if (team === 'gazelles' && state.gazellesCount < CONFIG.totalSegments) {
    state.gazellesCount++;
  } else if (team === 'clydesdales' && state.clydesdalesCount < CONFIG.totalSegments) {
    state.clydesdalesCount++;
  }
  
  saveState();
  updateTrackers();
}

/**
 * Request permission and enable device orientation tracking
 */
async function enableMotionTracking() {
  if (typeof DeviceOrientationEvent === 'undefined') {
    alert('Device orientation not supported on this device.');
    return;
  }
  
  // iOS 13+ requires user permission
  if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
    try {
      const permission = await DeviceOrientationEvent.requestPermission();
      if (permission === 'granted') {
        state.motionEnabled = true;
        window.addEventListener('deviceorientation', handleDeviceOrientation);
        elements.motionButton.textContent = 'Disable 3D';
        elements.watchTilt.classList.add('motion-active');
      }
    } catch (error) {
      console.error('Permission denied:', error);
    }
  } else {
    // Non-iOS devices
    state.motionEnabled = true;
    window.addEventListener('deviceorientation', handleDeviceOrientation);
    elements.motionButton.textContent = 'Disable 3D';
    elements.watchTilt.classList.add('motion-active');
  }
}

/**
 * Disable motion tracking
 */
function disableMotionTracking() {
  state.motionEnabled = false;
  window.removeEventListener('deviceorientation', handleDeviceOrientation);
  elements.motionButton.textContent = 'Enable 3D';
  elements.watchTilt.classList.remove('motion-active');
  elements.watchTilt.style.transform = '';
}

/**
 * Handle device orientation events for 3D tilt
 */
function handleDeviceOrientation(event) {
  state.deviceAlpha = event.alpha || 0;  // z axis rotation
  state.deviceBeta = event.beta || 0;    // x axis rotation
  state.deviceGamma = event.gamma || 0;  // y axis rotation
  
  // Apply subtle tilt with dampening
  const tiltX = state.deviceBeta * 0.3;  // Reduced intensity
  const tiltY = state.deviceGamma * 0.3; // Reduced intensity
  
  // Clamp values for stability
  const clampedX = Math.max(-15, Math.min(15, tiltX));
  const clampedY = Math.max(-15, Math.min(15, tiltY));
  
  elements.watchTilt.style.transform = `
    rotateX(${clampedX}deg)
    rotateY(${clampedY}deg)
  `;
}

/**
 * Toggle motion tracking
 */
function toggleMotionTracking() {
  if (state.motionEnabled) {
    disableMotionTracking();
  } else {
    enableMotionTracking();
  }
}

// ========== Event Listeners ==========

document.addEventListener('DOMContentLoaded', () => {
  // Load saved state
  loadState();
  
  // Initialize UI
  updateTeamDisplay();
  updateTrackers();
  updateAssignments();
  
  // Team selection
  elements.teamButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      state.selectedTeam = btn.dataset.team;
      updateTeamDisplay();
    });
  });
  
  // Spin button
  elements.spinButton.addEventListener('click', spinPace);
  
  // Reset button
  elements.resetButton.addEventListener('click', resetData);
  
  // Check-in buttons
  elements.checkinButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      addCheckin(btn.dataset.checkin);
    });
  });
  
  // Motion tracking
  elements.motionButton.addEventListener('click', toggleMotionTracking);
  
  // Register service worker for PWA
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch(err => {
      console.error('Service Worker registration failed:', err);
    });
  }
});

// ========== Keyboard Shortcuts (Optional) ==========

document.addEventListener('keydown', (e) => {
  // S to spin
  if (e.key === 's' || e.key === 'S') {
    spinPace();
  }
  
  // R to reset
  if (e.key === 'r' || e.key === 'R') {
    resetData();
  }
});
