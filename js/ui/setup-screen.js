import { clamp } from '../utils/calculations.js';

const DEFAULT_COLORS = ['#00d4ff', '#ff7a7a', '#8f7aff', '#7affba'];
const DEFAULT_TEAM_NAMES = ['Gazelles', 'Clydesdales'];
const DEFAULT_PACE_BOUNDS = [
  { min: 420, max: 660 },
  { min: 540, max: 780 }
];
const GAZELLE_PHASES = [
  { key: 'recovery', label: 'Recovery', min: 560, max: 660 },
  { key: 'comfortable', label: 'Comfortable', min: 500, max: 600 },
  { key: 'steady', label: 'Steady', min: 460, max: 540 },
  { key: 'push', label: 'Push', min: 420, max: 500 },
  { key: 'hardPush', label: 'Hard Push', min: 390, max: 470 }
];

function getDefaultTeamName(index) {
  return DEFAULT_TEAM_NAMES[index] ?? `Team ${index + 1}`;
}

function getDefaultPaceBounds(index) {
  return DEFAULT_PACE_BOUNDS[index] ?? { min: 420, max: 780 };
}

export class SetupScreen {
  constructor(container, onStart) {
    this.container = container;
    this.onStart = onStart;
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
          <label for="raceDurationMin">Race duration (minutes)
            <input id="raceDurationMin" required name="raceDurationMin" type="number" min="5" max="180" step="1" value="40" />
          </label>
          <label for="gazelleIntervalMiles">Gazelle interval distance (miles)
            <input id="gazelleIntervalMiles" required name="gazelleIntervalMiles" type="number" min="0.05" step="0.05" value="0.25" />
          </label>
          <label for="gazelleRandomnessLevel">Gazelle randomness
            <select id="gazelleRandomnessLevel" name="gazelleRandomnessLevel">
              <option value="mild">Mild</option>
              <option value="moderate" selected>Moderate</option>
              <option value="chaotic">Chaotic</option>
            </select>
          </label>
          <fieldset>
            <legend>Gazelle phase pace ranges (sec/mi)</legend>
            <div class="team-config-list">
              ${GAZELLE_PHASES.map((phase) => `
                <div class="team-controls-row">
                  <strong>${phase.label}</strong>
                  <label>Min
                    <input name="gazellePhaseMin_${phase.key}" type="number" min="300" max="1200" step="5" value="${phase.min}" aria-label="${phase.label} minimum pace seconds per mile" required />
                  </label>
                  <label>Max
                    <input name="gazellePhaseMax_${phase.key}" type="number" min="300" max="1200" step="5" value="${phase.max}" aria-label="${phase.label} maximum pace seconds per mile" required />
                  </label>
                </div>
              `).join('')}
            </div>
          </fieldset>
          <label>Number of teams
            <input required name="teamCount" type="number" min="2" max="4" value="2" />
          </label>
          <div id="teamConfigList" class="team-config-list"></div>
          <button class="primary-button" type="submit">Start Race Director Dashboard</button>
        </form>
      </section>
    `;

    const form = this.container.querySelector('#setupForm');
    const teamCountInput = form.elements.teamCount;

    const renderTeamInputs = () => {
      const list = form.querySelector('#teamConfigList');
      const count = clamp(Number(teamCountInput.value) || 2, 2, 4);
      teamCountInput.value = String(count);

      list.innerHTML = Array.from({ length: count }, (_, idx) => {
        const paceBounds = getDefaultPaceBounds(idx);
        return `
        <fieldset>
          <legend>Team ${idx + 1}</legend>
          <label>Name
            <input name="teamName${idx}" type="text" value="${getDefaultTeamName(idx)}" required />
          </label>
          <label>Color
            <input name="teamColor${idx}" type="color" value="${DEFAULT_COLORS[idx] || '#00d4ff'}" required />
          </label>
          <label>Min pace (sec/mi)
            <input name="teamMinPace${idx}" type="number" min="300" max="1200" step="5" value="${paceBounds.min}" required />
          </label>
          <label>Max pace (sec/mi)
            <input name="teamMaxPace${idx}" type="number" min="300" max="1200" step="5" value="${paceBounds.max}" required />
          </label>
          <label>Override pace (sec/mi)
            <input name="teamOverridePace${idx}" type="number" min="300" max="1200" step="5" placeholder="Optional" />
          </label>
        </fieldset>
      `;
      }).join('');
    };

    renderTeamInputs();
    teamCountInput.addEventListener('change', renderTeamInputs);

    form.addEventListener('submit', (event) => {
      event.preventDefault();

      const formData = new FormData(form);
      const teamCount = Number(formData.get('teamCount'));
      const teams = Array.from({ length: teamCount }, (_, idx) => {
        const minPaceSec = Number(formData.get(`teamMinPace${idx}`));
        const maxPaceSec = Number(formData.get(`teamMaxPace${idx}`));
        const overrideRaw = formData.get(`teamOverridePace${idx}`);
        const overridePaceSec = overrideRaw ? Number(overrideRaw) : null;

        return {
          id: `team-${idx + 1}`,
          name: String(formData.get(`teamName${idx}`)).trim() || `Team ${idx + 1}`,
          color: String(formData.get(`teamColor${idx}`)),
          minPaceSec,
          maxPaceSec,
          overridePaceSec
        };
      });

      this.onStart({
        totalDistanceMiles: Number(formData.get('totalDistanceMiles')),
        checkpointSpacingMiles: Number(formData.get('checkpointSpacingMiles')),
        raceDurationSec: Number(formData.get('raceDurationMin')) * 60,
        gazellePacing: {
          intervalMiles: Number(formData.get('gazelleIntervalMiles')),
          randomnessLevel: String(formData.get('gazelleRandomnessLevel')),
          phaseRanges: GAZELLE_PHASES.reduce((acc, phase) => {
            const min = Number(formData.get(`gazellePhaseMin_${phase.key}`));
            const max = Number(formData.get(`gazellePhaseMax_${phase.key}`));
            acc[phase.key] = {
              min: Math.min(min, max),
              max: Math.max(min, max)
            };
            return acc;
          }, {})
        },
        teams
      });
    });
  }
}
