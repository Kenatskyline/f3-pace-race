import { formatPace } from '../utils/time-utils.js';

const PACE_STEP = 30;
const GLOBAL_MIN_PACE = 300;
const GLOBAL_MAX_PACE = 1200;
const PACE_RANGES_STORAGE_KEY = 'f3-pace-ranges';

const TEAMS = [
  { id: 'gazelles', name: 'Gazelles', color: '#00d4ff', role: 'Q', defaultMin: 420, defaultMax: 660 },
  { id: 'clydesdales', name: 'Clydesdales', color: '#ff7a7a', role: 'SQ', defaultMin: 540, defaultMax: 780 }
];

function defaultPaceRanges() {
  return {
    gazelles: { min: 420, max: 660 },
    clydesdales: { min: 540, max: 780 }
  };
}

function loadPaceRanges() {
  try {
    const raw = localStorage.getItem(PACE_RANGES_STORAGE_KEY);
    if (!raw) return defaultPaceRanges();
    const parsed = JSON.parse(raw);
    const valid = TEAMS.every((team) => {
      const entry = parsed?.[team.id];
      return Number.isFinite(entry?.min) && Number.isFinite(entry?.max) && entry.min <= entry.max;
    });
    return valid ? parsed : defaultPaceRanges();
  } catch {
    return defaultPaceRanges();
  }
}

function savePaceRanges(ranges) {
  localStorage.setItem(PACE_RANGES_STORAGE_KEY, JSON.stringify(ranges));
}

function clampToStep(value) {
  const stepped = Math.round(value / PACE_STEP) * PACE_STEP;
  return Math.max(GLOBAL_MIN_PACE, Math.min(GLOBAL_MAX_PACE, stepped));
}

export class SetupScreen {
  constructor(container, onStart) {
    this.container = container;
    this.onStart = onStart;
    this.paceRanges = loadPaceRanges();
  }

  render() {
    this.container.innerHTML = `
      <section class="card">
        <div class="section-header">
          <span class="label">Race setup</span>
          <strong>Configure before start</strong>
        </div>
        <form id="setupForm" class="setup-form">
          <label>Total distance (miles)
            <input required name="totalDistanceMiles" type="number" min="1" step="0.25" value="4" />
          </label>
          <label>Checkpoint spacing (miles)
            <input required name="checkpointSpacingMiles" type="number" min="0.05" step="0.05" value="0.25" />
          </label>
          <div id="teamConfigList" class="team-config-list"></div>
          <p id="setupError" class="setup-error hidden"></p>
          <div class="setup-form-actions">
            <button class="text-button" type="button" id="resetRangesButton">Reset to defaults</button>
            <button class="primary-button" type="submit">Start Race Director Dashboard</button>
          </div>
        </form>
      </section>
    `;

    this._renderTeamPaceControls();
    this._bindEvents();
  }

  _renderTeamPaceControls() {
    const list = this.container.querySelector('#teamConfigList');
    list.innerHTML = TEAMS.map((team) => {
      const ranges = this.paceRanges[team.id];
      return `
        <fieldset class="team-pace-fieldset" data-team="${team.id}">
          <legend>
            <span class="team-dot" style="background:${team.color}"></span>
            ${team.name}
            <span class="role-badge">${team.role}</span>
          </legend>
          <div class="pace-range-row">
            <div class="pace-range-group">
              <span class="label">Fastest pace</span>
              <div class="pace-stepper">
                <button class="pace-button" type="button" data-team="${team.id}" data-bound="min" data-dir="-1">−</button>
                <span class="pace-range-value" data-team="${team.id}" data-bound="min">${formatPace(ranges.min)}/mi</span>
                <button class="pace-button" type="button" data-team="${team.id}" data-bound="min" data-dir="1">+</button>
              </div>
            </div>
            <div class="pace-range-group">
              <span class="label">Slowest pace</span>
              <div class="pace-stepper">
                <button class="pace-button" type="button" data-team="${team.id}" data-bound="max" data-dir="-1">−</button>
                <span class="pace-range-value" data-team="${team.id}" data-bound="max">${formatPace(ranges.max)}/mi</span>
                <button class="pace-button" type="button" data-team="${team.id}" data-bound="max" data-dir="1">+</button>
              </div>
            </div>
          </div>
        </fieldset>
      `;
    }).join('');
  }

  _updatePaceDisplay() {
    TEAMS.forEach((team) => {
      const ranges = this.paceRanges[team.id];
      ['min', 'max'].forEach((bound) => {
        const el = this.container.querySelector(`[data-team="${team.id}"][data-bound="${bound}"].pace-range-value`);
        if (el) el.textContent = `${formatPace(ranges[bound])}/mi`;
      });
    });
  }

  _adjustPace(teamId, bound, direction) {
    const ranges = this.paceRanges[teamId];
    const current = ranges[bound];
    const next = clampToStep(current + direction * PACE_STEP);

    if (bound === 'min') {
      ranges.min = Math.min(next, ranges.max);
    } else {
      ranges.max = Math.max(next, ranges.min);
    }

    savePaceRanges(this.paceRanges);
    this._updatePaceDisplay();
    this._clearError();
  }

  _clearError() {
    const err = this.container.querySelector('#setupError');
    if (err) { err.textContent = ''; err.classList.add('hidden'); }
  }

  _showError(msg) {
    const err = this.container.querySelector('#setupError');
    if (err) { err.textContent = msg; err.classList.remove('hidden'); }
  }

  _bindEvents() {
    this.container.querySelectorAll('.pace-button[data-bound]').forEach((btn) => {
      btn.addEventListener('click', () => {
        this._adjustPace(btn.dataset.team, btn.dataset.bound, Number(btn.dataset.dir));
      });
    });

    this.container.querySelector('#resetRangesButton').addEventListener('click', () => {
      this.paceRanges = defaultPaceRanges();
      savePaceRanges(this.paceRanges);
      this._updatePaceDisplay();
      this._clearError();
    });

    this.container.querySelector('#setupForm').addEventListener('submit', (event) => {
      event.preventDefault();

      for (const team of TEAMS) {
        const r = this.paceRanges[team.id];
        if (r.min > r.max) {
          this._showError(`${team.name}: fastest pace must be faster than or equal to slowest pace.`);
          return;
        }
      }

      const formData = new FormData(this.container.querySelector('#setupForm'));
      const teams = TEAMS.map((team) => ({
        id: team.id,
        name: team.name,
        color: team.color,
        role: team.role,
        minPaceSec: this.paceRanges[team.id].min,
        maxPaceSec: this.paceRanges[team.id].max,
        overridePaceSec: null
      }));

      savePaceRanges(this.paceRanges);

      this.onStart({
        totalDistanceMiles: Number(formData.get('totalDistanceMiles')),
        checkpointSpacingMiles: Number(formData.get('checkpointSpacingMiles')),
        teams
      });
    });
  }
}
