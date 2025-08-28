/* === Football Time Tuner JavaScript - Cleaned and Optimized === */

// Configuration constants
const tz = 'Asia/Bangkok';
const MAX_SEC = 150 * 60; // 150 minutes
const BASE_PX_PER_SEC = 3;

// Zoom system
let currentZoomLevel = 0;
const ZOOM_LEVELS = [
  { name: '1min', tickInterval: 60, majorTickInterval: 300, pxPerSec: 3 },
  { name: '5min', tickInterval: 300, majorTickInterval: 900, pxPerSec: 1.5 },
  { name: '10min', tickInterval: 600, majorTickInterval: 1800, pxPerSec: 0.75 }
];
let PX_PER_SEC = ZOOM_LEVELS[currentZoomLevel].pxPerSec;

// PDF Export libraries
let html2canvas = null;
let jsPDF = null;

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

// Local storage keys
const LS_KEYS = {
  t1h: 'ftt_t1h', t1m: 'ftt_t1m', t2h: 'ftt_t2h', t2m: 'ftt_t2m',
  seekPos: 'ftt_seek_position', teamA: 'ftt_team_a', teamB: 'ftt_team_b',
  colorA: 'ftt_color_a', colorB: 'ftt_color_b',
  firstHalfEnd: 'ftt_first_half_end', secondHalfEnd: 'ftt_second_half_end'
};

// DOM Elements cache
const elements = {
  teamA: $('#teamA'), teamB: $('#teamB'),
  colorA: $('#colorA'), colorB: $('#colorB'),
  t1h: $('#t1h'), t1m: $('#t1m'), t2h: $('#t2h'), t2m: $('#t2m'),
  t1now: $('#t1now'), t2now: $('#t2now'),
  endFirstHalf: $('#endFirstHalf'), endSecondHalf: $('#endSecondHalf'),
  resetFirstHalf: $('#resetFirstHalf'), resetSecondHalf: $('#resetSecondHalf'),
  firstHalfEndTime: $('#firstHalfEndTime'), secondHalfEndTime: $('#secondHalfEndTime'),
  playBtn: $('#playBtn'), liveBtn: $('#liveBtn'), autoStatus: $('#autoStatus'),
  zoomIn: $('#zoomIn'), zoomOut: $('#zoomOut'), zoomLevel: $('#zoomLevel'),
  wrap: $('#wrap'), scaleFirstHalf: $('#scaleFirstHalf'), scaleSecondHalf: $('#scaleSecondHalf'),
  ticksFirstHalf: $('#ticksFirstHalf'), ticksSecondHalf: $('#ticksSecondHalf'),
  bookmarksFirstHalf: $('#bookmarksFirstHalf'), bookmarksSecondHalf: $('#bookmarksSecondHalf'),
  needleFirstHalf: $('#needleFirstHalf'), needleSecondHalf: $('#needleSecondHalf'),
  barReal: $('#barReal'), barField: $('#barField'), barFieldPill: $('#barFieldPill'),
  sheet: $('#seekSheet'), backdrop: $('#sheetBackdrop'),
  sheetMin: $('#sheetMin'), sheetSec: $('#sheetSec'),
  sheetGo: $('#sheetGo'), sheetCancel: $('#sheetCancel'),
  quick0: $('#quick0'), quick45: $('#quick45'), quick90: $('#quick90'),
  addBookmarkBtn: $('#addBookmarkBtn'), viewBookmarksBtn: $('#viewBookmarksBtn'),
  bookmarkCount: $('#bookmarkCount'),
  bookmarkSheet: $('#bookmarkSheet'), bookmarkBackdrop: $('#bookmarkBackdrop'),
  bookmarkTime: $('#bookmarkTime'), bookmarkNote: $('#bookmarkNote'),
  bookmarkDropdown: $('#bookmarkDropdown'), bookmarkSave: $('#bookmarkSave'),
  bookmarkCancel: $('#bookmarkCancel'),
  bookmarkListSheet: $('#bookmarkListSheet'), bookmarkListBackdrop: $('#bookmarkListBackdrop'),
  bookmarkListClose: $('#bookmarkListClose'), bookmarkList: $('#bookmarkList'),
  clearAllBookmarks: $('#clearAllBookmarks'), exportBtn: $('#exportBtn')
};

// State variables
let start1Sec = null, start2Sec = null;
let firstHalfEndSec = null, secondHalfEndSec = null;
let seekSecVal = 0, dragging = false, lastX = 0;
let isAutoPlaying = false, autoPlayInterval = null, playbackSpeed = 1;
let autoPlayStartTime = null, autoPlayStartFieldTime = 0;
let bookmarks = [];

// Bookmark storage and event types
const BOOKMARK_STORAGE_KEY = 'ftt_bookmarks';
const EVENT_TYPES = {
  yellow: { icon: '🟨', name: 'ใบเหลือง', class: 'yellow', teamOptions: true },
  secondYellow: { icon: '🟨²🟥', name: 'ใบเหลืองที่2', class: 'secondYellow', teamOptions: true },
  red: { icon: '🟥', name: 'ใบแดง', class: 'red', teamOptions: true },
  penalty: { icon: '🔴', name: 'จุดโทษ', class: 'penalty', teamOptions: true },
  goal: { icon: '⚽', name: 'ประตู', class: 'goal', teamOptions: true },
  substitution: { icon: '🔄', name: 'เปลี่ยนตัว', class: 'substitution', teamOptions: true },
  important: { icon: '⭐', name: 'เหตุการณ์สำคัญ', class: 'important', importantOptions: true },
  custom: { icon: '📝', name: 'กำหนดเอง', class: 'custom' }
};

// Default colors
const DEFAULT_COLORS = { teamA: '#4caf50', teamB: '#8bc34a' };

/* === Utility Functions === */

// Storage operations
const storage = {
  set(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch (e) {
      // Silently fail
    }
  },
  get(key) {
    try {
      return localStorage.getItem(key);
    } catch (e) {
      return null;
    }
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch (e) {
      // Silently fail
    }
  }
};

