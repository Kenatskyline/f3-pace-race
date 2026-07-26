/* ========================================
   F3 PACE RACE - Main Application Logic
   PWA with Role-based Workout Flow
   ======================================== */

// ========== Configuration ==========

const CONFIG = {
  teams: {
    gazelles: {
      name: 'GAZELLES',
      minPace: 420,
      maxPace: 660,
      weightFactor: 0.92
    },
    clydesdales: {
      name: 'CLYDESDALES',
      minPace: 540,
      maxPace: 780,
      weightFactor: 1.08
    }
  },
  paceStep: 30,
  globalMinPace: 420,
  globalMaxPace: 780,
  totalSegments: 16,
  workoutPhases: {
    notStarted: 'not-started',
    paceSetup: 'pace-setup',
    routeConfirm: 'route-confirm',
    waitingSq: 'waiting-sq',
    inProgress: 'in-progress',
    ended: 'ended'
  },
  storageKeys: {
    gazellesCount: 'f3-gazelles-count',
    clydesdalesCount: 'f3-clydesdales-count',
    gazellesPace: 'f3-gazelles-pace',
    clydesdalesPace: 'f3-clydesdales-pace',
    paceRanges: 'f3-pace-ranges',
    workoutPhase: 'f3-workout-phase',
    roleOverride: 'f3-role-override'
  }
};

// ========== State Management ==========

const state = {
  selectedTeam: 'gazelles',
  activeRole: 'q',
  roleAssignments: {
    q: 'gazelles',
    sq: 'clydesdales'
  },
  roleOverrideEnabled: false,
  workoutPhase: CONFIG.workoutPhases.notStarted,
  setupStep: 'pace',
  sqJoined: false,
  gazellesCount: 0,
  clydesdalesCount: 0,
  gazellesPace: null,
  clydesdalesPace: null,
  paceRanges: {
    gazelles: { min: CONFIG.teams.gazelles.minPace, max: CONFIG.teams.gazelles.maxPace },
    clydesdales: { min: CONFIG.teams.clydesdales.minPace, max: CONFIG.teams.clydesdales.maxPace }
  },
  motionEnabled: false,
  deviceBeta: 0,
  deviceGamma: 0
};

// ========== DOM Elements ==========

const elements = {
  motionButton: document.getElementById('motionButton'),
  resetButton: document.getElementById('resetButton'),
  startWorkoutButton: document.getElementById('startWorkoutButton'),
  setupWorkoutButton: document.getElementById('setupWorkoutButton'),
  joinWorkoutButton: document.getElementById('joinWorkoutButton'),
  endWorkoutButton: document.getElementById('endWorkoutButton'),
  qRoleButton: document.getElementById('qRoleButton'),
  sqRoleButton: document.getElementById('sqRoleButton'),
  phaseLabel: document.getElementById('phaseLabel'),
  phaseHint: document.getElementById('phaseHint'),
  setupOverlay: document.getElementById('setupOverlay'),
  paceSetupStep: document.getElementById('paceSetupStep'),
  routeConfirmStep: document.getElementById('routeConfirmStep'),
  setupError: document.getElementById('setupError'),
  resetRangesButton: document.getElementById('resetRangesButton'),
  continueSetupButton: document.getElementById('continueSetupButton'),
  backToPaceButton: document.getElementById('backToPaceButton'),
  confirmRouteButton: document.getElementById('confirmRouteButton'),
  paceAdjustButtons: document.querySelectorAll('.pace-adjust'),
  teamButtons: document.querySelectorAll('.team-button[data-team]'),
  spinButtons: document.querySelectorAll('.spin-button'),
  checkinButtons: document.querySelectorAll('.checkin-button[data-checkin]'),
  undoButtons: document.querySelectorAll('.undo-button'),
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
  clydesdalesPace: document.getElementById('clydesdalesPace'),
  gazellesMinDisplay: document.getElementById('gazellesMinDisplay'),
  gazellesMaxDisplay: document.getElementById('gazellesMaxDisplay'),
  clydesdalesMinDisplay: document.getElementById('clydesdalesMinDisplay'),
  clydesdalesMaxDisplay: document.getElementById('clydesdalesMaxDisplay'),
  qTeamOverride: document.getElementById('qTeamOverride'),
  sqTeamOverride: document.getElementById('sqTeamOverride'),
  applyOverrideButton: document.getElementById('applyOverrideButton'),
  clearOverrideButton: document.getElementById('clearOverrideButton')
};

