// State
let currentReviewCards = [];
let currentReviewIndex = 0;
let availableTopics = [];
let allCards = []; // Store all cards for search
let reviewHistory = []; // Store all reviewed cards in current session for undo
let savedTitles = []; // Store all unique titles for autocomplete
let selectedAutocompleteIndex = -1; // Track selected suggestion
let fsrsSettings = {
  requestRetention: 0.9
}; // FSRS algorithm settings

// DOM Elements
const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');
const addForm = document.getElementById('add-form');
const reviewCard = document.getElementById('review-card');
const noReviews = document.getElementById('no-reviews');
const allCardsContainer = document.getElementById('all-cards-container');
const topicInput = document.getElementById('topic');
const topicColorInput = document.getElementById('topic-color');
const colorPickerGroup = document.getElementById('color-picker-group');
const topicPreview = document.getElementById('selected-topic-preview');
const previewBadge = document.getElementById('preview-badge');
const titleInput = document.getElementById('title');
const titleAutocomplete = document.getElementById('title-autocomplete');
const titleSuggestions = document.getElementById('title-suggestions');

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupSettingsToggle();
  setupThemeToggle();
  setupSettingsModal();
  setupTabs();
  setupAddForm();
  setupEditForm();
  setupReviewButtons();
  setupSkipButton();
  setupEditReviewButton();
  setupDeleteReviewButton();
  setupTopicInput();
  setupTitleAutocomplete();
  setupColorPresets();
  setupSearchInput();
  setupUndoButton();
  setupUpcomingToggle();
  loadSettings();
  loadTopics();
  loadTitles();
  loadStats();
  loadDueCards();
});

// Settings Toggle
function setupSettingsToggle() {
  const settingsToggle = document.getElementById('settings-toggle');
  settingsToggle.addEventListener('click', () => {
    openSettingsModal();
  });
}

// Theme Toggle
function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  const themeLabel = document.getElementById('theme-label');
  const html = document.documentElement;

  // Load saved theme preference or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    html.classList.add('dark-mode');
    themeLabel.textContent = 'Dark';
  } else {
    themeLabel.textContent = 'Light';
  }

  // Toggle theme on button click
  themeToggle.addEventListener('click', () => {
    html.classList.toggle('dark-mode');
    const isDark = html.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    themeLabel.textContent = isDark ? 'Dark' : 'Light';
  });
}

// Settings Modal
function setupSettingsModal() {
  const retentionSlider = document.getElementById('retention-rate');
  const retentionValue = document.getElementById('retention-value');

  // Update retention rate display
  retentionSlider.addEventListener('input', (e) => {
    retentionValue.textContent = `${e.target.value}%`;
  });

  // Close modal when clicking outside
  const modal = document.getElementById('settings-modal');
  let mouseDownTarget = null;

  modal.addEventListener('mousedown', (e) => {
    mouseDownTarget = e.target;
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal && mouseDownTarget === modal) {
      closeSettingsModal();
    }
    mouseDownTarget = null;
  });
}

// Open Settings Modal
function openSettingsModal() {
  const modal = document.getElementById('settings-modal');
  const retentionSlider = document.getElementById('retention-rate');
  const retentionValue = document.getElementById('retention-value');

  // Load current settings
  retentionSlider.value = Math.round(fsrsSettings.requestRetention * 100);
  retentionValue.textContent = `${Math.round(fsrsSettings.requestRetention * 100)}%`;

  modal.style.display = 'flex';
}

// Close Settings Modal
function closeSettingsModal() {
  document.getElementById('settings-modal').style.display = 'none';
}

// Save Settings
async function saveSettings() {
  const retentionSlider = document.getElementById('retention-rate');

  // Update local settings
  fsrsSettings.requestRetention = parseInt(retentionSlider.value) / 100;

  // Save to localStorage
  localStorage.setItem('fsrsSettings', JSON.stringify(fsrsSettings));

  // Send to server
  try {
    const response = await fetch('/api/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(fsrsSettings)
    });

    if (!response.ok) throw new Error('Failed to save settings');

    showToast('Settings saved successfully!');
    closeSettingsModal();

    // Reload due cards with new settings
    loadDueCards();
    loadStats();
  } catch (error) {
    console.error('Error saving settings:', error);
    showToast('Failed to save settings', 'error');
  }
}

