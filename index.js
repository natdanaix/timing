/* === Football Time Tuner JavaScript === */

// Configuration constants
const tz = 'Asia/Bangkok';
const MAX_SEC = 90 * 60; // 90 minutes
const PX_PER_SEC = 3;

// Utility functions
const pad2 = n => String(n).padStart(2, '0');
const fmtMMSS = s => `${pad2(Math.floor(s / 60))}:${pad2(Math.floor(s % 60))}`;
const fmtClockHM = d => d.toLocaleTimeString('th-TH', {
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
  timeZone: tz
});
const $ = q => document.querySelector(q);

// Local storage keys for persistence
const LS_KEYS = {
  t1h: 'ftt_t1h',
  t1m: 'ftt_t1m',
  t2h: 'ftt_t2h',
  t2m: 'ftt_t2m'
};

// DOM Elements
const elements = {
  // Time inputs
  t1h: $('#t1h'),
  t1m: $('#t1m'),
  t2h: $('#t2h'),
  t2m: $('#t2m'),
  
  // Buttons
  t1now: $('#t1now'),
  t2now: $('#t2now'),
  
  // Tuner components
  wrap: $('#wrap'),
  scale: $('#scale'),
  ticks: $('#ticks'),
  bookmarks: $('#bookmarks'),
  
  // Display bars
  barReal: $('#barReal'),
  barField: $('#barField'),
  barFieldPill: $('#barFieldPill'),
  
  // Bottom sheet
  sheet: $('#seekSheet'),
  backdrop: $('#sheetBackdrop'),
  sheetMin: $('#sheetMin'),
  sheetSec: $('#sheetSec'),
  sheetGo: $('#sheetGo'),
  sheetCancel: $('#sheetCancel'),
  
  // Quick buttons
  quick0: $('#quick0'),
  quick45: $('#quick45'),
  quick90: $('#quick90'),
  
  // Bookmark elements
  addBookmarkBtn: $('#addBookmarkBtn'),
  viewBookmarksBtn: $('#viewBookmarksBtn'),
  bookmarkCount: $('#bookmarkCount'),
  
  // Bookmark sheet
  bookmarkSheet: $('#bookmarkSheet'),
  bookmarkBackdrop: $('#bookmarkBackdrop'),
  bookmarkTime: $('#bookmarkTime'),
  bookmarkNote: $('#bookmarkNote'),
  bookmarkSave: $('#bookmarkSave'),
  bookmarkCancel: $('#bookmarkCancel'),
  
  // Bookmark list sheet
  bookmarkListSheet: $('#bookmarkListSheet'),
  bookmarkListBackdrop: $('#bookmarkListBackdrop'),
  bookmarkListClose: $('#bookmarkListClose'),
  bookmarkList: $('#bookmarkList'),
  clearAllBookmarks: $('#clearAllBookmarks')
};

// State variables
let start1Sec = null;
let start2Sec = null;
let seekSecVal = 0; // Current seek position (0-5400 seconds)
let dragging = false;
let lastX = 0;

// Bookmarks system
let bookmarks = []; // Array of bookmark objects
const BOOKMARK_STORAGE_KEY = 'ftt_bookmarks';

// Event type configurations
// Event type configurations
const EVENT_TYPES = {
  yellow: { icon: '🟨', name: 'ใบเหลือง', class: 'yellow' },
  red: { icon: '🟥', name: 'ใบแดง', class: 'red' },
  penalty: { icon: '🔴', name: 'จุดโทษ', class: 'penalty' },
  goal: { icon: '⚽', name: 'ประตู', class: 'goal' },
  substitution: { icon: '🔄', name: 'เปลี่ยนตัว', class: 'substitution' },
  important: { icon: '⭐', name: 'เหตุการณ์สำคัญ', class: 'important' },
  custom: { icon: '📝', name: 'กำหนดเอง', class: 'custom' }
};

/* === Time calculation functions === */