// ========== Utility Functions ==========

function formatPace(seconds) {
  if (seconds === null || seconds === undefined || Number.isNaN(seconds)) return '--:--';
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatPacePerMile(seconds) {
  return `${formatPace(seconds)} / mile`;
}

function clampPace(seconds) {
  const stepped = Math.round(seconds / CONFIG.paceStep) * CONFIG.paceStep;
  return Math.max(CONFIG.globalMinPace, Math.min(CONFIG.globalMaxPace, stepped));
}

function defaultPaceRanges() {
  return {
    gazelles: { min: CONFIG.teams.gazelles.minPace, max: CONFIG.teams.gazelles.maxPace },
    clydesdales: { min: CONFIG.teams.clydesdales.minPace, max: CONFIG.teams.clydesdales.maxPace }
  };
}

function isValidRanges(ranges) {
  return ['gazelles', 'clydesdales'].every((team) => {
    const min = ranges?.[team]?.min;
    const max = ranges?.[team]?.max;
    const minValid = Number.isInteger(min) && min % CONFIG.paceStep === 0 && min >= CONFIG.globalMinPace;
    const maxValid = Number.isInteger(max) && max % CONFIG.paceStep === 0 && max <= CONFIG.globalMaxPace;
    return minValid && maxValid && min <= max;
  });
}

function getTeamForRole(role) {
  return state.roleAssignments[role];
}

function isQ() {
  return state.activeRole === 'q';
}

function canPerform(action, team = null) {
  const phase = state.workoutPhase;

  if (action === 'start') return isQ() && (phase === CONFIG.workoutPhases.notStarted || phase === CONFIG.workoutPhases.ended);
  if (action === 'setup') return isQ() && (phase === CONFIG.workoutPhases.paceSetup || phase === CONFIG.workoutPhases.routeConfirm || phase === CONFIG.workoutPhases.waitingSq);
  if (action === 'end') return isQ() && phase === CONFIG.workoutPhases.inProgress;
  if (action === 'reset') return isQ();
  if (action === 'join') return state.activeRole === 'sq' && phase === CONFIG.workoutPhases.waitingSq;

  if (action === 'spin') {
    return phase === CONFIG.workoutPhases.inProgress && team === getTeamForRole(state.activeRole);
  }

  if (action === 'checkin') {
    return phase === CONFIG.workoutPhases.inProgress && team === getTeamForRole(state.activeRole);
  }

  if (action === 'undo') {
    return phase === CONFIG.workoutPhases.inProgress && isQ();
  }

  return false;
}

function showHidden(element, shouldShow) {
  element.classList.toggle('hidden', !shouldShow);
}

// ========== Core Pace Logic ==========

function generatePace(team) {
  const config = CONFIG.teams[team];
  const rangeConfig = state.paceRanges[team];
  const minPace = rangeConfig.min;
  const maxPace = rangeConfig.max;
  const range = maxPace - minPace;

  if (range <= 0) return minPace;

  let random = Math.random();
  random = Math.pow(random, config.weightFactor);

  const pace = minPace + (random * range);
  const steppedPace = Math.round(pace / CONFIG.paceStep) * CONFIG.paceStep;

  return Math.max(minPace, Math.min(maxPace, steppedPace));
}

function spinTeamPace(team) {
  if (!canPerform('spin', team)) return;

  const newPace = generatePace(team);

  if (team === 'gazelles') {
    state.gazellesPace = newPace;
  } else {
    state.clydesdalesPace = newPace;
  }

  saveState();
  updateTeamDisplay();
  updateAssignments();
}

function addCheckin(team) {
  if (!canPerform('checkin', team)) return;

  if (team === 'gazelles' && state.gazellesCount < CONFIG.totalSegments) {
    state.gazellesCount += 1;
  }

  if (team === 'clydesdales' && state.clydesdalesCount < CONFIG.totalSegments) {
    state.clydesdalesCount += 1;
  }

  saveState();
  updateTrackers();
}

function undoCheckin(team) {
  if (!canPerform('undo', team)) return;

  if (team === 'gazelles' && state.gazellesCount > 0) {
    state.gazellesCount -= 1;
  }

  if (team === 'clydesdales' && state.clydesdalesCount > 0) {
    state.clydesdalesCount -= 1;
  }

  saveState();
  updateTrackers();
}

// ========== UI Updates ==========

function updateNeedle(pace) {
  const minPace = CONFIG.globalMinPace;
  const maxPace = CONFIG.globalMaxPace;
  const range = maxPace - minPace;
  const constrainedPace = Math.max(minPace, Math.min(maxPace, pace));
  const rotation = ((constrainedPace - minPace) / range) * 360;
  elements.needle.style.transform = `rotate(${rotation}deg)`;
}

function updateTeamDisplay() {
  const config = CONFIG.teams[state.selectedTeam];
  elements.teamName.textContent = config.name;

  elements.teamButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.team === state.selectedTeam);
  });

  const pace = state.selectedTeam === 'gazelles' ? state.gazellesPace : state.clydesdalesPace;
  elements.paceDisplay.textContent = formatPace(pace);

  if (pace !== null) {
    updateNeedle(pace);
  }
}

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