// Recalculate All Cards
async function recalculateAllCards() {
  if (!confirm('This will recalculate all cards based on their review history and current settings. Continue?')) {
    return;
  }

  try {
    const response = await fetch('/api/cards/recalculate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (!response.ok) throw new Error('Failed to recalculate cards');

    const result = await response.json();
    showToast(`Successfully recalculated ${result.updated} cards!`);

    // Reload stats and cards
    loadDueCards();
    loadStats();
    loadAllCards();
  } catch (error) {
    console.error('Error recalculating cards:', error);
    showToast('Failed to recalculate cards', 'error');
  }
}

// Load Settings
async function loadSettings() {
  try {
    // Try to load from server first
    const response = await fetch('/api/settings');
    if (response.ok) {
      const serverSettings = await response.json();
      if (serverSettings.requestRetention) {
        fsrsSettings = serverSettings;
        localStorage.setItem('fsrsSettings', JSON.stringify(fsrsSettings));
        return;
      }
    }
  } catch (error) {
    console.error('Error loading settings from server:', error);
  }

  // Fall back to localStorage
  const savedSettings = localStorage.getItem('fsrsSettings');
  if (savedSettings) {
    try {
      fsrsSettings = JSON.parse(savedSettings);
    } catch (error) {
      console.error('Error loading settings from localStorage:', error);
    }
  }
}

// Tab Navigation
function setupTabs() {
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetTab = tab.dataset.tab;

      // Update active tab
      tabs.forEach(t => t.classList.remove('active'));
      tab.classList.add('active');

      // Update active content
      tabContents.forEach(content => {
        content.classList.remove('active');
      });
      document.getElementById(`${targetTab}-section`).classList.add('active');

      // Load data based on tab
      if (targetTab === 'review') {
        loadDueCards();
      } else if (targetTab === 'all') {
        loadAllCards();
      }
    });
  });
}

// Add Form
function setupAddForm() {
  addForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const topic = document.getElementById('topic').value;
    const title = document.getElementById('title').value;
    const content = document.getElementById('content').value;
    const topicColor = document.getElementById('topic-color').value;

    try {
      const response = await fetch('/api/cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, title, content, topicColor })
      });

      if (!response.ok) throw new Error('Failed to add topic');

      showToast('Topic added successfully!');
      addForm.reset();
      colorPickerGroup.style.display = 'none';
      topicPreview.style.display = 'none';
      titleAutocomplete.style.display = 'none';
      loadTopics(); // Reload topics to include new one
      loadTitles(); // Reload titles to include new one
      loadStats();
    } catch (error) {
      console.error('Error adding card:', error);
      showToast('Failed to add topic', 'error');
    }
  });
}

// Review Buttons
function setupReviewButtons() {
  const ratingButtons = document.querySelectorAll('.rating-buttons .btn');
  ratingButtons.forEach(button => {
    button.addEventListener('click', () => {
      const rating = parseInt(button.dataset.rating);
      submitReview(rating);
    });
  });
}

// Skip Button
function setupSkipButton() {
  const skipBtn = document.getElementById('skip-btn');
  if (skipBtn) {
    skipBtn.addEventListener('click', () => {
      skipCard();
    });
  }
}

// Edit Review Button
function setupEditReviewButton() {
  const editReviewBtn = document.getElementById('edit-review-btn');
  if (editReviewBtn) {
    editReviewBtn.addEventListener('click', () => {
      const card = currentReviewCards[currentReviewIndex];
      if (card) {
        editCard(card._id);
      }
    });
  }
}

// Delete Review Button
function setupDeleteReviewButton() {
  const deleteReviewBtn = document.getElementById('delete-review-btn');
  if (deleteReviewBtn) {
    deleteReviewBtn.addEventListener('click', () => {
      const card = currentReviewCards[currentReviewIndex];
      if (card) {
        deleteCard(card._id);
      }
    });
  }
}

// Setup Title Autocomplete
function setupTitleAutocomplete() {
  // Show autocomplete on focus
  titleInput.addEventListener('focus', () => {
    if (titleInput.value.trim()) {
      renderTitleSuggestions(titleInput.value.trim());
    }
  });

  // Filter suggestions on input
  titleInput.addEventListener('input', () => {
    const inputValue = titleInput.value.trim();

    if (inputValue) {
      renderTitleSuggestions(inputValue);
      titleAutocomplete.style.display = 'block';
    } else {
      titleAutocomplete.style.display = 'none';
    }
    selectedAutocompleteIndex = -1;
  });

  // Handle keyboard navigation
  titleInput.addEventListener('keydown', (e) => {
    if (titleAutocomplete.style.display === 'none') return;

    const items = titleSuggestions.querySelectorAll('.autocomplete-item');

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedAutocompleteIndex = Math.min(selectedAutocompleteIndex + 1, items.length - 1);
      updateAutocompleteSelection(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedAutocompleteIndex = Math.max(selectedAutocompleteIndex - 1, -1);
      updateAutocompleteSelection(items);
    } else if (e.key === 'Enter' && selectedAutocompleteIndex >= 0) {
      e.preventDefault();
      items[selectedAutocompleteIndex].click();
    } else if (e.key === 'Escape') {
      titleAutocomplete.style.display = 'none';
      selectedAutocompleteIndex = -1;
    }
  });

  // Close autocomplete when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.autocomplete-container')) {
      titleAutocomplete.style.display = 'none';
      selectedAutocompleteIndex = -1;
    }
  });
}

// Update autocomplete selection highlighting
function updateAutocompleteSelection(items) {
  items.forEach((item, index) => {
    if (index === selectedAutocompleteIndex) {
      item.classList.add('selected');
      item.scrollIntoView({ block: 'nearest' });
    } else {
      item.classList.remove('selected');
    }
  });
}