// Feedback message utility
function showFeedback(message, type = 'success', duration = 2000) {
  const colors = {
    success: 'rgba(76, 175, 80, 0.9)',
    error: 'rgba(244, 67, 54, 0.9)',
    info: 'rgba(33, 150, 243, 0.9)',
    warning: 'rgba(255, 152, 0, 0.9)'
  };
  
  const feedback = document.createElement('div');
  feedback.innerHTML = message;
  feedback.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: ${colors[type]}; color: white; padding: 12px 24px;
    border-radius: 8px; font-weight: bold; z-index: 1000;
    animation: fadeInOut ${duration}ms ease-in-out; font-size: 14px;
  `;
  document.body.appendChild(feedback);
  setTimeout(() => {
    if (document.body.contains(feedback)) {
      document.body.removeChild(feedback);
    }
  }, duration);
}

// Loading indicator utility
function createLoadingIndicator(text) {
  const loading = document.createElement('div');
  loading.style.cssText = `
    position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9); color: white; padding: 20px 30px;
    border-radius: 12px; font-weight: bold; z-index: 10000;
    display: flex; align-items: center; gap: 12px;
  `;
  loading.innerHTML = `
    <div style="width: 20px; height: 20px; border: 2px solid #fff; border-top: 2px solid transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
    ${text}
  `;
  
  if (!document.getElementById('spin-style')) {
    const style = document.createElement('style');
    style.id = 'spin-style';
    style.textContent = '@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }';
    document.head.appendChild(style);
  }
  
  document.body.appendChild(loading);
  return loading;
}

function removeLoadingIndicator(loadingEl) {
  if (loadingEl?.parentNode) {
    loadingEl.parentNode.removeChild(loadingEl);
  }
}

function addClickEffect(button) {
  button.style.transform = 'scale(0.95)';
  setTimeout(() => { button.style.transform = ''; }, 150);
}

/* === Time Functions === */

function getStart1Sec() { return +elements.t1h.value * 3600 + +elements.t1m.value * 60; }
function getStart2Sec() { return +elements.t2h.value * 3600 + +elements.t2m.value * 60; }
function nowSecOfDay() { const d = new Date(); return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds(); }
function secToHM(sec) { sec = ((sec % 86400) + 86400) % 86400; const h = Math.floor(sec / 3600); const m = Math.floor((sec % 3600) / 60); return `${pad2(h)}:${pad2(m)}`; }
function getFirstHalfMaxSec() { return firstHalfEndSec !== null ? firstHalfEndSec : 4500; }

function formatTimeForPDF(timeInSeconds) {
  const FIRST_HALF_MAX = getFirstHalfMaxSec();
  
  if (timeInSeconds <= 2700) {
    return fmtMMSS(timeInSeconds);
  } else if (timeInSeconds <= FIRST_HALF_MAX) {
    const extraTime = timeInSeconds - 2700;
    const extraMinutes = Math.floor(extraTime / 60);
    const extraSeconds = Math.floor(extraTime % 60);
    return `45+${extraMinutes}:${pad2(extraSeconds)}`;
  } else if (timeInSeconds <= FIRST_HALF_MAX + 2700) {
    const secondHalfTime = timeInSeconds - FIRST_HALF_MAX;
    const totalMinutes = 45 + Math.floor(secondHalfTime / 60);
    const seconds = Math.floor(secondHalfTime % 60);
    return `${pad2(totalMinutes)}:${pad2(seconds)}`;
  } else {
    const extraTime = timeInSeconds - (FIRST_HALF_MAX + 2700);
    const extraMinutes = Math.floor(extraTime / 60);
    const extraSeconds = Math.floor(extraTime % 60);
    return `90+${extraMinutes}:${pad2(extraSeconds)}`;
  }
}

function fieldToRealSec(fieldSec) {
  if (start1Sec == null || start2Sec == null) return null;
  const FIRST_HALF_MAX = getFirstHalfMaxSec();
  if (fieldSec <= FIRST_HALF_MAX) {
    return start1Sec + fieldSec;
  } else {
    return start2Sec + (fieldSec - FIRST_HALF_MAX);
  }
}

function realToFieldSec(realSec) {
  if (start1Sec == null || start2Sec == null) return 0;
  const FIRST_HALF_MAX = getFirstHalfMaxSec();
  
  if (realSec >= start1Sec && realSec < start2Sec) {
    return Math.min(realSec - start1Sec, FIRST_HALF_MAX);
  } else if (realSec >= start2Sec) {
    return FIRST_HALF_MAX + (realSec - start2Sec);
  } else {
    return 0;
  }
}

/* === Team Color Management === */

function getTeamColors() {
  let colorA = elements.colorA?.value || DEFAULT_COLORS.teamA;
  let colorB = elements.colorB?.value || DEFAULT_COLORS.teamB;
  
  const savedColorA = storage.get(LS_KEYS.colorA);
  const savedColorB = storage.get(LS_KEYS.colorB);
  
  if (savedColorA && !elements.colorA?.value) colorA = savedColorA;
  if (savedColorB && !elements.colorB?.value) colorB = savedColorB;
  
  return { colorA, colorB };
}

function saveTeamColors() {
  if (elements.colorA) storage.set(LS_KEYS.colorA, elements.colorA.value);
  if (elements.colorB) storage.set(LS_KEYS.colorB, elements.colorB.value);
}

function loadTeamColors() {
  const colorA = storage.get(LS_KEYS.colorA);
  const colorB = storage.get(LS_KEYS.colorB);
  
  if (colorA && elements.colorA) elements.colorA.value = colorA;
  if (colorB && elements.colorB) elements.colorB.value = colorB;
  
  return colorA && colorB;
}

function updateTeamColorsInCSS() {
  const colors = getTeamColors();
  
  document.documentElement.style.setProperty('--team-a-color', colors.colorA);
  document.documentElement.style.setProperty('--team-b-color', colors.colorB);
  document.documentElement.style.setProperty('--half1', colors.colorA);
  document.documentElement.style.setProperty('--half2', colors.colorB);
  
  const colorALight = hexToRgba(colors.colorA, 0.2);
  const colorBLight = hexToRgba(colors.colorB, 0.2);
  
  document.documentElement.style.setProperty('--team-a-light', colorALight);
  document.documentElement.style.setProperty('--team-b-light', colorBLight);
  
  const vsDiv = document.querySelector('.vs-divider');
  if (vsDiv) {
    vsDiv.style.background = `linear-gradient(135deg, ${colors.colorA}, ${colors.colorB})`;
  }
}

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function getTeamNames() {
  let teamA = elements.teamA?.value.trim() || '';
  let teamB = elements.teamB?.value.trim() || '';
  
  if (!teamA) teamA = storage.get(LS_KEYS.teamA) || 'ทีมเจ้าบ้าน';
  if (!teamB) teamB = storage.get(LS_KEYS.teamB) || 'ทีมเยือน';
  
  return { teamA, teamB };
}

function saveTeamNames() {
  if (elements.teamA) storage.set(LS_KEYS.teamA, elements.teamA.value.trim());
  if (elements.teamB) storage.set(LS_KEYS.teamB, elements.teamB.value.trim());
  saveTeamColors();
}

function loadTeamNames() {
  const teamA = storage.get(LS_KEYS.teamA);
  const teamB = storage.get(LS_KEYS.teamB);
  
  if (teamA && elements.teamA) elements.teamA.value = teamA;
  if (teamB && elements.teamB) elements.teamB.value = teamB;
  
  const hasColors = loadTeamColors();
  return teamA && teamB;
}

/* === Data Persistence === */

function saveStarts() {
  storage.set(LS_KEYS.t1h, String(elements.t1h.value));
  storage.set(LS_KEYS.t1m, String(elements.t1m.value));
  storage.set(LS_KEYS.t2h, String(elements.t2h.value));
  storage.set(LS_KEYS.t2m, String(elements.t2m.value));
}

function loadStarts() {
  const values = [LS_KEYS.t1h, LS_KEYS.t1m, LS_KEYS.t2h, LS_KEYS.t2m]
    .map(key => storage.get(key))
    .filter(val => val !== null);
  
  if (values.length === 4) {
    elements.t1h.value = storage.get(LS_KEYS.t1h);
    elements.t1m.value = storage.get(LS_KEYS.t1m);
    elements.t2h.value = storage.get(LS_KEYS.t2h);
    elements.t2m.value = storage.get(LS_KEYS.t2m);
    return true;
  }
  return false;
}

function saveSeekPosition() { storage.set(LS_KEYS.seekPos, String(seekSecVal)); }

function loadSeekPosition() {
  const saved = storage.get(LS_KEYS.seekPos);
  if (saved !== null) {
    const position = parseInt(saved, 10);
    if (!isNaN(position) && position >= 0 && position <= MAX_SEC) {
      seekSecVal = position;
      return true;
    }
  }
  return false;
}

function saveHalfEndTimes() {
  if (firstHalfEndSec !== null) storage.set(LS_KEYS.firstHalfEnd, String(firstHalfEndSec));
  if (secondHalfEndSec !== null) storage.set(LS_KEYS.secondHalfEnd, String(secondHalfEndSec));
}

function loadHalfEndTimes() {
  const firstEnd = storage.get(LS_KEYS.firstHalfEnd);
  const secondEnd = storage.get(LS_KEYS.secondHalfEnd);
  
  if (firstEnd !== null) firstHalfEndSec = parseInt(firstEnd, 10);
  if (secondEnd !== null) secondHalfEndSec = parseInt(secondEnd, 10);
  
  updateHalfEndDisplay();
  return firstEnd !== null || secondEnd !== null;
}

/* === Bookmark Management === */

function saveBookmarks() { storage.set(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarks)); }

function loadBookmarks() {
  const saved = storage.get(BOOKMARK_STORAGE_KEY);
  if (saved) {
    try {
      bookmarks = JSON.parse(saved);
    } catch (e) {
      bookmarks = [];
    }
  }
}

function addBookmark(timeInSeconds, eventType, note = '') {
  let noteText = '', teamColor = null, teamName = null;
  
  if (typeof note === 'object' && note.text) {
    noteText = note.text;
    teamColor = note.teamColor;
    teamName = note.teamName;
  } else {
    noteText = typeof note === 'string' ? note.trim() : '';
  }
  
  const bookmark = {
    id: Date.now(),
    time: timeInSeconds,
    type: eventType,
    note: noteText,
    teamColor: teamColor,
    teamName: teamName,
    created: new Date().toISOString()
  };
  
  bookmarks.push(bookmark);
  bookmarks.sort((a, b) => a.time - b.time);
  saveBookmarks();
  renderBookmarks();
  updateBookmarkCount();
}

function removeBookmark(bookmarkId) {
  bookmarks = bookmarks.filter(b => b.id !== bookmarkId);
  saveBookmarks();
  renderBookmarks();
  updateBookmarkCount();
  renderBookmarkList();
}

function clearAllBookmarks() {
  if (bookmarks.length === 0) {
    showFeedback('ไม่มีเหตุการณ์ให้ลบ', 'warning');
    return;
  }
  
  if (confirm(`ต้องการลบเหตุการณ์ทั้งหมด ${bookmarks.length} รายการหรือไม่?\n\nการดำเนินการนี้ไม่สามารถยกเลิกได้`)) {
    bookmarks = [];
    saveBookmarks();
    renderBookmarks();
    updateBookmarkCount();
    renderBookmarkList();
    showFeedback('✅ ลบเหตุการณ์ทั้งหมดแล้ว', 'success');
  }
}

function updateBookmarkCount() {
  if (elements.bookmarkCount) {
    elements.bookmarkCount.textContent = bookmarks.length;
  }
}

/* === Zoom Functions === */

function updateZoom() {
  PX_PER_SEC = ZOOM_LEVELS[currentZoomLevel].pxPerSec;
  elements.zoomLevel.textContent = ZOOM_LEVELS[currentZoomLevel].name;
  elements.zoomOut.disabled = (currentZoomLevel === 0);
  elements.zoomIn.disabled = (currentZoomLevel === ZOOM_LEVELS.length - 1);
  
  buildTicks();
  renderBookmarks();
  render();
  
  showFeedback(`🔍 ซูมเป็น ${ZOOM_LEVELS[currentZoomLevel].name}`, 'info', 1500);
}

function zoomIn() {
  if (currentZoomLevel < ZOOM_LEVELS.length - 1) {
    currentZoomLevel++;
    updateZoom();
  }
}

function zoomOut() {
  if (currentZoomLevel > 0) {
    currentZoomLevel--;
    updateZoom();
  }
}

/* === Half End Management === */

function endFirstHalf() {
  firstHalfEndSec = seekSecVal;
  saveHalfEndTimes();
  updateHalfEndDisplay();
  showFeedback(`⏹️ จบครึ่งแรกที่ ${formatTimeForPDF(firstHalfEndSec)}`, 'warning', 3000);
  buildTicks();
  renderBookmarks();
}

function endSecondHalf() {
  secondHalfEndSec = seekSecVal;
  saveHalfEndTimes();
  updateHalfEndDisplay();
  showFeedback(`🏆 จบเกมที่ ${formatTimeForPDF(secondHalfEndSec)}`, 'success', 3000);
  if (isAutoPlaying) stopAutoPlay();
}

function updateHalfEndDisplay() {
  // First half
  if (firstHalfEndSec !== null) {
    elements.firstHalfEndTime.textContent = formatTimeForPDF(firstHalfEndSec);
    elements.firstHalfEndTime.classList.add('set');
    elements.endFirstHalf.classList.add('completed');
    elements.endFirstHalf.textContent = '✅ ครึ่งแรกจบแล้ว';
    elements.resetFirstHalf.style.display = 'flex';
  } else {
    elements.firstHalfEndTime.textContent = '--:--';
    elements.firstHalfEndTime.classList.remove('set');
    elements.endFirstHalf.classList.remove('completed');
    elements.endFirstHalf.textContent = '⏹️ จบครึ่งแรก';
    elements.resetFirstHalf.style.display = 'none';
  }
  
  // Second half
  if (secondHalfEndSec !== null) {
    elements.secondHalfEndTime.textContent = formatTimeForPDF(secondHalfEndSec);
    elements.secondHalfEndTime.classList.add('set');
    elements.endSecondHalf.classList.add('completed');
    elements.endSecondHalf.textContent = '🏆 เกมจบแล้ว';
    elements.resetSecondHalf.style.display = 'flex';
  } else {
    elements.secondHalfEndTime.textContent = '--:--';
    elements.secondHalfEndTime.classList.remove('set');
    elements.endSecondHalf.classList.remove('completed');
    elements.endSecondHalf.textContent = '🏆 จบเกม';
    elements.resetSecondHalf.style.display = 'none';
  }
}

function resetFirstHalf() {
  if (confirm('ต้องการรีเซ็ตเวลาจบครึ่งแรกหรือไม่?')) {
    firstHalfEndSec = null;
    storage.remove(LS_KEYS.firstHalfEnd);
    updateHalfEndDisplay();
    showFeedback('🔄 รีเซ็ตเวลาจบครึ่งแรกแล้ว', 'info');
    buildTicks();
    renderBookmarks();
    render();
  }
}

function resetSecondHalf() {
  if (confirm('ต้องการรีเซ็ตเวลาจบเกมหรือไม่?')) {
    secondHalfEndSec = null;
    storage.remove(LS_KEYS.secondHalfEnd);
    updateHalfEndDisplay();
    showFeedback('🔄 รีเซ็ตเวลาจบเกมแล้ว', 'info');
    buildTicks();
    renderBookmarks();
    render();
  }
}

/* === Auto-Play Functions === */

function startAutoPlay() {
  if (isAutoPlaying) return;
  
  isAutoPlaying = true;
  autoPlayStartTime = Date.now();
  autoPlayStartFieldTime = seekSecVal;
  
  elements.playBtn.textContent = '⏸️ Pause';
  elements.playBtn.classList.add('playing');
  
  autoPlayInterval = setInterval(updateAutoPlay, 100);
  updateAutoStatus();
}

function stopAutoPlay() {
  if (!isAutoPlaying) return;
  
  isAutoPlaying = false;
  autoPlayStartTime = null;
  
  if (autoPlayInterval) {
    clearInterval(autoPlayInterval);
    autoPlayInterval = null;
  }
  
  elements.playBtn.textContent = '▶️ Play';
  elements.playBtn.classList.remove('playing');
  updateAutoStatus();
}

function updateAutoPlay() {
  if (!isAutoPlaying || !autoPlayStartTime) return;
  
  const elapsedRealTime = (Date.now() - autoPlayStartTime) / 1000;
  const elapsedFieldTime = elapsedRealTime * playbackSpeed;
  const newSeekVal = autoPlayStartFieldTime + elapsedFieldTime;
  
  if (newSeekVal >= MAX_SEC) {
    seekSecVal = MAX_SEC;
    stopAutoPlay();
    render();
    return;
  }
  
  seekSecVal = Math.min(newSeekVal, MAX_SEC);
  render();
}

function updateAutoStatus() {
  elements.autoStatus.textContent = isAutoPlaying ? 'Playing' : 'Paused';
}

function goToLiveTime() {
  const nowSec = nowSecOfDay();
  const liveFieldTime = realToFieldSec(nowSec);
  
  if (isAutoPlaying) stopAutoPlay();
  
  seekSecVal = Math.max(0, Math.min(liveFieldTime, MAX_SEC));
  render();
  startAutoPlay();
  
  showFeedback(`🔴 นาที ${formatTimeForPDF(seekSecVal)}`, 'info');
}

/* === Rendering Functions === */

function buildTicks() {
  const FIRST_HALF_MAX = getFirstHalfMaxSec();
  const totalWidth = FIRST_HALF_MAX * PX_PER_SEC;
  const currentZoom = ZOOM_LEVELS[currentZoomLevel];
  
  // Build first half ticks
  elements.ticksFirstHalf.style.width = totalWidth + 'px';
  elements.ticksFirstHalf.style.background = `
    linear-gradient(90deg, 
      rgba(76,175,80,.15) 0 ${2700 * PX_PER_SEC}px, 
      rgba(255,152,0,.15) ${2700 * PX_PER_SEC}px 100%
    )`;
  elements.ticksFirstHalf.innerHTML = '';
  
  // Build second half ticks
  elements.ticksSecondHalf.style.width = totalWidth + 'px';
  elements.ticksSecondHalf.style.background = `
    linear-gradient(90deg, 
      rgba(139,195,74,.15) 0 ${2700 * PX_PER_SEC}px,
      rgba(244,67,54,.15) ${2700 * PX_PER_SEC}px 100%
    )`;
  elements.ticksSecondHalf.innerHTML = '';
  
  // Create ticks for both halves
  [elements.ticksFirstHalf, elements.ticksSecondHalf].forEach((container, halfIndex) => {
    for (let s = 0; s <= FIRST_HALF_MAX; s += currentZoom.tickInterval) {
      const x = s * PX_PER_SEC;
      const tick = document.createElement('div');
      const isMajor = (s % currentZoom.majorTickInterval === 0);
      
      tick.className = 'tick' + (isMajor ? ' major' : '');
      tick.style.left = x + 'px';
      
      const label = document.createElement('div');
      let labelText = '', labelClass = '';
      
      if (halfIndex === 0) {
        // First half
        if (s <= 2700) {
          labelText = `${Math.floor(s / 60)}'`;
          labelClass = 'gr';
        } else {
          labelText = `45+${Math.floor((s - 2700) / 60)}'`;
          labelClass = 'et1';
        }
      } else {
        // Second half
        if (s <= 2700) {
          labelText = `${45 + Math.floor(s / 60)}'`;
          labelClass = 'pu';
        } else {
          labelText = `90+${Math.floor((s - 2700) / 60)}'`;
          labelClass = 'et2';
        }
      }
      
      label.className = 'label ' + labelClass + (isMajor ? ' major-label' : ' minor-label');
      label.textContent = labelText;
      tick.appendChild(label);
      
      container.appendChild(tick);
    }
  });
}

