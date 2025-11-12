// ============================================================================
// UI CONTEST SELECTOR
// ============================================================================

import { state } from './state.js';
import { buildHashParams, parseHashParams } from './url-manager.js';
import { updatePageHeader } from './ui-election-selector.js';

// Build contest dropdown
export function buildContestDropdown(): void {
  const dropdownContent = document.getElementById('contest-dropdown-content');
  if (!dropdownContent || Object.keys(state.contests).length === 0) return;

  // Sort contests by ID
  const contests = Object.values(state.contests).sort((a, b) => a.contestId - b.contestId);

  // Clear existing content
  dropdownContent.innerHTML = '';

  // Add each contest
  contests.forEach((contest) => {
    const contestItem = document.createElement('div');
    contestItem.className = 'city-dropdown-item'; // Reuse city dropdown styles
    contestItem.setAttribute('data-contest-id', contest.contestId.toString());
    const contestName = document.createElement('span');
    contestName.className = 'city-dropdown-item-name';
    contestName.textContent = contest.contestName;
    contestItem.appendChild(contestName);
    contestItem.addEventListener('click', (e) => {
      e.stopPropagation();
      selectContest(contest.contestId);
    });
    if (state.selectedContestId === contest.contestId) {
      contestItem.style.backgroundColor = 'rgba(0, 0, 0, 0.1)';
    }
    dropdownContent.appendChild(contestItem);
  });
}

// Toggle contest dropdown
export function toggleContestDropdown(): void {
  const dropdown = document.getElementById('contest-dropdown') as HTMLElement;
  const btn = document.getElementById('contest-selector-btn');
  if (!dropdown || !btn) return;

  const isOpen = dropdown.style.display !== 'none' && dropdown.style.display !== '';
  if (isOpen) {
    dropdown.style.display = 'none';
    // Remove click handler when closing
    if (state.contestDropdownCloseHandler) {
      document.removeEventListener('click', state.contestDropdownCloseHandler);
      state.contestDropdownCloseHandler = null;
    }
  } else {
    buildContestDropdown();
    // Position dropdown relative to button - ensure it's above info pane
    const btnRect = btn.getBoundingClientRect();
    dropdown.style.position = 'fixed';
    dropdown.style.top = btnRect.bottom + 8 + 'px';
    // Ensure dropdown is not cropped on left - use max to prevent negative values
    // Also ensure it doesn't go off-screen on the right
    const screenWidth = window.innerWidth;
    const dropdownWidth = 300; // max-width from CSS
    const leftPos = Math.max(
      10,
      Math.min(btnRect.left + btnRect.width / 2, screenWidth - dropdownWidth / 2 - 10)
    );
    dropdown.style.left = leftPos + 'px';
    dropdown.style.transform = 'translateX(-50%)';
    dropdown.style.display = 'block';

    // Close dropdown when clicking outside
    state.contestDropdownCloseHandler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (
        dropdown &&
        !dropdown.contains(target) &&
        !btn.contains(target) &&
        dropdown.style.display !== 'none'
      ) {
        dropdown.style.display = 'none';
        if (state.contestDropdownCloseHandler) {
          document.removeEventListener('click', state.contestDropdownCloseHandler);
          state.contestDropdownCloseHandler = null;
        }
      }
    };
    // Use setTimeout to avoid immediate closure
    setTimeout(() => {
      document.addEventListener('click', state.contestDropdownCloseHandler!);
    }, 0);
  }
}

// Select a contest
export function selectContest(contestId: number): void {
  state.selectedContestId = contestId;
  const hashParams = parseHashParams();
  hashParams.contest = contestId;

  // Update button text
  const button = document.getElementById('contest-selector-btn');
  if (button && state.contests[contestId]) {
    button.textContent = `Contest – ${state.contests[contestId].contestName}`;
  }

  // Close dropdown
  const dropdown = document.getElementById('contest-dropdown') as HTMLElement;
  if (dropdown) {
    dropdown.style.display = 'none';
  }

  // Update URL
  const newHash = buildHashParams(hashParams);
  window.location.hash = newHash;

  // Update page header
  updatePageHeader();

  // Trigger hashchange to reload data
  // The hashchange listener in data-loading.ts will handle reloading
  window.dispatchEvent(new HashChangeEvent('hashchange'));
}

// Make functions globally accessible
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).toggleContestDropdown = toggleContestDropdown;