// Render title suggestions
function renderTitleSuggestions(filter) {
  const filterLower = filter.toLowerCase();

  // Find matching titles
  const matchingTitles = savedTitles.filter(title =>
    title.toLowerCase().includes(filterLower) && title.toLowerCase() !== filterLower
  );

  if (matchingTitles.length === 0) {
    titleAutocomplete.style.display = 'none';
    return;
  }

  // Sort by relevance (starts with > contains)
  const sortedTitles = matchingTitles.sort((a, b) => {
    const aStarts = a.toLowerCase().startsWith(filterLower);
    const bStarts = b.toLowerCase().startsWith(filterLower);

    if (aStarts && !bStarts) return -1;
    if (!aStarts && bStarts) return 1;
    return a.localeCompare(b);
  });

  // Limit to top 10 suggestions
  const topSuggestions = sortedTitles.slice(0, 10);

  titleSuggestions.innerHTML = topSuggestions.map((title, index) => `
    <div class="autocomplete-item" data-title="${escapeHtml(title)}" data-index="${index}">
      <span class="autocomplete-item-text">${escapeHtml(title)}</span>
    </div>
  `).join('');

  // Add click handlers
  titleSuggestions.querySelectorAll('.autocomplete-item').forEach(item => {
    item.addEventListener('click', () => {
      titleInput.value = item.dataset.title;
      titleAutocomplete.style.display = 'none';
      selectedAutocompleteIndex = -1;
      titleInput.focus();
    });
  });

  titleAutocomplete.style.display = 'block';
}

// Load all unique titles from cards
async function loadTitles() {
  try {
    const response = await fetch('/api/cards/all');
    const cards = await response.json();

    // Extract unique titles
    const titlesSet = new Set();
    cards.forEach(card => {
      if (card.title && card.title.trim()) {
        titlesSet.add(card.title.trim());
      }
    });

    savedTitles = Array.from(titlesSet);
  } catch (error) {
    console.error('Error loading titles:', error);
  }
}

// Setup Topic Input
function setupTopicInput() {
  const dropdown = document.getElementById('topic-dropdown');
  const dropdownOptions = document.getElementById('topic-options');

  // Show dropdown on focus
  topicInput.addEventListener('focus', () => {
    renderDropdownOptions();
    dropdown.style.display = 'block';
  });

  // Filter dropdown on input
  topicInput.addEventListener('input', () => {
    const inputValue = topicInput.value.trim();

    renderDropdownOptions(inputValue);
    dropdown.style.display = 'block';

    const existingTopic = availableTopics.find(t => t.name.toLowerCase() === inputValue.toLowerCase());

    if (existingTopic) {
      // Existing topic - hide color picker, show preview
      colorPickerGroup.style.display = 'none';
      topicPreview.style.display = 'block';
      previewBadge.textContent = existingTopic.name;
      previewBadge.style.backgroundColor = existingTopic.color;
    } else if (inputValue) {
      // New topic - show color picker, hide preview
      colorPickerGroup.style.display = 'block';
      topicPreview.style.display = 'none';
    } else {
      // Empty - hide both
      colorPickerGroup.style.display = 'none';
      topicPreview.style.display = 'none';
    }
  });

  // Show dropdown on arrow click
  const dropdownArrow = document.querySelector('.dropdown-arrow');
  dropdownArrow.addEventListener('click', () => {
    if (dropdown.style.display === 'none') {
      renderDropdownOptions();
      dropdown.style.display = 'block';
      topicInput.focus();
    } else {
      dropdown.style.display = 'none';
    }
  });

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.dropdown-container')) {
      dropdown.style.display = 'none';
    }
  });
}

// Render dropdown options
function renderDropdownOptions(filter = '') {
  const dropdownOptions = document.getElementById('topic-options');
  const filterLower = filter.toLowerCase();

  const filteredTopics = availableTopics.filter(topic =>
    topic.name.toLowerCase().includes(filterLower)
  );

  if (filteredTopics.length === 0) {
    dropdownOptions.innerHTML = '<div class="dropdown-empty">No existing categories. Type to create a new one.</div>';
  } else {
    dropdownOptions.innerHTML = filteredTopics.map(topic => `
      <div class="dropdown-item" data-topic="${escapeHtml(topic.name)}" data-color="${topic.color}">
        <span class="dropdown-badge" style="background-color: ${topic.color};">${escapeHtml(topic.name)}</span>
      </div>
    `).join('');

    // Add click handlers to dropdown items
    dropdownOptions.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const topicName = item.dataset.topic;
        const topicColor = item.dataset.color;

        topicInput.value = topicName;

        // Show preview
        colorPickerGroup.style.display = 'none';
        topicPreview.style.display = 'block';
        previewBadge.textContent = topicName;
        previewBadge.style.backgroundColor = topicColor;

        // Hide dropdown
        document.getElementById('topic-dropdown').style.display = 'none';
      });
    });
  }
}

// Setup Color Presets
function setupColorPresets() {
  const presetButtons = document.querySelectorAll('.color-preset');
  presetButtons.forEach(button => {
    button.addEventListener('click', (e) => {
      e.preventDefault();
      const color = button.dataset.color;
      topicColorInput.value = color;
    });
  });
}

// Setup Search Input
function setupSearchInput() {
  const searchInput = document.getElementById('search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      const searchTerm = e.target.value.toLowerCase().trim();
      filterCards(searchTerm);
    });
  }
}