function updateAssignments() {
  elements.gazellesPace.textContent = formatPace(state.gazellesPace);
  elements.clydesdalesPace.textContent = formatPace(state.clydesdalesPace);
}

function updatePaceRangeDisplays() {
  elements.gazellesMinDisplay.textContent = formatPacePerMile(state.paceRanges.gazelles.min);
  elements.gazellesMaxDisplay.textContent = formatPacePerMile(state.paceRanges.gazelles.max);
  elements.clydesdalesMinDisplay.textContent = formatPacePerMile(state.paceRanges.clydesdales.min);
  elements.clydesdalesMaxDisplay.textContent = formatPacePerMile(state.paceRanges.clydesdales.max);
}

function validatePaceRanges(showError = true) {
  const valid = isValidRanges(state.paceRanges);
  showHidden(elements.setupError, showError && !valid);
  return valid;
}

function updatePhaseUI() {
  const phaseMessages = {
    [CONFIG.workoutPhases.notStarted]: {
      label: 'Not started',
      hint: 'Q starts the workout and sets pace ranges.'
    },
    [CONFIG.workoutPhases.paceSetup]: {
      label: 'Set pace ranges',
      hint: 'Q sets team ranges in minutes per mile.'
    },
    [CONFIG.workoutPhases.routeConfirm]: {
      label: 'Confirm route',
      hint: 'Confirm the fixed 4-mile out-and-back route.'
    },
    [CONFIG.workoutPhases.waitingSq]: {
      label: 'Waiting on SQ',
      hint: 'SQ joins to open Clydesdales controls and begin workout.'
    },
    [CONFIG.workoutPhases.inProgress]: {
      label: 'In progress',
      hint: 'Q leads Gazelles at the front. SQ leads Clydesdales at the rear.'
    },
    [CONFIG.workoutPhases.ended]: {
      label: 'Ended',
      hint: 'Workout complete. Start again to run a new session.'
    }
  };

  const message = phaseMessages[state.workoutPhase];
  elements.phaseLabel.textContent = message.label;
  elements.phaseHint.textContent = message.hint;

  showHidden(elements.startWorkoutButton, state.workoutPhase === CONFIG.workoutPhases.notStarted || state.workoutPhase === CONFIG.workoutPhases.ended);
  showHidden(elements.joinWorkoutButton, state.workoutPhase === CONFIG.workoutPhases.waitingSq);
  showHidden(elements.endWorkoutButton, state.workoutPhase === CONFIG.workoutPhases.inProgress);
  showHidden(elements.setupWorkoutButton, canPerform('setup'));

  elements.qRoleButton.classList.toggle('active', state.activeRole === 'q');
  elements.sqRoleButton.classList.toggle('active', state.activeRole === 'sq');

  const sqEnabled = state.workoutPhase === CONFIG.workoutPhases.waitingSq || state.workoutPhase === CONFIG.workoutPhases.inProgress || state.workoutPhase === CONFIG.workoutPhases.ended;
  elements.sqRoleButton.disabled = !sqEnabled;

  elements.spinButtons.forEach((btn) => {
    const team = btn.dataset.spinTeam;
    btn.disabled = !canPerform('spin', team);
  });

  elements.checkinButtons.forEach((btn) => {
    const team = btn.dataset.checkin;
    btn.disabled = !canPerform('checkin', team);
  });

  elements.undoButtons.forEach((btn) => {
    const team = btn.dataset.undoTeam;
    btn.disabled = !canPerform('undo', team);
  });

  elements.startWorkoutButton.disabled = !canPerform('start');
  elements.joinWorkoutButton.disabled = !canPerform('join');
  elements.endWorkoutButton.disabled = !canPerform('end');
  elements.resetButton.disabled = !canPerform('reset');
  elements.setupWorkoutButton.disabled = !canPerform('setup');

  const shouldShowSetup = state.workoutPhase === CONFIG.workoutPhases.paceSetup || state.workoutPhase === CONFIG.workoutPhases.routeConfirm;
  showHidden(elements.setupOverlay, shouldShowSetup);
  showHidden(elements.paceSetupStep, state.workoutPhase === CONFIG.workoutPhases.paceSetup);
  showHidden(elements.routeConfirmStep, state.workoutPhase === CONFIG.workoutPhases.routeConfirm);
}

