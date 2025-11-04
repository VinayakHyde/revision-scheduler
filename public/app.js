// State
let currentReviewCards = [];
let currentReviewIndex = 0;
let availableTopics = [];
let allCards = []; // Store all cards for search
let reviewHistory = []; // Store all reviewed cards in current session for undo

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

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  setupThemeToggle();
  setupTabs();
  setupAddForm();
  setupEditForm();
  setupReviewButtons();
  setupSkipButton();
  setupTopicInput();
  setupColorPresets();
  setupSearchInput();
  setupUndoButton();
  setupUpcomingToggle();
  loadTopics();
  loadStats();
  loadDueCards();
});

// Theme Toggle
function setupThemeToggle() {
  const themeToggle = document.getElementById('theme-toggle');
  const html = document.documentElement;

  // Load saved theme preference or default to light
  const savedTheme = localStorage.getItem('theme') || 'light';
  if (savedTheme === 'dark') {
    html.classList.add('dark-mode');
  }

  // Toggle theme on button click
  themeToggle.addEventListener('click', () => {
    html.classList.toggle('dark-mode');
    const isDark = html.classList.contains('dark-mode');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
  });
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
      loadTopics(); // Reload topics to include new one
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

  // Populate the list
  upcomingList.innerHTML = remainingCards.map(card => `
    <div class="upcoming-item" style="border-left-color: ${card.topicColor || '#6366f1'};">
      <div class="upcoming-item-header">
        <span class="upcoming-item-badge" style="background-color: ${card.topicColor || '#6366f1'};">${escapeHtml(card.topic)}</span>
        <span class="upcoming-item-title">${escapeHtml(card.title)}</span>
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
        // Don't toggle if clicking on a link or selecting text
        if (e.target.tagName === 'A' || window.getSelection().toString().length > 0) {
          return;
        }

        const isExpanded = notesEl.style.display === 'block';
        notesEl.style.display = isExpanded ? 'none' : 'block';
        item.classList.toggle('expanded', !isExpanded);
      });
    }
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
async function loadAllCards() {
  try {
    const response = await fetch('/api/cards/all');
    allCards = await response.json();

    // Clear search input when reloading
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
      searchInput.value = '';
    }

    renderAllCards(allCards);
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

      return `
        <div class="topic-group">
          <h2 class="topic-group-header" style="border-bottom-color: ${topicColor};">
            <span class="topic-group-badge" style="background-color: ${topicColor};">${escapeHtml(topic)}</span>
          </h2>
          ${cardsHtml}
        </div>
      `;
    })
    .join('');
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
}

// Setup Edit Form
function setupEditForm() {
  const editForm = document.getElementById('edit-form');
  editForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const cardId = document.getElementById('edit-card-id').value;
    const title = document.getElementById('edit-title').value;
    const content = document.getElementById('edit-content').value;

    try {
      const response = await fetch(`/api/cards/${cardId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });

      if (!response.ok) throw new Error('Failed to update card');

      showToast('Topic updated successfully!');
      closeEditModal();
      loadAllCards();
    } catch (error) {
      console.error('Error updating card:', error);
      showToast('Failed to update topic', 'error');
    }
  });

  // Close modal when clicking outside
  const modal = document.getElementById('edit-modal');
  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      closeEditModal();
    }
  });
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
    loadAllCards();
    loadStats();
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