// Filter cards based on search term
function filterCards(searchTerm) {
  if (!searchTerm) {
    renderAllCards(allCards);
    return;
  }

  const filteredCards = allCards.filter(card => {
    const topic = card.topic.toLowerCase();
    const title = card.title.toLowerCase();
    const content = (card.content || '').toLowerCase();

    return topic.includes(searchTerm) ||
           title.includes(searchTerm) ||
           content.includes(searchTerm);
  });

  renderAllCards(filteredCards);
}

// Load Topics
async function loadTopics() {
  try {
    const response = await fetch('/api/topics');
    availableTopics = await response.json();
  } catch (error) {
    console.error('Error loading topics:', error);
  }
}

// Load Statistics
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();

    document.getElementById('total-cards').textContent = stats.totalCards;
    document.getElementById('due-cards').textContent = stats.dueCards;
    document.getElementById('reviewed-today').textContent = stats.reviewedToday;
  } catch (error) {
    console.error('Error loading stats:', error);
  }
}

// Load Due Cards for Review
async function loadDueCards() {
  try {
    const response = await fetch('/api/cards/due');
    currentReviewCards = await response.json();
    currentReviewIndex = 0;
    reviewHistory = []; // Reset review history when loading new cards

    // Hide undo button when loading new cards
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
      undoBtn.style.display = 'none';
    }

    if (currentReviewCards.length === 0) {
      showNoReviews();
    } else {
      showReviewCard();
    }
  } catch (error) {
    console.error('Error loading due cards:', error);
    showToast('Failed to load review cards', 'error');
  }
}

// Show No Reviews State
function showNoReviews() {
  reviewCard.style.display = 'none';
  noReviews.style.display = 'block';
}

// Load scheduling info for a card and update buttons
async function loadSchedulingInfo(cardId) {
  try {
    const response = await fetch(`/api/cards/${cardId}/scheduling`);
    if (!response.ok) throw new Error('Failed to load scheduling info');

    const schedulingInfo = await response.json();

    // Update buttons with next review times
    const ratingButtons = document.querySelectorAll('.rating-buttons .btn');
    ratingButtons.forEach(button => {
      const rating = parseInt(button.dataset.rating);
      const nextReview = new Date(schedulingInfo[rating]);
      const timeText = formatSchedulingTime(nextReview);

      const timeSpan = button.querySelector('.rating-time');
      if (timeSpan) {
        timeSpan.textContent = timeText;
      }
    });
  } catch (error) {
    console.error('Error loading scheduling info:', error);
    // Set fallback text if loading fails
    const ratingButtons = document.querySelectorAll('.rating-buttons .btn');
    ratingButtons.forEach(button => {
      const timeSpan = button.querySelector('.rating-time');
      if (timeSpan && timeSpan.textContent === '...') {
        timeSpan.textContent = '?';
      }
    });
  }
}

// Format time for scheduling display (similar to Anki)
function formatSchedulingTime(date) {
  const now = new Date();
  const diffMs = date - now;
  const diffMins = Math.round(diffMs / (1000 * 60));
  const diffHours = Math.round(diffMs / (1000 * 60 * 60));
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
  const diffMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30));
  const diffYears = Math.round(diffMs / (1000 * 60 * 60 * 24 * 365));

  if (diffMins < 1) {
    return '<1m';
  } else if (diffMins < 60) {
    return `${diffMins}m`;
  } else if (diffHours < 24) {
    return `${diffHours}h`;
  } else if (diffDays < 30) {
    return `${diffDays}d`;
  } else if (diffMonths < 12) {
    return `${diffMonths}mo`;
  } else {
    return `${diffYears}y`;
  }
}

// Show Current Review Card
function showReviewCard() {
  if (currentReviewIndex >= currentReviewCards.length) {
    showToast('All reviews completed!');
    loadDueCards();
    loadStats();
    return;
  }

  const card = currentReviewCards[currentReviewIndex];

  noReviews.style.display = 'none';
  reviewCard.style.display = 'block';

  document.getElementById('review-count').textContent =
    `${currentReviewIndex + 1} / ${currentReviewCards.length}`;

  const topicBadge = document.getElementById('review-topic-badge');
  topicBadge.textContent = card.topic;
  if (card.topicColor) {
    topicBadge.style.backgroundColor = card.topicColor;
  }

  document.getElementById('review-title').textContent = card.title;

  const contentEl = document.getElementById('review-content');
  if (card.content) {
    contentEl.innerHTML = linkifyText(card.content);
    contentEl.style.display = 'block';
  } else {
    contentEl.style.display = 'none';
  }

  document.getElementById('date-added').textContent =
    `Added ${formatDate(card.createdAt)}`;

  // Show review history if exists
  if (card.reviewHistory && card.reviewHistory.length > 0) {
    const historySection = document.getElementById('review-history-section');
    historySection.style.display = 'block';

    const historyEl = document.getElementById('review-history');
    historyEl.innerHTML = card.reviewHistory
      .slice(-5) // Show last 5 reviews
      .reverse()
      .map(review => `
        <div class="history-item">
          <span class="history-date">${formatDate(review.date)}</span>
          <span class="history-rating rating-${review.ratingText.toLowerCase()}">${review.ratingText}</span>
        </div>
      `)
      .join('');
  } else {
    document.getElementById('review-history-section').style.display = 'none';
  }

  // Update upcoming topics list
  updateUpcomingTopics();

  // Load and display scheduling info for rating buttons
  loadSchedulingInfo(card._id);
}