// ========== Setup Workflow ==========

function setWorkoutPhase(phase) {
  state.workoutPhase = phase;
  saveState();
  updatePhaseUI();
}

function resetRangesToDefaults() {
  state.paceRanges = defaultPaceRanges();
  savePaceRanges();
  updatePaceRangeDisplays();
  validatePaceRanges(false);
}

function adjustPaceRange(target, direction) {
  const [team, bound] = target.split('-');
  const delta = direction * CONFIG.paceStep;
  const current = state.paceRanges[team][bound];
  const adjusted = clampPace(current + delta);

  if (bound === 'min') {
    state.paceRanges[team].min = Math.min(adjusted, state.paceRanges[team].max);
  } else {
    state.paceRanges[team].max = Math.max(adjusted, state.paceRanges[team].min);
  }

  savePaceRanges();
  updatePaceRangeDisplays();
  validatePaceRanges(false);
}

function startWorkout() {
  if (!canPerform('start')) return;

  state.activeRole = 'q';
  state.selectedTeam = getTeamForRole('q');
  state.sqJoined = false;
  state.gazellesCount = 0;
  state.clydesdalesCount = 0;
  state.gazellesPace = null;
  state.clydesdalesPace = null;

  saveState();
  updateTrackers();
  updateAssignments();
  updateTeamDisplay();
  setWorkoutPhase(CONFIG.workoutPhases.paceSetup);
}

function continueSetup() {
  if (!isQ()) return;
  if (!validatePaceRanges(true)) return;
  savePaceRanges();
  setWorkoutPhase(CONFIG.workoutPhases.routeConfirm);
}

function confirmRoute() {
  if (!isQ()) return;
  setWorkoutPhase(CONFIG.workoutPhases.waitingSq);
}

function joinWorkout() {
  if (!canPerform('join')) return;
  state.sqJoined = true;
  state.selectedTeam = getTeamForRole('sq');
  saveState();
  updateTeamDisplay();
  setWorkoutPhase(CONFIG.workoutPhases.inProgress);
}

function endWorkout() {
  if (!canPerform('end')) return;
  setWorkoutPhase(CONFIG.workoutPhases.ended);
}

function resetWorkout() {
  if (!canPerform('reset')) return;
  if (!window.confirm('Reset workout progress and assignments?')) return;

  state.workoutPhase = CONFIG.workoutPhases.notStarted;
  state.activeRole = 'q';
  state.selectedTeam = getTeamForRole('q');
  state.sqJoined = false;
  state.gazellesCount = 0;
  state.clydesdalesCount = 0;
  state.gazellesPace = null;
  state.clydesdalesPace = null;

  saveState();
  updateTrackers();
  updateAssignments();
  updateTeamDisplay();
  updateNeedle(450);
  updatePhaseUI();
}

// ========== Role Overrides (Advanced / Testing) ==========

function applyRoleOverride() {
  const qTeam = elements.qTeamOverride.value;
  const sqTeam = elements.sqTeamOverride.value;

  if (qTeam === sqTeam) {
    window.alert('Q and SQ must map to different teams.');
    return;
  }

  state.roleAssignments = { q: qTeam, sq: sqTeam };
  state.roleOverrideEnabled = true;

  if (state.activeRole === 'q') {
    state.selectedTeam = getTeamForRole('q');
  }

  saveRoleOverride();
  updateTeamDisplay();
  updatePhaseUI();
}