function renderBookmarks() {
  const FIRST_HALF_MAX = getFirstHalfMaxSec();
  const totalWidth = FIRST_HALF_MAX * PX_PER_SEC;
  
  [elements.bookmarksFirstHalf, elements.bookmarksSecondHalf].forEach(container => {
    container.style.width = totalWidth + 'px';
    container.innerHTML = '';
  });
  
  bookmarks.forEach(bookmark => {
    const marker = document.createElement('div');
    marker.className = `bookmark-marker ${EVENT_TYPES[bookmark.type].class}`;
    marker.innerHTML = EVENT_TYPES[bookmark.type].icon;
    
    if (bookmark.teamColor) {
      marker.style.borderColor = bookmark.teamColor;
      marker.style.boxShadow = `0 0 12px ${bookmark.teamColor}40`;
      marker.classList.add('team-colored');
    }
    
    let tooltipText = `${formatTimeForPDF(bookmark.time)} - ${EVENT_TYPES[bookmark.type].name}`;
    if (bookmark.teamName) tooltipText += ` (${bookmark.teamName})`;
    if (bookmark.note) tooltipText += `: ${bookmark.note}`;
    marker.title = tooltipText;
    
    marker.addEventListener('click', () => {
      addClickEffect(marker);
      seekToTime(bookmark.time);
    });
    
    if (bookmark.time <= FIRST_HALF_MAX) {
      const x = bookmark.time * PX_PER_SEC;
      marker.style.left = (x - 12) + 'px';
      marker.style.top = '33px';
      elements.bookmarksFirstHalf.appendChild(marker);
    } else {
      const secondHalfTime = bookmark.time - FIRST_HALF_MAX;
      const x = secondHalfTime * PX_PER_SEC;
      marker.style.left = (x - 12) + 'px';
      marker.style.top = '33px';
      elements.bookmarksSecondHalf.appendChild(marker);
    }
  });
}