// Update Upcoming Topics List
function updateUpcomingTopics() {
  const upcomingContainer = document.getElementById('upcoming-topics-container');
  const upcomingCount = document.getElementById('upcoming-count');
  const upcomingList = document.getElementById('upcoming-topics-list');

  // Get remaining cards (excluding current one)
  const remainingCards = currentReviewCards.slice(currentReviewIndex + 1);

  if (remainingCards.length === 0) {
    upcomingContainer.style.display = 'none';
    return;
  }

  upcomingContainer.style.display = 'block';
  upcomingCount.textContent = `${remainingCards.length} more topic${remainingCards.length === 1 ? '' : 's'} to review`;

  // Show list by default
  upcomingList.style.display = 'block';
  const toggleBtn = document.getElementById('toggle-upcoming');
  if (toggleBtn) {
    toggleBtn.classList.add('expanded');
  }

  // Populate the list
  upcomingList.innerHTML = remainingCards.map(card => `
    <div class="upcoming-item" data-card-id="${card._id}" style="border-left-color: ${card.topicColor || '#6366f1'};">
      <div class="upcoming-item-header">
        <span class="upcoming-item-badge" style="background-color: ${card.topicColor || '#6366f1'};">${escapeHtml(card.topic)}</span>
        <span class="upcoming-item-title">${escapeHtml(card.title)}</span>
        <div class="upcoming-item-actions">
          <button class="btn-edit-upcoming" data-card-id="${card._id}" title="Edit">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button class="btn-delete-upcoming" data-card-id="${card._id}" title="Delete">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6"></path>
            </svg>
          </button>
        </div>
      </div>
      <div class="upcoming-item-meta">Added ${formatDate(card.createdAt)}</div>
      ${card.content ? `<div class="upcoming-item-notes" style="display: none;">${linkifyText(card.content)}</div>` : ''}
    </div>
  `).join('');

  // Add click handlers to toggle notes
  upcomingList.querySelectorAll('.upcoming-item').forEach(item => {
    const notesEl = item.querySelector('.upcoming-item-notes');
    if (notesEl) {
      item.addEventListener('click', (e) => {
        // Don't toggle if clicking on a link, action buttons, or selecting text
        if (e.target.tagName === 'A' ||
            e.target.closest('.upcoming-item-actions') ||
            window.getSelection().toString().length > 0) {
          return;
        }

        const isExpanded = notesEl.style.display === 'block';
        notesEl.style.display = isExpanded ? 'none' : 'block';
        item.classList.toggle('expanded', !isExpanded);
      });
    }
  });

  // Add edit button handlers
  upcomingList.querySelectorAll('.btn-edit-upcoming').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = btn.dataset.cardId;
      editCard(cardId);
    });
  });

  // Add delete button handlers
  upcomingList.querySelectorAll('.btn-delete-upcoming').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const cardId = btn.dataset.cardId;
      deleteCard(cardId);
    });
  });
}