function clearRoleOverride() {
  state.roleAssignments = { q: 'gazelles', sq: 'clydesdales' };
  state.roleOverrideEnabled = false;
  elements.qTeamOverride.value = 'gazelles';
  elements.sqTeamOverride.value = 'clydesdales';

  if (state.activeRole === 'q') {
    state.selectedTeam = 'gazelles';
  }

  localStorage.removeItem(CONFIG.storageKeys.roleOverride);
  updateTeamDisplay();
  updatePhaseUI();
}

function setActiveRole(role) {
  if (role === 'sq' && elements.sqRoleButton.disabled) return;
  state.activeRole = role;
  state.selectedTeam = getTeamForRole(role);
  saveState();
  updateTeamDisplay();
  updatePhaseUI();
}

// ========== Persistence ==========

function saveState() {
  localStorage.setItem(CONFIG.storageKeys.gazellesCount, state.gazellesCount);
  localStorage.setItem(CONFIG.storageKeys.clydesdalesCount, state.clydesdalesCount);
  localStorage.setItem(CONFIG.storageKeys.gazellesPace, state.gazellesPace);
  localStorage.setItem(CONFIG.storageKeys.clydesdalesPace, state.clydesdalesPace);
  localStorage.setItem(CONFIG.storageKeys.workoutPhase, state.workoutPhase);
}

function loadState() {
  const savedGazellesCount = localStorage.getItem(CONFIG.storageKeys.gazellesCount);
  const savedClydesdalesCount = localStorage.getItem(CONFIG.storageKeys.clydesdalesCount);
  const savedGazellesPace = localStorage.getItem(CONFIG.storageKeys.gazellesPace);
  const savedClydesdalesPace = localStorage.getItem(CONFIG.storageKeys.clydesdalesPace);
  const savedPhase = localStorage.getItem(CONFIG.storageKeys.workoutPhase);

  if (savedGazellesCount !== null) state.gazellesCount = parseInt(savedGazellesCount, 10) || 0;
  if (savedClydesdalesCount !== null) state.clydesdalesCount = parseInt(savedClydesdalesCount, 10) || 0;
  if (savedGazellesPace !== null && savedGazellesPace !== 'null') state.gazellesPace = parseInt(savedGazellesPace, 10);
  if (savedClydesdalesPace !== null && savedClydesdalesPace !== 'null') state.clydesdalesPace = parseInt(savedClydesdalesPace, 10);

  const validPhase = Object.values(CONFIG.workoutPhases).includes(savedPhase) ? savedPhase : CONFIG.workoutPhases.notStarted;
  state.workoutPhase = validPhase;
}

function savePaceRanges() {
  localStorage.setItem(CONFIG.storageKeys.paceRanges, JSON.stringify(state.paceRanges));
}

function loadPaceRanges() {
  const raw = localStorage.getItem(CONFIG.storageKeys.paceRanges);
  if (!raw) {
    state.paceRanges = defaultPaceRanges();
    return;
  }

  try {
    const parsed = JSON.parse(raw);
    state.paceRanges = isValidRanges(parsed) ? parsed : defaultPaceRanges();
  } catch (error) {
    console.warn('Invalid stored pace ranges. Using defaults.', error);
    state.paceRanges = defaultPaceRanges();
  }
}

function saveRoleOverride() {
  const payload = {
    enabled: state.roleOverrideEnabled,
    assignments: state.roleAssignments
  };

  localStorage.setItem(CONFIG.storageKeys.roleOverride, JSON.stringify(payload));
}

function loadRoleOverride() {
  const raw = localStorage.getItem(CONFIG.storageKeys.roleOverride);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    const qTeam = parsed?.assignments?.q;
    const sqTeam = parsed?.assignments?.sq;

    if (!parsed?.enabled || !qTeam || !sqTeam || qTeam === sqTeam) return;

    state.roleOverrideEnabled = true;
    state.roleAssignments = { q: qTeam, sq: sqTeam };
    elements.qTeamOverride.value = qTeam;
    elements.sqTeamOverride.value = sqTeam;
  } catch (error) {
    console.warn('Invalid role override config. Using defaults.', error);
  }
}

