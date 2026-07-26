import { clamp } from '../utils/calculations.js';

export class CourseVisualization {
  constructor(container) {
    this.container = container;
    this.trackEl = null;
    this.teamMarkers = new Map();
  }

  render(raceState) {
    const checkpoints = raceState.race.checkpointCount;
    const checkpointSpacing = raceState.race.checkpointSpacingMiles;

    this.container.innerHTML = `
      <section class="card course-map-card">
        <div class="section-header">
          <span class="label">Course visualization</span>
          <strong>${raceState.race.totalDistanceMiles} mi total</strong>
        </div>
        <div class="course-map" id="courseMapTrack"></div>
      </section>
    `;

    this.trackEl = this.container.querySelector('#courseMapTrack');

    const turnaroundPercent = 50;
    const turnaroundMarker = document.createElement('div');
    turnaroundMarker.className = 'course-turnaround';
    turnaroundMarker.style.left = `${turnaroundPercent}%`;
    turnaroundMarker.textContent = 'Turnaround';
    this.trackEl.appendChild(turnaroundMarker);

    for (let i = 0; i <= checkpoints; i += 1) {
      const marker = document.createElement('div');
      marker.className = 'checkpoint-marker';
      marker.style.left = `${(i / checkpoints) * 100}%`;
      if (i === 0 || i === checkpoints || i % 2 === 0) {
        const label = document.createElement('span');
        label.textContent = `${(i * checkpointSpacing).toFixed(2).replace(/\.00$/, '')} mi`;
        marker.appendChild(label);
      }
      this.trackEl.appendChild(marker);
    }

    raceState.teams.forEach((team) => {
      const marker = document.createElement('div');
      marker.className = 'team-marker';
      marker.style.backgroundColor = team.color;
      marker.style.borderColor = team.color;
      marker.textContent = team.name.slice(0, 2).toUpperCase();
      this.teamMarkers.set(team.id, marker);
      this.trackEl.appendChild(marker);
    });
  }

  update(raceState) {
    raceState.teams.forEach((team) => {
      const marker = this.teamMarkers.get(team.id);
      if (!marker) return;
      const progress = clamp(team.distanceMiles / raceState.race.totalDistanceMiles, 0, 1);
      marker.style.left = `${progress * 100}%`;
      marker.setAttribute('aria-label', `${team.name} ${(progress * 100).toFixed(1)} percent complete`);
    });
  }
}
