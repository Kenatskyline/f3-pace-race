import { clamp } from '../utils/calculations.js';

const DEFAULT_COLORS = ['#00d4ff', '#ff7a7a', '#8f7aff', '#7affba'];

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

      list.innerHTML = Array.from({ length: count }, (_, idx) => `
        <fieldset>
          <legend>Team ${idx + 1}</legend>
          <label>Name
            <input name="teamName${idx}" type="text" value="${idx === 0 ? 'Gazelles' : idx === 1 ? 'Clydesdales' : `Team ${idx + 1}`}" required />
          </label>
          <label>Color
            <input name="teamColor${idx}" type="color" value="${DEFAULT_COLORS[idx] || '#00d4ff'}" required />
          </label>
          <label>Min pace (sec/mi)
            <input name="teamMinPace${idx}" type="number" min="300" max="1200" step="5" value="${idx === 0 ? 420 : 540}" required />
          </label>
          <label>Max pace (sec/mi)
            <input name="teamMaxPace${idx}" type="number" min="300" max="1200" step="5" value="${idx === 0 ? 660 : 780}" required />
          </label>
          <label>Override pace (sec/mi)
            <input name="teamOverridePace${idx}" type="number" min="300" max="1200" step="5" placeholder="Optional" />
          </label>
        </fieldset>
      `).join('');
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
        teams
      });
    });
  }
}