function render() {
  const FIRST_HALF_MAX = getFirstHalfMaxSec();
  const containerWidth = elements.wrap.clientWidth;
  
  const isFirstHalf = seekSecVal <= FIRST_HALF_MAX;
  
  if (isFirstHalf) {
    const left = containerWidth / 2 - (seekSecVal * PX_PER_SEC);
    elements.scaleFirstHalf.style.transform = `translateX(${left}px)`;
    elements.scaleSecondHalf.style.transform = `translateX(${containerWidth / 2}px)`;
    
    elements.needleFirstHalf.classList.add('active');
    elements.needleFirstHalf.classList.remove('inactive');
    elements.needleSecondHalf.classList.add('inactive');
    elements.needleSecondHalf.classList.remove('active');
  } else {
    const secondHalfTime = seekSecVal - FIRST_HALF_MAX;
    const left = containerWidth / 2 - (secondHalfTime * PX_PER_SEC);
    elements.scaleSecondHalf.style.transform = `translateX(${left}px)`;
    elements.scaleFirstHalf.style.transform = `translateX(${containerWidth / 2 - FIRST_HALF_MAX * PX_PER_SEC}px)`;
    
    elements.needleSecondHalf.classList.add('active');
    elements.needleSecondHalf.classList.remove('inactive');
    elements.needleFirstHalf.classList.add('inactive');
    elements.needleFirstHalf.classList.remove('active');
  }
  
  const pill = elements.barFieldPill;
  pill.classList.remove('h1', 'h2', 'et1', 'et2');
  
  let displayText = '';
  
  if (seekSecVal <= 2700) {
    pill.classList.add('h1');
    displayText = fmtMMSS(seekSecVal);
  } else if (seekSecVal <= FIRST_HALF_MAX) {
    pill.classList.add('et1');
    const extraTime = seekSecVal - 2700;
    const extraMinutes = Math.floor(extraTime / 60);
    const extraSeconds = Math.floor(extraTime % 60);
    displayText = `45+${extraMinutes}:${pad2(extraSeconds)}`;
  } else if (seekSecVal <= FIRST_HALF_MAX + 2700) {
    pill.classList.add('h2');
    const secondHalfTime = seekSecVal - FIRST_HALF_MAX;
    const totalMinutes = 45 + Math.floor(secondHalfTime / 60);
    const seconds = Math.floor(secondHalfTime % 60);
    displayText = `${pad2(totalMinutes)}:${pad2(seconds)}`;
  } else {
    pill.classList.add('et2');
    const extraTime = seekSecVal - (FIRST_HALF_MAX + 2700);
    const extraMinutes = Math.floor(extraTime / 60);
    const extraSeconds = Math.floor(extraTime % 60);
    displayText = `90+${extraMinutes}:${pad2(extraSeconds)}`;
  }
  
  elements.barField.textContent = displayText;
  
  const realSec = fieldToRealSec(seekSecVal);
  elements.barReal.textContent = realSec == null ? '--:--' : secToHM(realSec);
  
  saveSeekPosition();
}

