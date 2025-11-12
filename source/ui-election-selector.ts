// ============================================================================
// UI ELECTION SELECTOR
// ============================================================================

import { state } from './state.js';
import { buildHashParams, parseHashParams } from './url-manager.js';

// List of available elections (can be extended)
const AVAILABLE_ELECTIONS = [
  { id: '2024-11', name: 'November 2024 General Election' },
  { id: '2025-11', name: 'November 2025 Special Election' },
];

// Update page header with current election and contest
export function updatePageHeader(): void {
  const h2 = document.querySelector('#top-header h2');
  if (!h2) return;

  const election = AVAILABLE_ELECTIONS.find((e) => e.id === state.selectedElection);
  const electionName = election
    ? election.name.replace(' Election', '').replace('General', 'Gen').replace('Special', 'Spec')
    : state.selectedElection || 'Select Election';

  if (state.selectedContestId && state.contests[state.selectedContestId]) {
    const contestName = state.contests[state.selectedContestId].contestName;
    h2.textContent = `${electionName} – ${contestName}`;
  } else {
    h2.textContent = electionName;
  }
}

// Build election dropdown
export function buildElectionDropdown(): void {
  const dropdownContent = document.getElementById('election-dropdown-content');
  if (!dropdownContent) return;

  // Clear existing content
  dropdownContent.innerHTML = '';

  // Add each election
  AVAILABLE_ELECTIONS.forEach((election) => {
    const electionItem = document.createElement('div');
    electionItem.className = 'city-dropdown-item'; // Reuse city dropdown styles
    electionItem.setAttribute('data-election-id', election.id);
    const electionName = document.createElement('span');
    electionName.className = 'city-dropdown-item-name';
    electionName.textContent = election.name;
    electionItem.appendChild(electionName);
    electionItem.addEventListener('click', (e) => {
      e.stopPropagation();
      selectElection(election.id);
    });
    if (state.selectedElection === election.id) {
      electionItem.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    }
    dropdownContent.appendChild(electionItem);
  });
}

// Toggle election dropdown
export function toggleElectionDropdown(): void {
  const dropdown = document.getElementById('election-dropdown') as HTMLElement;
  if (!dropdown) return;

  const isOpen = dropdown.style.display !== 'none';
  dropdown.style.display = isOpen ? 'none' : 'block';

  if (!isOpen) {
    buildElectionDropdown();
    // Position dropdown below button
    const button = document.getElementById('election-selector-btn');
    if (button) {
      const rect = button.getBoundingClientRect();
      dropdown.style.left = rect.left + 'px';
      dropdown.style.top = rect.bottom + 4 + 'px';
    }
  }
}

// Select an election
export function selectElection(electionId: string): void {
  state.selectedElection = electionId;
  const hashParams = parseHashParams();
  hashParams.election = electionId;
  // Reset contest when changing election
  hashParams.contest = null;

  // Update button text
  const button = document.getElementById('election-selector-btn');
  if (button) {
    const election = AVAILABLE_ELECTIONS.find((e) => e.id === electionId);
    if (election) {
      button.textContent = `Election – ${election.name}`;
    } else {
      button.textContent = `Election – ${electionId}`;
    }
  }

  // Update page header
  updatePageHeader();

  // Close dropdown
  const dropdown = document.getElementById('election-dropdown') as HTMLElement;
  if (dropdown) {
    dropdown.style.display = 'none';
  }

  // Update URL
  const newHash = buildHashParams(hashParams);
  window.location.hash = newHash;

  // Trigger hashchange to reload data
  // The hashchange listener in data-loading.ts will handle reloading
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

// Update election button text based on current selection
export function updateElectionButtonText(): void {
  const button = document.getElementById('election-selector-btn');
  if (!button) return;

  if (state.selectedElection) {
    const election = AVAILABLE_ELECTIONS.find((e) => e.id === state.selectedElection);
    if (election) {
      button.textContent = `Election – ${election.name}`;
    } else {
      button.textContent = `Election – ${state.selectedElection}`;
    }
  } else {
    button.textContent = 'Election – Select';
  }

  // Update page header
  updatePageHeader();
}

// Make functions globally accessible
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).toggleElectionDropdown = toggleElectionDropdown;