// ========== Motion Tracking ==========

async function enableMotionTracking() {
  if (typeof DeviceOrientationEvent === 'undefined') {
    alert('Device orientation not supported on this device.');
    return;
  }

  if (typeof DeviceOrientationEvent.requestPermission === 'function') {
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
    state.motionEnabled = true;
    window.addEventListener('deviceorientation', handleDeviceOrientation);
    elements.motionButton.textContent = 'Disable 3D';
    elements.watchTilt.classList.add('motion-active');
  }
}

function disableMotionTracking() {
  state.motionEnabled = false;
  window.removeEventListener('deviceorientation', handleDeviceOrientation);
  elements.motionButton.textContent = 'Enable 3D';
  elements.watchTilt.classList.remove('motion-active');
  elements.watchTilt.style.transform = '';
}

function handleDeviceOrientation(event) {
  state.deviceBeta = event.beta || 0;
  state.deviceGamma = event.gamma || 0;

  const tiltX = state.deviceBeta * 0.3;
  const tiltY = state.deviceGamma * 0.3;

  const clampedX = Math.max(-15, Math.min(15, tiltX));
  const clampedY = Math.max(-15, Math.min(15, tiltY));

  elements.watchTilt.style.transform = `rotateX(${clampedX}deg) rotateY(${clampedY}deg)`;
}

function toggleMotionTracking() {
  if (state.motionEnabled) {
    disableMotionTracking();
  } else {
    enableMotionTracking();
  }
}

// ========== Event Listeners ==========

document.addEventListener('DOMContentLoaded', () => {
  loadState();
  loadPaceRanges();
  loadRoleOverride();

  if (state.workoutPhase === CONFIG.workoutPhases.inProgress || state.workoutPhase === CONFIG.workoutPhases.ended) {
    state.sqJoined = true;
  }

  state.selectedTeam = getTeamForRole(state.activeRole);

  updatePaceRangeDisplays();
  updateTeamDisplay();
  updateTrackers();
  updateAssignments();
  updatePhaseUI();

  elements.teamButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      state.selectedTeam = btn.dataset.team;
      updateTeamDisplay();
    });
  });

  elements.spinButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      spinTeamPace(btn.dataset.spinTeam);
    });
  });

  elements.checkinButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      addCheckin(btn.dataset.checkin);
    });
  });

  elements.undoButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      undoCheckin(btn.dataset.undoTeam);
    });
  });

  elements.paceAdjustButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      adjustPaceRange(btn.dataset.target, Number(btn.dataset.direction));
    });
  });

  elements.motionButton.addEventListener('click', toggleMotionTracking);
  elements.resetButton.addEventListener('click', resetWorkout);
  elements.startWorkoutButton.addEventListener('click', startWorkout);
  elements.setupWorkoutButton.addEventListener('click', () => setWorkoutPhase(CONFIG.workoutPhases.paceSetup));
  elements.joinWorkoutButton.addEventListener('click', joinWorkout);
  elements.endWorkoutButton.addEventListener('click', endWorkout);
  elements.resetRangesButton.addEventListener('click', resetRangesToDefaults);
  elements.continueSetupButton.addEventListener('click', continueSetup);
  elements.backToPaceButton.addEventListener('click', () => setWorkoutPhase(CONFIG.workoutPhases.paceSetup));
  elements.confirmRouteButton.addEventListener('click', confirmRoute);
  elements.qRoleButton.addEventListener('click', () => setActiveRole('q'));
  elements.sqRoleButton.addEventListener('click', () => setActiveRole('sq'));
  elements.applyOverrideButton.addEventListener('click', applyRoleOverride);
  elements.clearOverrideButton.addEventListener('click', clearRoleOverride);

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./service-worker.js').catch((err) => {
      console.error('Service Worker registration failed:', err);
    });
  }
});

// ========== Keyboard Shortcuts ==========

document.addEventListener('keydown', (event) => {
  if ((event.key === 's' || event.key === 'S') && state.workoutPhase === CONFIG.workoutPhases.inProgress) {
    spinTeamPace(getTeamForRole(state.activeRole));
  }

  if (event.key === 'r' || event.key === 'R') {
    resetWorkout();
  }
});