// Get start time of first half in seconds of day
function getStart1Sec() {
  return +elements.t1h.value * 3600 + +elements.t1m.value * 60;
}

// Get start time of second half in seconds of day
function getStart2Sec() {
  return +elements.t2h.value * 3600 + +elements.t2m.value * 60;
}

// Get current time in seconds of day
function nowSecOfDay() {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

// Convert seconds to HH:MM format
function secToHM(sec) {
  sec = ((sec % 86400) + 86400) % 86400;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${pad2(h)}:${pad2(m)}`;
}

/* === Field time <-> Real time conversion === */

// Convert field time to real time
function fieldToRealSec(fieldSec) {
  if (start1Sec == null || start2Sec == null) return null;
  
  // First half: 0-45 minutes (0-2700 seconds)
  if (fieldSec <= 2700) {
    return start1Sec + fieldSec;
  }
  // Second half: 45-90 minutes (2700-5400 seconds)
  else {
    return start2Sec + (fieldSec - 2700);
  }
}

// Convert real time to field time
function realToFieldSec(realSec) {
  if (start1Sec == null || start2Sec == null) return 0;
  
  const end1 = start1Sec + 2700;
  const end2 = start2Sec + 2700;
  
  if (realSec < start1Sec) return 0;
  if (realSec <= end1) return realSec - start1Sec;
  if (realSec < start2Sec) return 2700;
  if (realSec <= end2) return 2700 + (realSec - start2Sec);
  return 5400;
}

/* === Bookmark management functions === */

// Save bookmarks to localStorage
function saveBookmarks() {
  try {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (e) {
    console.warn('Could not save bookmarks:', e);
  }
}

// Load bookmarks from localStorage
function loadBookmarks() {
  try {
    const saved = localStorage.getItem(BOOKMARK_STORAGE_KEY);
    if (saved) {
      bookmarks = JSON.parse(saved);
    }
  } catch (e) {
    console.warn('Could not load bookmarks:', e);
    bookmarks = [];
  }
}

// Add a new bookmark
function addBookmark(timeInSeconds, eventType, note = '') {
  const bookmark = {
    id: Date.now(), // Simple ID generation
    time: timeInSeconds,
    type: eventType,
    note: note.trim(),
    created: new Date().toISOString()
  };
  
  bookmarks.push(bookmark);
  bookmarks.sort((a, b) => a.time - b.time); // Keep sorted by time
  saveBookmarks();
  renderBookmarks();
  updateBookmarkCount();
}

// Remove a bookmark
function removeBookmark(bookmarkId) {
  bookmarks = bookmarks.filter(b => b.id !== bookmarkId);
  saveBookmarks();
  renderBookmarks();
  updateBookmarkCount();
  renderBookmarkList();
}

// Clear all bookmarks
function clearAllBookmarks() {
  if (bookmarks.length === 0) {
    alert('ไม่มีเหตุการณ์ให้ลบ');
    return;
  }
  
  if (confirm(`ต้องการลบเหตุการณ์ทั้งหมด ${bookmarks.length} รายการหรือไม่?\n\nการดำเนินการนี้ไม่สามารถยกเลิกได้`)) {
    bookmarks = [];
    saveBookmarks();
    renderBookmarks();
    updateBookmarkCount();
    renderBookmarkList();
    
    // Show success feedback
    const clearedFeedback = document.createElement('div');
    clearedFeedback.textContent = '✅ ลบเหตุการณ์ทั้งหมดแล้ว';
    clearedFeedback.style.cssText = `
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      background: rgba(244, 67, 54, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: bold;
      z-index: 1000;
      animation: fadeInOut 2s ease-in-out;
    `;
    document.body.appendChild(clearedFeedback);
    setTimeout(() => document.body.removeChild(clearedFeedback), 2000);
  }
}

// Get bookmark at specific time (within 5 seconds tolerance)
function getBookmarkAtTime(timeInSeconds) {
  return bookmarks.find(b => Math.abs(b.time - timeInSeconds) <= 5);
}

// Update bookmark count display
function updateBookmarkCount() {
  if (elements.bookmarkCount) {
    elements.bookmarkCount.textContent = bookmarks.length;
  }
}

// Render bookmark markers on the dial
function renderBookmarks() {
  const totalWidth = MAX_SEC * PX_PER_SEC;
  elements.bookmarks.style.width = totalWidth + 'px';
  elements.bookmarks.innerHTML = '';
  
  bookmarks.forEach(bookmark => {
    const x = bookmark.time * PX_PER_SEC;
    const marker = document.createElement('div');
    marker.className = `bookmark-marker ${EVENT_TYPES[bookmark.type].class}`;
    marker.style.left = (x - 12) + 'px'; // Center the 24px marker
    marker.innerHTML = EVENT_TYPES[bookmark.type].icon;
    marker.title = `${fmtMMSS(bookmark.time)} - ${EVENT_TYPES[bookmark.type].name}${bookmark.note ? ': ' + bookmark.note : ''}`;
    
    // Click to seek to bookmark time
    marker.addEventListener('click', () => {
      addClickEffect(marker);
      seekSecVal = bookmark.time;
      render();
    });
    
    elements.bookmarks.appendChild(marker);
  });
}

// Render bookmark list in the sheet
function renderBookmarkList() {
  if (!elements.bookmarkList) return;
  
  if (bookmarks.length === 0) {
    elements.bookmarkList.innerHTML = '<div class="bookmark-empty">ยังไม่มีเหตุการณ์ที่บันทึกไว้</div>';
    return;
  }
  
  elements.bookmarkList.innerHTML = bookmarks.map(bookmark => `
    <div class="bookmark-item">
      <div class="bookmark-info">
        <span class="event-icon">${EVENT_TYPES[bookmark.type].icon}</span>
        <div class="bookmark-details">
          <div class="bookmark-time">${fmtMMSS(bookmark.time)}</div>
          ${bookmark.note ? `<div class="bookmark-note">${bookmark.note}</div>` : ''}
        </div>
      </div>
      <div class="bookmark-actions">
        <button class="bookmark-goto btn-animate" onclick="goToBookmark(${bookmark.time})">ไป</button>
        <button class="bookmark-delete btn-animate" onclick="deleteBookmark(${bookmark.id})">ลบ</button>
      </div>
    </div>
  `).join('');
}

// Global functions for inline onclick handlers
window.goToBookmark = function(time) {
  seekSecVal = time;
  render();
  closeBookmarkListSheet();
};

window.deleteBookmark = function(id) {
  if (confirm('ต้องการลบเหตุการณ์นี้หรือไม่?')) {
    removeBookmark(id);
  }
};

// Save start times to localStorage
function saveStarts() {
  try {
    localStorage.setItem(LS_KEYS.t1h, String(elements.t1h.value));
    localStorage.setItem(LS_KEYS.t1m, String(elements.t1m.value));
    localStorage.setItem(LS_KEYS.t2h, String(elements.t2h.value));
    localStorage.setItem(LS_KEYS.t2m, String(elements.t2m.value));
  } catch (e) {
    console.warn('Could not save to localStorage:', e);
  }
}

// Load start times from localStorage
function loadStarts() {
  try {
    const a = localStorage.getItem(LS_KEYS.t1h);
    const b = localStorage.getItem(LS_KEYS.t1m);
    const c = localStorage.getItem(LS_KEYS.t2h);
    const d = localStorage.getItem(LS_KEYS.t2m);
    
    if (a !== null) elements.t1h.value = a;
    if (b !== null) elements.t1m.value = b;
    if (c !== null) elements.t2h.value = c;
    if (d !== null) elements.t2m.value = d;
    
    return (a && b && c && d) != null;
  } catch (e) {
    console.warn('Could not load from localStorage:', e);
    return false;
  }
}

/* === UI Building functions === */

// Fill select dropdown with options
function fillSelect(el, max) {
  el.innerHTML = '';
  for (let i = 0; i <= max; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = pad2(i);
    el.appendChild(option);
  }
}

// Build the time scale ticks
function buildTicks() {
  const totalWidth = MAX_SEC * PX_PER_SEC;
  elements.ticks.style.width = totalWidth + 'px';
  
  // Half-time visual split
  const split = 2700 * PX_PER_SEC;
  elements.ticks.style.background = 
    `linear-gradient(90deg, rgba(76,175,80,.15) 0 ${split}px, rgba(139,195,74,.15) ${split}px 100%)`;
  
  elements.ticks.innerHTML = '';
  
  // Create tick marks every 10 seconds, major ticks every minute
  for (let s = 0; s <= MAX_SEC; s += 10) {
    const x = s * PX_PER_SEC;
    const tick = document.createElement('div');
    const major = (s % 60 === 0);
    
    tick.className = 'tick' + (major ? ' major' : '');
    tick.style.left = x + 'px';
    
    // Add time labels to major ticks
    if (major) {
      const m = Math.floor(s / 60);
      const label = document.createElement('div');
      label.className = 'label ' + (m < 45 ? 'gr' : (m === 45 ? 'bd' : 'pu'));
      label.textContent = `${pad2(m)}:00`;
      tick.appendChild(label);
    }
    
    elements.ticks.appendChild(tick);
  }
}

/* === Rendering function === */

function render() {
  const containerWidth = elements.wrap.clientWidth;
  const left = containerWidth / 2 - (seekSecVal * PX_PER_SEC);
  
  // Move the scale to show current time position
  elements.scale.style.transform = `translateX(${left}px)`;
  
  // Update half indicator styling
  const pill = elements.barFieldPill;
  const isFirstHalf = seekSecVal < 2700;
  pill.classList.toggle('h1', isFirstHalf);
  pill.classList.toggle('h2', !isFirstHalf);
  
  // Update field time display
  elements.barField.textContent = fmtMMSS(seekSecVal);
  
  // Update real time display
  const realSec = fieldToRealSec(seekSecVal);
  elements.barReal.textContent = realSec == null ? '--:--' : secToHM(realSec);
}

/* === Interaction handlers === */

// Helper functions for drag/interaction
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pxToSec(px) {
  return px / PX_PER_SEC;
}

// Add button click animation effect
function addClickEffect(button) {
  button.style.transform = 'scale(0.95)';
  setTimeout(() => {
    button.style.transform = '';
  }, 150);
}

/* === Event Listeners === */

// Drag interactions on tuner
elements.wrap.addEventListener('pointerdown', e => {
  dragging = true;
  lastX = e.clientX;
  elements.scale.classList.add('dragging');
  elements.wrap.setPointerCapture(e.pointerId);
});

elements.wrap.addEventListener('pointermove', e => {
  if (!dragging) return;
  
  const dx = e.clientX - lastX;
  lastX = e.clientX;
  seekSecVal = clamp(seekSecVal - pxToSec(dx), 0, MAX_SEC);
  render();
});

elements.wrap.addEventListener('pointerup', e => {
  dragging = false;
  elements.scale.classList.remove('dragging');
  elements.wrap.releasePointerCapture(e.pointerId);
});

elements.wrap.addEventListener('pointercancel', () => {
  dragging = false;
  elements.scale.classList.remove('dragging');
});

// Wheel/scroll interaction
elements.wrap.addEventListener('wheel', e => {
  e.preventDefault();
  const step = e.shiftKey ? 30 : 5;
  const direction = (e.deltaY > 0 || e.deltaX > 0) ? 1 : -1;
  seekSecVal = clamp(seekSecVal + direction * step, 0, MAX_SEC);
  render();
}, { passive: false });

// Keyboard navigation
window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') {
    seekSecVal = clamp(seekSecVal - (e.shiftKey ? 30 : 5), 0, MAX_SEC);
    render();
  }
  if (e.key === 'ArrowRight') {
    seekSecVal = clamp(seekSecVal + (e.shiftKey ? 30 : 5), 0, MAX_SEC);
    render();
  }
});

/* === Bottom sheet (seek picker) === */

function openSheet() {
  elements.sheetMin.value = Math.floor(seekSecVal / 60);
  elements.sheetSec.value = Math.floor(seekSecVal % 60);
  elements.sheet.classList.add('open');
  elements.backdrop.classList.add('open');
}

function closeSheet() {
  elements.sheet.classList.remove('open');
  elements.backdrop.classList.remove('open');
}

/* === Bookmark sheet management === */

function openBookmarkSheet() {
  elements.bookmarkTime.textContent = fmtMMSS(seekSecVal);
  elements.bookmarkNote.value = '';
  // Reset to yellow card as default
  const yellowRadio = document.querySelector('input[name="eventType"][value="yellow"]');
  if (yellowRadio) yellowRadio.checked = true;
  
  elements.bookmarkSheet.classList.add('open');
  elements.bookmarkBackdrop.classList.add('open');
}

function closeBookmarkSheet() {
  elements.bookmarkSheet.classList.remove('open');
  elements.bookmarkBackdrop.classList.remove('open');
}

function openBookmarkListSheet() {
  renderBookmarkList();
  elements.bookmarkListSheet.classList.add('open');
  elements.bookmarkListBackdrop.classList.add('open');
}

function closeBookmarkListSheet() {
  elements.bookmarkListSheet.classList.remove('open');
  elements.bookmarkListBackdrop.classList.remove('open');
}

// Sheet event listeners
elements.barFieldPill.addEventListener('click', () => {
  addClickEffect(elements.barFieldPill);
  setTimeout(openSheet, 100);
});

elements.backdrop.addEventListener('click', closeSheet);

elements.sheetCancel.addEventListener('click', () => {
  addClickEffect(elements.sheetCancel);
  closeSheet();
});

elements.sheetGo.addEventListener('click', () => {
  addClickEffect(elements.sheetGo);
  const minutes = +elements.sheetMin.value || 0;
  const seconds = +elements.sheetSec.value || 0;
  seekSecVal = clamp(minutes * 60 + seconds, 0, MAX_SEC);
  render();
  closeSheet();
});

// Quick time buttons
elements.quick0.addEventListener('click', () => {
  addClickEffect(elements.quick0);
  elements.sheetMin.value = 0;
  elements.sheetSec.value = 0;
  setTimeout(() => elements.sheetGo.click(), 100);
});

elements.quick45.addEventListener('click', () => {
  addClickEffect(elements.quick45);
  elements.sheetMin.value = 45;
  elements.sheetSec.value = 0;
  setTimeout(() => elements.sheetGo.click(), 100);
});

elements.quick90.addEventListener('click', () => {
  addClickEffect(elements.quick90);
  elements.sheetMin.value = 90;
  elements.sheetSec.value = 0;
  setTimeout(() => elements.sheetGo.click(), 100);
});

/* === Bookmark event listeners === */

// Add bookmark button
elements.addBookmarkBtn.addEventListener('click', () => {
  addClickEffect(elements.addBookmarkBtn);
  setTimeout(openBookmarkSheet, 100);
});

// View bookmarks button
elements.viewBookmarksBtn.addEventListener('click', () => {
  addClickEffect(elements.viewBookmarksBtn);
  setTimeout(openBookmarkListSheet, 100);
});

// Bookmark sheet controls
elements.bookmarkBackdrop.addEventListener('click', closeBookmarkSheet);
elements.bookmarkCancel.addEventListener('click', () => {
  addClickEffect(elements.bookmarkCancel);
  closeBookmarkSheet();
});

elements.bookmarkSave.addEventListener('click', () => {
  addClickEffect(elements.bookmarkSave);
  
  const selectedType = document.querySelector('input[name="eventType"]:checked');
  if (!selectedType) return;
  
  const eventType = selectedType.value;
  const note = elements.bookmarkNote.value;
  
  // Check if bookmark already exists at this time
  const existingBookmark = getBookmarkAtTime(seekSecVal);
  if (existingBookmark) {
    if (!confirm('มีเหตุการณ์อยู่แล้วในเวลานี้ ต้องการเขียนทับหรือไม่?')) {
      return;
    }
    removeBookmark(existingBookmark.id);
  }
  
  addBookmark(seekSecVal, eventType, note);
  closeBookmarkSheet();
  
  // Show success feedback
  const savedFeedback = document.createElement('div');
  savedFeedback.textContent = '✅ บันทึกเหตุการณ์แล้ว';
  savedFeedback.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(76, 175, 80, 0.9);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 1000;
    animation: fadeInOut 2s ease-in-out;
  `;
  document.body.appendChild(savedFeedback);
  setTimeout(() => document.body.removeChild(savedFeedback), 2000);
});

// Bookmark list sheet controls
elements.bookmarkListBackdrop.addEventListener('click', closeBookmarkListSheet);
elements.bookmarkListClose.addEventListener('click', () => {
  addClickEffect(elements.bookmarkListClose);
  closeBookmarkListSheet();
});

// Clear all bookmarks button
elements.clearAllBookmarks.addEventListener('click', () => {
  addClickEffect(elements.clearAllBookmarks);
  setTimeout(clearAllBookmarks, 100);
});

/* === Start time controls === */

function syncStarts() {
  start1Sec = getStart1Sec();
  start2Sec = getStart2Sec();
  saveStarts();
  render();
}

// Listen to dropdown changes
[elements.t1h, elements.t1m, elements.t2h, elements.t2m].forEach(el => {
  el.addEventListener('change', syncStarts);
});

// "Now" buttons
elements.t1now.addEventListener('click', () => {
  addClickEffect(elements.t1now);
  const now = new Date();
  elements.t1h.value = now.getHours();
  elements.t1m.value = now.getMinutes();
  syncStarts();
});

elements.t2now.addEventListener('click', () => {
  addClickEffect(elements.t2now);
  const now = new Date();
  elements.t2h.value = now.getHours();
  elements.t2m.value = now.getMinutes();
  syncStarts();
});

/* === Initialization === */

function init() {
  // Fill all dropdown selects
  fillSelect(elements.t1h, 23);
  fillSelect(elements.t2h, 23);
  fillSelect(elements.t1m, 59);
  fillSelect(elements.t2m, 59);
  fillSelect(elements.sheetMin, 90);
  fillSelect(elements.sheetSec, 59);
  
  // Load saved start times or set defaults
  const hadSavedTimes = loadStarts();
  
  if (!hadSavedTimes) {
    // Set default times: first half now, second half 55 minutes later
    const now = new Date();
    elements.t1h.value = now.getHours();
    elements.t1m.value = now.getMinutes();
    
    const secondHalfStart = new Date(now.getTime() + 55 * 60000);
    elements.t2h.value = secondHalfStart.getHours();
    elements.t2m.value = secondHalfStart.getMinutes();
  }
  
  // Load bookmarks
  loadBookmarks();
  updateBookmarkCount();
  
  // Build the visual components
  buildTicks();
  syncStarts();
  
  // Start at the beginning of the match
  seekSecVal = 0;
  render();
  renderBookmarks();
}

// Handle window resize
window.addEventListener('resize', render);

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

// Add some extra polish: update real time display every second
setInterval(() => {
  // Only update if we're showing a valid real time
  if (start1Sec !== null && start2Sec !== null) {
    const realSec = fieldToRealSec(seekSecVal);
    if (realSec !== null) {
      elements.barReal.textContent = secToHM(realSec);
    }
  }
}, 1000);