/* === PDF Export Functions === */

async function loadPDFLibraries() {
  if (html2canvas && jsPDF) return true;
  
  const loadingEl = createLoadingIndicator('กำลังเตรียมการ export...');
  
  try {
    if (!html2canvas) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js');
      html2canvas = window.html2canvas;
    }
    
    if (!jsPDF) {
      await loadScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
      jsPDF = window.jspdf.jsPDF;
    }
    
    removeLoadingIndicator(loadingEl);
    return true;
  } catch (error) {
    removeLoadingIndicator(loadingEl);
    showFeedback('ไม่สามารถโหลด libraries สำหรับสร้าง PDF ได้', 'error');
    return false;
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function exportMatchToPDF() {
  if (!start1Sec || !start2Sec) {
    showFeedback('กรุณาตั้งเวลาเริ่มครึ่งแรกและครึ่งหลังก่อนส่งออก PDF', 'warning');
    return;
  }

  if (elements.teamA?.value.trim()) storage.set(LS_KEYS.teamA, elements.teamA.value.trim());
  if (elements.teamB?.value.trim()) storage.set(LS_KEYS.teamB, elements.teamB.value.trim());

  const loaded = await loadPDFLibraries();
  if (!loaded) return;

  const loadingEl = createLoadingIndicator('กำลังสร้าง PDF หลายหน้า...');

  try {
    const stats = generateMatchStats();
    await createPDFReport(stats, loadingEl);
  } catch (error) {
    if (loadingEl) removeLoadingIndicator(loadingEl);
    showFeedback(`เกิดข้อผิดพลาดในการส่งออก PDF: ${error.message}`, 'error');
  }
}

function generateMatchStats() {
  const now = new Date();
  const matchDate = now.toLocaleDateString('th-TH', {
    year: 'numeric', month: 'long', day: 'numeric', timeZone: tz
  });
  
  const statsByType = {};
  Object.keys(EVENT_TYPES).forEach(key => {
    statsByType[key] = bookmarks.filter(b => b.type === key).length;
  });
  
  const { teamA, teamB } = getTeamNames();
  
  return {
    matchTitle: `${teamA} VS ${teamB}`,
    matchDate,
    firstHalfStart: secToHM(start1Sec),
    secondHalfStart: secToHM(start2Sec),
    firstHalfEnd: firstHalfEndSec ? formatTimeForPDF(firstHalfEndSec) : 'ยังไม่กำหนด',
    secondHalfEnd: secondHalfEndSec ? formatTimeForPDF(secondHalfEndSec) : 'ยังไม่กำหนด',
    totalEvents: bookmarks.length,
    statsByType,
    currentPosition: formatTimeForPDF(seekSecVal),
    exportTime: now.toLocaleString('th-TH', { timeZone: tz })
  };
}

async function createPDFReport(stats, loadingEl) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  let currentPage = 1;
  
  loadingEl.innerHTML = loadingEl.innerHTML.replace(/กำลัง.*/, 'กำลังสร้างหน้าที่ 1...');
  
  await addSummaryPageToPDF(pdf, stats);
  
  if (bookmarks.length > 0) {
    const eventsPerPage = 15;
    const totalPages = Math.ceil(bookmarks.length / eventsPerPage);
    
    for (let page = 0; page < totalPages; page++) {
      currentPage++;
      loadingEl.innerHTML = loadingEl.innerHTML.replace(/กำลัง.*/, `กำลังสร้างหน้าที่ ${currentPage}...`);
      
      const startIndex = page * eventsPerPage;
      const endIndex = Math.min(startIndex + eventsPerPage, bookmarks.length);
      const pageBookmarks = bookmarks.slice(startIndex, endIndex);
      
      pdf.addPage();
      await addEventsPageToPDF(pdf, pageBookmarks, page + 1, totalPages, stats);
    }
  }
  
  loadingEl.innerHTML = loadingEl.innerHTML.replace(/กำลัง.*/, 'กำลังบันทึกไฟล์...');
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH').replace(/\//g, '-');
  const timeStr = now.toLocaleTimeString('th-TH', { hour12: false }).replace(/:/g, '-');
  const filename = `Football-Match-Report-${dateStr}-${timeStr}.pdf`;
  
  pdf.save(filename);
  
  removeLoadingIndicator(loadingEl);
  showFeedback(`✅ ส่งออก PDF สำเร็จ! (${currentPage} หน้า)`, 'success');
}

async function addSummaryPageToPDF(pdf, stats) {
  const htmlContent = createSummaryHTML(stats);
  await addHTMLPageToPDF(pdf, htmlContent);
}

async function addEventsPageToPDF(pdf, pageBookmarks, pageNumber, totalPages, stats) {
  const htmlContent = createEventsHTML(pageBookmarks, pageNumber, totalPages, stats);
  await addHTMLPageToPDF(pdf, htmlContent);
}