// Submit Review
async function submitReview(rating) {
  const card = currentReviewCards[currentReviewIndex];

  try {
    const response = await fetch(`/api/cards/${card._id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rating })
    });

    if (!response.ok) throw new Error('Failed to submit review');

    // Add this review to history
    reviewHistory.push({
      cardId: card._id,
      index: currentReviewIndex,
      card: { ...card },
      rating: rating
    });

    // Show undo button
    const undoBtn = document.getElementById('undo-btn');
    if (undoBtn) {
      undoBtn.style.display = 'flex';
    }

    currentReviewIndex++;
    showReviewCard();
    loadStats();
  } catch (error) {
    console.error('Error submitting review:', error);
    showToast('Failed to submit review', 'error');
  }
}

// Skip Card
function skipCard() {
  if (currentReviewIndex >= currentReviewCards.length) {
    return;
  }

  const card = currentReviewCards[currentReviewIndex];

  // Move the current card to the end of the queue
  currentReviewCards.push(card);

  // Increment index to move to the next card
  currentReviewIndex++;

  showToast('Card skipped - will show again later');
  showReviewCard();
}

// Setup Undo Button
function setupUndoButton() {
  const undoBtn = document.getElementById('undo-btn');
  if (undoBtn) {
    undoBtn.addEventListener('click', async () => {
      if (reviewHistory.length === 0) return;

      // Get the last reviewed card
      const lastReview = reviewHistory[reviewHistory.length - 1];

      try {
        const response = await fetch(`/api/cards/${lastReview.cardId}/undo`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        if (!response.ok) throw new Error('Failed to undo review');

        showToast('Review undone successfully');

        // Remove the last review from history
        reviewHistory.pop();

        // Go back to the previous card
        currentReviewIndex = lastReview.index;

        // Insert the card back into the current review session
        const updatedCard = await response.json();
        currentReviewCards[lastReview.index] = updatedCard;

        // Show the card again
        showReviewCard();

        // Hide undo button if no more reviews to undo
        if (reviewHistory.length === 0) {
          undoBtn.style.display = 'none';
        }

        loadStats();
      } catch (error) {
        console.error('Error undoing review:', error);
        showToast('Failed to undo review', 'error');
      }
    });
  }
}

// Setup Upcoming Topics Toggle
function setupUpcomingToggle() {
  const toggleBtn = document.getElementById('toggle-upcoming');
  const upcomingList = document.getElementById('upcoming-topics-list');

  if (toggleBtn) {
    toggleBtn.addEventListener('click', () => {
      const isExpanded = upcomingList.style.display === 'block';

      if (isExpanded) {
        upcomingList.style.display = 'none';
        toggleBtn.classList.remove('expanded');
      } else {
        upcomingList.style.display = 'block';
        toggleBtn.classList.add('expanded');
      }
    });
  }
}

// Load All Cards
async function loadAllCards(preserveSearch = false) {
  try {
    const response = await fetch('/api/cards/all');
    allCards = await response.json();

    const searchInput = document.getElementById('search-input');

    if (preserveSearch && searchInput && searchInput.value.trim()) {
      // Preserve the search and re-apply the filter
      const searchTerm = searchInput.value.toLowerCase().trim();
      filterCards(searchTerm);
    } else {
      // Clear search input when reloading
      if (searchInput) {
        searchInput.value = '';
      }
      renderAllCards(allCards);
    }

    // Update saved titles for autocomplete
    loadTitles();
  } catch (error) {
    console.error('Error loading all cards:', error);
    showToast('Failed to load cards', 'error');
  }
}

// Render All Cards (used by both load and search)
function renderAllCards(cards) {
  if (cards.length === 0) {
    const searchInput = document.getElementById('search-input');
    const isSearching = searchInput && searchInput.value.trim() !== '';

    allCardsContainer.innerHTML = `
      <div class="empty-state">
        <p>${isSearching ? 'No topics found matching your search.' : 'No topics yet. Add your first topic to get started!'}</p>
      </div>
    `;
    return;
  }

  // Group cards by topic
  const groupedCards = {};
  cards.forEach(card => {
    if (!groupedCards[card.topic]) {
      groupedCards[card.topic] = [];
    }
    groupedCards[card.topic].push(card);
  });

  // Render grouped cards
  allCardsContainer.innerHTML = Object.keys(groupedCards)
    .sort()
    .map(topic => {
      const topicCards = groupedCards[topic];
      const topicColor = topicCards[0].topicColor || '#6366f1';

      const cardsHtml = topicCards.map(card => {
        const nextReview = new Date(card.nextReview);
        const now = new Date();
        const isDue = nextReview <= now;

        return `
          <div class="card-item ${isDue ? 'due' : ''}" style="border-left-color: ${card.topicColor || '#6366f1'};">
            <div class="card-item-header">
              <h3>${escapeHtml(card.title)}</h3>
              <div class="card-actions">
                <button class="btn-edit" onclick="editCard('${card._id}')" title="Edit topic">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </button>
                <button class="btn-delete" onclick="deleteCard('${card._id}')">Delete</button>
              </div>
            </div>
            ${card.content ? `<p class="card-item-content">${linkifyText(card.content)}</p>` : ''}
            <div class="card-item-meta">
              <span>Added: ${formatDate(card.createdAt)}</span>
              <span class="${isDue ? 'due-badge' : ''}">
                ${isDue ? 'Due now' : `Next review: ${formatDate(card.nextReview)}`}
              </span>
            </div>
            ${card.reviewHistory && card.reviewHistory.length > 0 ? `
              <div class="card-item-meta">
                <span>Reviews: ${card.reviewHistory.length}</span>
              </div>
            ` : ''}
          </div>
        `;
      }).join('');

      // Count how many are due today
      const now = new Date();
      const dueToday = topicCards.filter(card => new Date(card.nextReview) <= now).length;

      let countText = `${topicCards.length} card${topicCards.length === 1 ? '' : 's'}`;
      if (dueToday > 0) {
        countText += ` (${dueToday} due)`;
      }

      return `
        <div class="topic-group collapsed" data-topic="${escapeHtml(topic)}">
          <h2 class="topic-group-header" style="border-bottom-color: ${topicColor};">
            <span class="topic-group-badge" style="background-color: ${topicColor};">${escapeHtml(topic)}</span>
            <span class="topic-count">${countText}</span>
            <svg class="topic-toggle-icon" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </h2>
          <div class="topic-group-cards">
            ${cardsHtml}
          </div>
        </div>
      `;
    })
    .join('');

  // Add click handlers for topic group headers to toggle collapse/expand
  setupTopicGroupToggles();
}

// Setup topic group toggle functionality
function setupTopicGroupToggles() {
  const topicHeaders = document.querySelectorAll('.topic-group-header');

  topicHeaders.forEach(header => {
    header.addEventListener('click', () => {
      const topicGroup = header.parentElement;
      const cardsContainer = topicGroup.querySelector('.topic-group-cards');
      const toggleIcon = header.querySelector('.topic-toggle-icon');

      // Toggle collapsed state
      topicGroup.classList.toggle('collapsed');

      // Save expanded state to localStorage (since default is collapsed)
      const topic = topicGroup.dataset.topic;
      const expandedTopics = JSON.parse(localStorage.getItem('expandedTopics') || '[]');

      if (!topicGroup.classList.contains('collapsed')) {
        // Topic is expanded
        if (!expandedTopics.includes(topic)) {
          expandedTopics.push(topic);
        }
      } else {
        // Topic is collapsed
        const index = expandedTopics.indexOf(topic);
        if (index > -1) {
          expandedTopics.splice(index, 1);
        }
      }

      localStorage.setItem('expandedTopics', JSON.stringify(expandedTopics));
    });
  });

  // Restore expanded state from localStorage (default is collapsed)
  const expandedTopics = JSON.parse(localStorage.getItem('expandedTopics') || '[]');
  expandedTopics.forEach(topic => {
    const topicGroup = document.querySelector(`.topic-group[data-topic="${CSS.escape(topic)}"]`);
    if (topicGroup) {
      topicGroup.classList.remove('collapsed');
    }
  });
}

// Edit Card
async function editCard(cardId) {
  try {
    // Fetch the card details
    const response = await fetch(`/api/cards/all`);
    const cards = await response.json();
    const card = cards.find(c => c._id === cardId);

    if (!card) {
      showToast('Card not found', 'error');
      return;
    }

    // Populate the edit form
    document.getElementById('edit-card-id').value = card._id;
    document.getElementById('edit-topic').value = card.topic;
    document.getElementById('edit-title').value = card.title;
    document.getElementById('edit-content').value = card.content || '';

    // Initialize topic preview for existing topic
    const existingTopic = availableTopics.find(t => t.name.toLowerCase() === card.topic.toLowerCase());
    const editPreview = document.getElementById('edit-selected-topic-preview');
    const editPreviewBadge = document.getElementById('edit-preview-badge');

    if (existingTopic) {
      editPreview.style.display = 'block';
      editPreviewBadge.textContent = existingTopic.name;
      editPreviewBadge.style.backgroundColor = existingTopic.color;
    } else {
      editPreview.style.display = 'none';
    }

    // Show the modal
    document.getElementById('edit-modal').style.display = 'flex';
  } catch (error) {
    console.error('Error loading card for edit:', error);
    showToast('Failed to load card', 'error');
  }
}

// Close Edit Modal
function closeEditModal() {
  document.getElementById('edit-modal').style.display = 'none';
  document.getElementById('edit-form').reset();
  document.getElementById('edit-selected-topic-preview').style.display = 'none';
  document.getElementById('edit-topic-dropdown').style.display = 'none';
}

// Setup Edit Form
function setupEditForm() {
  const editForm = document.getElementById('edit-form');
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const cardId = document.getElementById('edit-card-id').value;
    const topic = document.getElementById('edit-topic').value;
    const title = document.getElementById('edit-title').value;
    const content = document.getElementById('edit-content').value;

    // Get the topic color from existing topics
    const existingTopic = availableTopics.find(t => t.name.toLowerCase() === topic.trim().toLowerCase());
    const topicColor = existingTopic ? existingTopic.color : null;

    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, title, content, topicColor })
      });

      if (!response.ok) throw new Error('Failed to update card');

      showToast('Topic updated successfully!');
      closeEditModal();

      // Reload topics in case a new one was created
      await loadTopics();

      // Preserve search when reloading cards
      loadAllCards(true);

      // Refresh the review card if we're viewing it
      if (reviewCard.style.display !== 'none' && currentReviewCards[currentReviewIndex]) {
        const currentCard = currentReviewCards[currentReviewIndex];
        if (currentCard._id === cardId) {
          // Reload the cards and update the current review
          await loadDueCards();
        }
      } else {
        // Also reload due cards to refresh upcoming list
        await loadDueCards();
      }
    } catch (error) {
      console.error('Error updating card:', error);
      showToast('Failed to update topic', 'error');
    }
  });

  // Close modal when clicking outside
  const modal = document.getElementById('edit-modal');
  let mouseDownTarget = null;

  // Track where the mouse was pressed down
  modal.addEventListener('mousedown', (e) => {
    mouseDownTarget = e.target;
  });

  // Only close if both mousedown and mouseup happened on the backdrop
  modal.addEventListener('click', (e) => {
    if (e.target === modal && mouseDownTarget === modal) {
      closeEditModal();
    }
    mouseDownTarget = null;
  });

  // Setup Edit Topic Dropdown
  setupEditTopicDropdown();
}

// Setup Edit Topic Dropdown
function setupEditTopicDropdown() {
  const editTopicInput = document.getElementById('edit-topic');
  const editDropdown = document.getElementById('edit-topic-dropdown');
  const editDropdownOptions = document.getElementById('edit-topic-options');
  const editPreview = document.getElementById('edit-selected-topic-preview');
  const editPreviewBadge = document.getElementById('edit-preview-badge');

  // Show dropdown on focus
  editTopicInput.addEventListener('focus', () => {
    renderEditDropdownOptions();
    editDropdown.style.display = 'block';
  });

  // Filter dropdown on input
  editTopicInput.addEventListener('input', () => {
    const inputValue = editTopicInput.value.trim();

    renderEditDropdownOptions(inputValue);
    editDropdown.style.display = 'block';

    const existingTopic = availableTopics.find(t => t.name.toLowerCase() === inputValue.toLowerCase());

    if (existingTopic) {
      // Existing topic - show preview
      editPreview.style.display = 'block';
      editPreviewBadge.textContent = existingTopic.name;
      editPreviewBadge.style.backgroundColor = existingTopic.color;
    } else {
      // New topic or empty - hide preview
      editPreview.style.display = 'none';
    }
  });

  // Show dropdown on arrow click
  const editDropdownArrow = document.querySelector('#edit-topic-dropdown').previousElementSibling;
  if (editDropdownArrow && editDropdownArrow.classList.contains('dropdown-arrow')) {
    editDropdownArrow.addEventListener('click', () => {
      if (editDropdown.style.display === 'none') {
        renderEditDropdownOptions();
        editDropdown.style.display = 'block';
        editTopicInput.focus();
      } else {
        editDropdown.style.display = 'none';
      }
    });
  }

  // Close dropdown when clicking outside
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#edit-topic-dropdown') &&
        !e.target.closest('#edit-topic') &&
        e.target !== editDropdownArrow) {
      editDropdown.style.display = 'none';
    }
  });
}

// Render edit dropdown options
function renderEditDropdownOptions(filter = '') {
  const editDropdownOptions = document.getElementById('edit-topic-options');
  const filterLower = filter.toLowerCase();

  const filteredTopics = availableTopics.filter(topic =>
    topic.name.toLowerCase().includes(filterLower)
  );

  if (filteredTopics.length === 0) {
    editDropdownOptions.innerHTML = '<div class="dropdown-empty">No existing categories. Type to create a new one.</div>';
  } else {
    editDropdownOptions.innerHTML = filteredTopics.map(topic => `
      <div class="dropdown-item" data-topic="${escapeHtml(topic.name)}" data-color="${topic.color}">
        <span class="dropdown-badge" style="background-color: ${topic.color};">${escapeHtml(topic.name)}</span>
      </div>
    `).join('');

    // Add click handlers to dropdown items
    editDropdownOptions.querySelectorAll('.dropdown-item').forEach(item => {
      item.addEventListener('click', () => {
        const topicName = item.dataset.topic;
        const topicColor = item.dataset.color;

        document.getElementById('edit-topic').value = topicName;

        // Show preview
        const editPreview = document.getElementById('edit-selected-topic-preview');
        const editPreviewBadge = document.getElementById('edit-preview-badge');
        editPreview.style.display = 'block';
        editPreviewBadge.textContent = topicName;
        editPreviewBadge.style.backgroundColor = topicColor;

        // Hide dropdown
        document.getElementById('edit-topic-dropdown').style.display = 'none';
      });
    });
  }
}

// Delete Card
async function deleteCard(cardId) {
  if (!confirm('Are you sure you want to delete this topic?')) {
    return;
  }

  try {
    const response = await fetch(`/api/cards/${cardId}`, {
      method: 'DELETE'
    });

    if (!response.ok) throw new Error('Failed to delete card');

    showToast('Topic deleted successfully');
    // Preserve search when reloading cards after deletion
    loadAllCards(true);
    loadStats();

    // If we're in review mode and deleted the current card, reload reviews
    if (reviewCard.style.display !== 'none' && currentReviewCards[currentReviewIndex]) {
      const currentCard = currentReviewCards[currentReviewIndex];
      if (currentCard._id === cardId) {
        // Remove the deleted card from the current review queue
        currentReviewCards.splice(currentReviewIndex, 1);

        // Show next card or no reviews message
        if (currentReviewCards.length === 0) {
          showNoReviews();
        } else {
          // Adjust index if we're at the end
          if (currentReviewIndex >= currentReviewCards.length) {
            currentReviewIndex = currentReviewCards.length - 1;
          }
          showReviewCard();
        }
      } else {
        // Deleted an upcoming card, just refresh the upcoming list
        updateUpcomingTopics();
      }
    }
  } catch (error) {
    console.error('Error deleting card:', error);
    showToast('Failed to delete topic', 'error');
  }
}

// Utility Functions
function formatDate(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = date - now;
  const diffDays = Math.floor(Math.abs(diffTime) / (1000 * 60 * 60 * 24));
  const isPast = diffTime < 0;

  if (diffDays === 0) {
    return 'today';
  } else if (isPast && diffDays === 1) {
    return 'yesterday';
  } else if (isPast && diffDays < 7) {
    return `${diffDays} days ago`;
  } else if (!isPast && diffDays === 1) {
    return 'tomorrow';
  } else if (!isPast && diffDays < 7) {
    return `in ${diffDays} days`;
  } else {
    // Format date with local timezone
    return date.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Convert URLs in text to clickable links
function linkifyText(text) {
  if (!text) return '';

  // Escape HTML first
  const escapedText = escapeHtml(text);

  // URL regex pattern to match http(s) and common URLs
  const urlPattern = /(\b(https?:\/\/|www\.)[^\s<]+[^\s<.,;!?)\]}'"])/gi;

  // Replace URLs with anchor tags
  return escapedText.replace(urlPattern, (url) => {
    // Add https:// if URL starts with www.
    const href = url.startsWith('www.') ? 'https://' + url : url;
    return `<a href="${href}" target="_blank" rel="noopener noreferrer" class="content-link">${url}</a>`;
  });
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = `toast ${type} show`;

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