async function addHTMLPageToPDF(pdf, htmlContent) {
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute; top: -10000px; left: -10000px; width: 210mm; height: 297mm;
    background: white; padding: 15mm; box-sizing: border-box;
    font-family: 'Sarabun', 'Noto Sans Thai', 'Kanit', sans-serif;
  `;
  
  container.innerHTML = htmlContent;
  
  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;700&family=Noto+Sans+Thai:wght@300;400;700&family=Kanit:wght@300;400;700&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);
  
  document.body.appendChild(container);
  
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    const canvas = await html2canvas(container, {
      width: 794, height: 1123, scale: 2, useCORS: true,
      allowTaint: true, backgroundColor: '#ffffff', fontEmbedded: true
    });
    
    if (canvas) {
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, 210, 297);
    }
  } finally {
    document.body.removeChild(container);
  }
}

function createSummaryHTML(stats) {
  const statsRows = Object.entries(stats.statsByType)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => {
      const eventType = EVENT_TYPES[type];
      if (!eventType) return '';
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd; font-size: 14px;">
            ${eventType.icon} ${eventType.name}
          </td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold; font-size: 14px;">
            ${count}
          </td>
        </tr>
      `;
    }).filter(row => row !== '').join('');

  return `
    <div style="font-family: 'Sarabun', 'Noto Sans Thai', 'Kanit', sans-serif; color: #333; line-height: 1.6; height: 267mm; overflow: hidden; padding: 10mm;">
      <div style="text-align: center; border-bottom: 3px solid #4caf50; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="color: #2e7d32; margin: 0; font-size: 32px; font-weight: bold;">⚽ สรุปการแข่งขันฟุตบอล</h1>
        <h2 style="color: #4caf50; margin: 10px 0 0 0; font-size: 24px; font-weight: bold;">${stats.matchTitle}</h2>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">Thai League Report</p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
        <h2 style="color: #2e7d32; margin-top: 0; font-size: 20px;">📅 ข้อมูลการแข่งขัน</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div style="font-size: 14px; line-height: 1.8;">
            <strong>วันที่การแข่งขัน:</strong> ${stats.matchDate}<br>
            <strong>เริ่มครึ่งแรก:</strong> ${stats.firstHalfStart}<br>
            <strong>เริ่มครึ่งหลัง:</strong> ${stats.secondHalfStart}<br>
            <strong>จบครึ่งแรก:</strong> ${stats.firstHalfEnd}
          </div>
          <div style="font-size: 14px; line-height: 1.8;">
            <strong>จบเกม:</strong> ${stats.secondHalfEnd}<br>
            <strong>ตำแหน่งปัจจุบัน:</strong> ${stats.currentPosition}<br>
            <strong>เวลาที่สร้างรายงาน:</strong> ${stats.exportTime}
          </div>
        </div>
      </div>

      <div style="margin-bottom: 25px;">
        <h2 style="color: #2e7d32; font-size: 20px;">📊 สถิติสรุป</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 36px; font-weight: bold; color: #2e7d32;">${stats.totalEvents}</div>
            <div style="color: #666; font-size: 16px;">เหตุการณ์ทั้งหมด</div>
          </div>
          <div style="background: #fff3e0; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #f57c00; font-size: 16px;">รายละเอียดเหตุการณ์</h3>
            <table style="width: 100%; font-size: 14px; border-collapse: collapse;">
              ${statsRows || '<tr><td colspan="2" style="text-align: center; color: #666; padding: 10px;">ไม่มีข้อมูล</td></tr>'}
            </table>
          </div>
        </div>
      </div>

      ${bookmarks.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h2 style="color: #2e7d32; font-size: 20px;">⏱️ ไทม์ไลน์เหตุการณ์</h2>
        <p style="color: #666; font-size: 14px; margin-bottom: 15px;">แสดงเหตุการณ์ทั้งหมด ${bookmarks.length} รายการ (ต่อในหน้าถัดไป)</p>
        <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
          <p style="margin: 0; color: #1565c0; font-weight: bold; font-size: 14px;">📋 รายละเอียดเหตุการณ์แยกตามหน้า ${Math.ceil(bookmarks.length / 15)} หน้า</p>
        </div>
      </div>
      ` : ''}

      <div style="position: absolute; bottom: 10mm; left: 0; right: 0; text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
        สร้างโดย Football Time Tuner | หน้า 1
      </div>
    </div>
  `;
}

function createEventsHTML(pageBookmarks, pageNumber, totalPages, stats) {
  const eventsHtml = pageBookmarks.map(bookmark => {
    const eventType = EVENT_TYPES[bookmark.type];
    if (!eventType) return '';
    
    return `
      <tr style="border-bottom: 1px solid #eee;">
        <td style="text-align: center; padding: 12px 8px; border-right: 1px solid #ddd; width: 60px;">
          <span style="font-size: 20px;">${eventType.icon}</span>
        </td>
        <td style="padding: 12px 8px; border-right: 1px solid #ddd; font-weight: bold; width: 80px; font-size: 16px;">
          ${formatTimeForPDF(bookmark.time)}
        </td>
        <td style="padding: 12px 8px; border-right: 1px solid #ddd; width: 120px; font-size: 14px;">
          ${eventType.name}
        </td>
        <td style="padding: 12px 8px; font-size: 14px; word-break: break-word;">
          ${bookmark.note || '-'}
        </td>
      </tr>
    `;
  }).filter(row => row !== '').join('');

  return `
    <div style="font-family: 'Sarabun', 'Noto Sans Thai', 'Kanit', sans-serif; color: #333; line-height: 1.6; height: 267mm; overflow: hidden; padding: 10mm;">
      <div style="border-bottom: 2px solid #4caf50; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="color: #2e7d32; margin: 0; font-size: 24px; font-weight: bold;">⏱️ ไทม์ไลน์เหตุการณ์ (หน้า ${pageNumber}/${totalPages})</h1>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">แสดงเหตุการณ์ ${(pageNumber-1)*15 + 1} - ${Math.min(pageNumber*15, bookmarks.length)} จากทั้งหมด ${bookmarks.length} รายการ</p>
      </div>

      <div style="margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; background: white; border: 1px solid #ddd;">
          <thead>
            <tr style="background: #4caf50; color: white;">
              <th style="padding: 15px 8px; text-align: center; font-size: 16px; font-weight: bold;">ไอคอน</th>
              <th style="padding: 15px 8px; text-align: center; font-size: 16px; font-weight: bold;">เวลา</th>
              <th style="padding: 15px 8px; text-align: center; font-size: 16px; font-weight: bold;">ประเภท</th>
              <th style="padding: 15px 8px; text-align: center; font-size: 16px; font-weight: bold;">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>${eventsHtml}</tbody>
        </table>
      </div>

      <div style="position: absolute; bottom: 10mm; left: 0; right: 0; text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
        สร้างโดย Football Time Tuner | หน้า ${pageNumber + 1} | ${stats.exportTime}
      </div>
    </div>
  `;
}

/* === UI and Event Functions === */

function fillSelect(el, max) {
  el.innerHTML = '';
  for (let i = 0; i <= max; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = pad2(i);
    el.appendChild(option);
  }
}

function syncStarts() {
  start1Sec = getStart1Sec();
  start2Sec = getStart2Sec();
  saveStarts();
  render();
}

function seekToTime(time) {
  if (isAutoPlaying) stopAutoPlay();
  seekSecVal = time;
  render();
}

function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function pxToSec(px) { return px / PX_PER_SEC; }

// Sheet management
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

function openBookmarkSheet() {
  elements.bookmarkTime.textContent = formatTimeForPDF(seekSecVal);
  elements.bookmarkNote.value = '';
  elements.bookmarkDropdown.value = '';
  const yellowRadio = document.querySelector('input[name="eventType"][value="yellow"]');
  if (yellowRadio) yellowRadio.checked = true;
  
  updateBookmarkDropdown('yellow');
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

function updateBookmarkDropdown(eventType) {
  const dropdown = elements.bookmarkDropdown;
  const noteInput = elements.bookmarkNote;
  const eventConfig = EVENT_TYPES[eventType];
  
  const newDropdown = dropdown.cloneNode(false);
  dropdown.parentNode.replaceChild(newDropdown, dropdown);
  elements.bookmarkDropdown = newDropdown;
  
  if (eventConfig.teamOptions) {
    const { teamA, teamB } = getTeamNames();
    const { colorA, colorB } = getTeamColors();
    
    newDropdown.innerHTML = '<option value="">เลือกทีม</option>';
    
    const optionA = document.createElement('option');
    optionA.value = teamA;
    optionA.textContent = `🏠 ${teamA}`;
    optionA.style.color = colorA;
    optionA.style.fontWeight = 'bold';
    optionA.dataset.teamColor = colorA;
    newDropdown.appendChild(optionA);
    
    const optionB = document.createElement('option');
    optionB.value = teamB;
    optionB.textContent = `🚌 ${teamB}`;
    optionB.style.color = colorB;
    optionB.style.fontWeight = 'bold';
    optionB.dataset.teamColor = colorB;
    newDropdown.appendChild(optionB);
    
    newDropdown.style.display = 'block';
    noteInput.placeholder = 'หมายเหตุเพิ่มเติม (ไม่บังคับ)';
    
    newDropdown.addEventListener('change', function() {
      const selectedOption = this.options[this.selectedIndex];
      if (selectedOption.dataset.teamColor) {
        this.style.color = selectedOption.dataset.teamColor;
        this.style.fontWeight = 'bold';
        this.style.background = `linear-gradient(135deg, ${selectedOption.dataset.teamColor}20, ${selectedOption.dataset.teamColor}10)`;
        this.style.borderColor = `${selectedOption.dataset.teamColor}60`;
      } else {
        this.style.color = '#fff';
        this.style.fontWeight = 'normal';
        this.style.background = 'rgba(0, 0, 0, 0.3)';
        this.style.borderColor = 'rgba(255, 255, 255, 0.2)';
      }
    });
  } else if (eventConfig.importantOptions) {
    newDropdown.innerHTML = '<option value="">เลือกประเภท</option>';
    ['OFR (onfield review)', 'ONR (only review)'].forEach(option => {
      const optionEl = document.createElement('option');
      optionEl.value = option;
      optionEl.textContent = option;
      newDropdown.appendChild(optionEl);
    });
    newDropdown.style.display = 'block';
    noteInput.placeholder = 'หมายเหตุเพิ่มเติม (ไม่บังคับ)';
  } else {
    newDropdown.style.display = 'none';
    noteInput.placeholder = 'หมายเหตุ (ไม่บังคับ)';
  }
  
  newDropdown.value = '';
  newDropdown.style.color = '#fff';
  newDropdown.style.fontWeight = 'normal';
  newDropdown.style.background = 'rgba(0, 0, 0, 0.3)';
  newDropdown.style.borderColor = 'rgba(255, 255, 255, 0.2)';
}

function getCombinedNote() {
  const dropdown = elements.bookmarkDropdown || document.querySelector('#bookmarkDropdown');
  const dropdownValue = dropdown.value;
  const noteValue = elements.bookmarkNote.value.trim();
  
  const selectedOption = dropdown.options[dropdown.selectedIndex];
  const teamColor = selectedOption?.dataset?.teamColor;
  
  let combinedNote = '';
  
  if (dropdownValue && noteValue) {
    combinedNote = `${dropdownValue} - ${noteValue}`;
  } else if (dropdownValue) {
    combinedNote = dropdownValue;
  } else {
    combinedNote = noteValue;
  }
  
  if (teamColor && dropdownValue) {
    combinedNote = {
      text: combinedNote,
      teamColor: teamColor,
      teamName: dropdownValue
    };
  }
  
  return combinedNote;
}

function renderBookmarkList() {
  if (!elements.bookmarkList) return;
  
  if (bookmarks.length === 0) {
    elements.bookmarkList.innerHTML = '<div class="bookmark-empty">ยังไม่มีเหตุการณ์ที่บันทึกไว้</div>';
    return;
  }
  
  elements.bookmarkList.innerHTML = bookmarks.map(bookmark => {
    let teamColorIndicator = '';
    if (bookmark.teamColor && bookmark.teamName) {
      teamColorIndicator = `<div class="team-color-indicator" style="background: ${bookmark.teamColor};" title="${bookmark.teamName}"></div>`;
    }
    
    let noteStyle = '';
    if (bookmark.teamColor) {
      noteStyle = `style="color: ${bookmark.teamColor}; font-weight: 600;"`;
    }
    
    return `
      <div class="bookmark-item">
        <div class="bookmark-info">
          ${teamColorIndicator}
          <span class="event-icon">${EVENT_TYPES[bookmark.type].icon}</span>
          <div class="bookmark-details">
            <div class="bookmark-time">${formatTimeForPDF(bookmark.time)}</div>
            ${bookmark.note ? `<div class="bookmark-note" ${noteStyle}>${bookmark.note}</div>` : ''}
          </div>
        </div>
        <div class="bookmark-actions">
          <button class="bookmark-goto btn-animate" onclick="goToBookmark(${bookmark.time})">ไป</button>
          <button class="bookmark-delete btn-animate" onclick="deleteBookmark(${bookmark.id})">ลบ</button>
        </div>
      </div>
    `;
  }).join('');
}

// Global functions for bookmark actions
window.goToBookmark = function(time) {
  seekToTime(time);
  closeBookmarkListSheet();
};

window.deleteBookmark = function(id) {
  if (confirm('ต้องการลบเหตุการณ์นี้หรือไม่?')) {
    removeBookmark(id);
  }
};

/* === Event Listeners === */

function setupEventListeners() {
  // Auto-play controls
  elements.playBtn.addEventListener('click', () => {
    addClickEffect(elements.playBtn);
    isAutoPlaying ? stopAutoPlay() : startAutoPlay();
  });

  elements.liveBtn.addEventListener('click', () => {
    addClickEffect(elements.liveBtn);
    goToLiveTime();
  });

  // Zoom controls
  elements.zoomIn.addEventListener('click', () => {
    addClickEffect(elements.zoomIn);
    zoomIn();
  });

  elements.zoomOut.addEventListener('click', () => {
    addClickEffect(elements.zoomOut);
    zoomOut();
  });

  // Drag and interaction
  elements.wrap.addEventListener('pointerdown', e => {
    if (isAutoPlaying) stopAutoPlay();
    dragging = true;
    lastX = e.clientX;
    elements.scaleFirstHalf.classList.add('dragging');
    elements.scaleSecondHalf.classList.add('dragging');
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
    elements.scaleFirstHalf.classList.remove('dragging');
    elements.scaleSecondHalf.classList.remove('dragging');
    elements.wrap.releasePointerCapture(e.pointerId);
  });

  elements.wrap.addEventListener('pointercancel', () => {
    dragging = false;
    elements.scaleFirstHalf.classList.remove('dragging');
    elements.scaleSecondHalf.classList.remove('dragging');
  });

  elements.wrap.addEventListener('wheel', e => {
    e.preventDefault();
    if (isAutoPlaying) stopAutoPlay();
    const step = e.shiftKey ? 30 : 5;
    const direction = (e.deltaY > 0 || e.deltaX > 0) ? 1 : -1;
    seekSecVal = clamp(seekSecVal + direction * step, 0, MAX_SEC);
    render();
  }, { passive: false });

  // Keyboard controls
// Keyboard controls - only work when not typing in input fields
  window.addEventListener('keydown', e => {
    // Check if user is typing in an input field
    const activeElement = document.activeElement;
    const isTyping = activeElement && (
      activeElement.tagName === 'INPUT' || 
      activeElement.tagName === 'TEXTAREA' ||
      activeElement.contentEditable === 'true'
    );
    
    // Don't handle keyboard shortcuts when typing
    if (isTyping) return;
    
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (isAutoPlaying) stopAutoPlay();
      seekSecVal = clamp(seekSecVal - (e.shiftKey ? 30 : 5), 0, MAX_SEC);
      render();
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (isAutoPlaying) stopAutoPlay();
      seekSecVal = clamp(seekSecVal + (e.shiftKey ? 30 : 5), 0, MAX_SEC);
      render();
    }
    if (e.key === ' ') {
      e.preventDefault();
      isAutoPlaying ? stopAutoPlay() : startAutoPlay();
    }
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomIn();
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomOut();
    }
  });

  // Start time controls
  [elements.t1h, elements.t1m, elements.t2h, elements.t2m].forEach(el => {
    if (el) el.addEventListener('change', syncStarts);
  });

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

  // Half end controls
  elements.endFirstHalf.addEventListener('click', () => {
    addClickEffect(elements.endFirstHalf);
    if (firstHalfEndSec === null) endFirstHalf();
  });

  elements.endSecondHalf.addEventListener('click', () => {
    addClickEffect(elements.endSecondHalf);
    if (secondHalfEndSec === null) endSecondHalf();
  });

  elements.resetFirstHalf.addEventListener('click', () => {
    addClickEffect(elements.resetFirstHalf);
    resetFirstHalf();
  });

  elements.resetSecondHalf.addEventListener('click', () => {
    addClickEffect(elements.resetSecondHalf);
    resetSecondHalf();
  });

  // Sheet controls
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
    const newTime = clamp(minutes * 60 + seconds, 0, MAX_SEC);
    seekToTime(newTime);
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

  // Quick buttons for extra time
  const quickButtons = [
    { id: '#quick45plus5', time: 3000 },
    { id: '#quick90plus5', time: 7500 },
    { id: '#quick90plus10', time: 7800 }
  ];

  quickButtons.forEach(({ id, time }) => {
    const btn = $(id);
    if (btn) {
      btn.addEventListener('click', () => {
        addClickEffect(btn);
        seekSecVal = time;
        render();
        closeSheet();
      });
    }
  });

  // Bookmark controls
  elements.addBookmarkBtn.addEventListener('click', () => {
    addClickEffect(elements.addBookmarkBtn);
    setTimeout(openBookmarkSheet, 100);
  });

  elements.viewBookmarksBtn.addEventListener('click', () => {
    addClickEffect(elements.viewBookmarksBtn);
    setTimeout(openBookmarkListSheet, 100);
  });

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
    const note = getCombinedNote();
    
    const existingBookmark = bookmarks.find(b => Math.abs(b.time - seekSecVal) <= 5);
    if (existingBookmark) {
      if (!confirm('มีเหตุการณ์อยู่แล้วในเวลานี้ ต้องการเขียนทับหรือไม่?')) {
        return;
      }
      removeBookmark(existingBookmark.id);
    }
    
    addBookmark(seekSecVal, eventType, note);
    closeBookmarkSheet();
    showFeedback('✅ บันทึกเหตุการณ์แล้ว', 'success');
  });

  elements.bookmarkListBackdrop.addEventListener('click', closeBookmarkListSheet);
  elements.bookmarkListClose.addEventListener('click', () => {
    addClickEffect(elements.bookmarkListClose);
    closeBookmarkListSheet();
  });

  elements.clearAllBookmarks.addEventListener('click', () => {
    addClickEffect(elements.clearAllBookmarks);
    setTimeout(clearAllBookmarks, 100);
  });

  if (elements.exportBtn) {
    elements.exportBtn.addEventListener('click', () => {
      addClickEffect(elements.exportBtn);
      setTimeout(exportMatchToPDF, 100);
    });
  }

  // Event type change listener
  document.addEventListener('change', (e) => {
    if (e.target.name === 'eventType') {
      updateBookmarkDropdown(e.target.value);
    }
  });

  // Team name and color listeners
  const setupTeamListeners = () => {
    [elements.teamA, elements.teamB].forEach(el => {
      if (el) {
        ['input', 'blur', 'change'].forEach(event => {
          el.addEventListener(event, saveTeamNames);
        });
      }
    });

    [elements.colorA, elements.colorB].forEach(colorEl => {
      if (colorEl) {
        colorEl.addEventListener('change', () => {
          saveTeamColors();
          updateTeamColorsInCSS();
          const teamName = colorEl.id === 'colorA' ? 'ทีมเจ้าบ้าน' : 'ทีมเยือน';
          showFeedback(`🎨 เปลี่ยนสี${teamName}แล้ว`, 'info');
        });
        
        colorEl.addEventListener('input', updateTeamColorsInCSS);
      }
    });
  };

  setupTeamListeners();
}

/* === Initialization === */

function init() {
  fillSelect(elements.t1h, 23);
  fillSelect(elements.t2h, 23);
  fillSelect(elements.t1m, 59);
  fillSelect(elements.t2m, 59);
  fillSelect(elements.sheetMin, 150);
  fillSelect(elements.sheetSec, 59);
  
  setupEventListeners();
  
  const hadSavedTimes = loadStarts();
  const hadSavedTeams = loadTeamNames();
  const hadSavedHalfEnds = loadHalfEndTimes();
  
  updateTeamColorsInCSS();
  
  if (!hadSavedTimes) {
    const now = new Date();
    elements.t1h.value = now.getHours();
    elements.t1m.value = now.getMinutes();
    
    const secondHalfStart = new Date(now.getTime() + 55 * 60000);
    elements.t2h.value = secondHalfStart.getHours();
    elements.t2m.value = secondHalfStart.getMinutes();
  }
  
  loadBookmarks();
  updateBookmarkCount();
  updateZoom();
  
  buildTicks();
  syncStarts();
  
  const hadSavedPosition = loadSeekPosition();
  if (!hadSavedPosition) seekSecVal = 0;
  
  render();
  renderBookmarks();
  updateAutoStatus();
  
  const hadSavedColors = loadTeamColors();
  
  // Show restore feedback
  if (hadSavedTimes || hadSavedPosition || bookmarks.length > 0 || hadSavedTeams || hadSavedHalfEnds || hadSavedColors) {
    const restoredItems = [];
    if (hadSavedTimes) restoredItems.push('เวลาเริ่มแมตช์');
    if (hadSavedPosition) restoredItems.push('ตำแหน่งเวลา');
    if (bookmarks.length > 0) restoredItems.push(`เหตุการณ์ ${bookmarks.length} รายการ`);
    if (hadSavedTeams) restoredItems.push('ชื่อทีม');
    if (hadSavedColors) restoredItems.push('สีทีม');
    if (hadSavedHalfEnds) restoredItems.push('เวลาจบครึ่ง');
    
    showFeedback(`✅ กู้คืนข้อมูล: ${restoredItems.join(', ')}`, 'success', 3000);
  }
}

// Real-time clock update
setInterval(() => {
  if (start1Sec !== null && start2Sec !== null) {
    const realSec = fieldToRealSec(seekSecVal);
    if (realSec !== null) {
      elements.barReal.textContent = secToHM(realSec);
    }
  }
}, 1000);

window.addEventListener('resize', render);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
