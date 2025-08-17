/* === Football Time Tuner JavaScript with Auto-Play === */

// Configuration constants
const tz = 'Asia/Bangkok';
const MAX_SEC = 150 * 60; // 150 minutes (enough for very long extra time)
const BASE_PX_PER_SEC = 3; // Base pixels per second

// Zoom system
let currentZoomLevel = 1; // 1x zoom by default
const ZOOM_LEVELS = [0.25, 0.5, 1, 2, 4, 8]; // Available zoom levels
let PX_PER_SEC = BASE_PX_PER_SEC; // Current pixels per second (changes with zoom)

// PDF Export libraries - loaded dynamically
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

// Local storage keys for persistence
const LS_KEYS = {
  t1h: 'ftt_t1h',
  t1m: 'ftt_t1m',
  t2h: 'ftt_t2h',
  t2m: 'ftt_t2m',
  seekPos: 'ftt_seek_position',
  teamA: 'ftt_team_a',
  teamB: 'ftt_team_b'
};

// DOM Elements
const elements = {
  // Team inputs
  teamA: $('#teamA'),
  teamB: $('#teamB'),
  
  // Time inputs
  t1h: $('#t1h'),
  t1m: $('#t1m'),
  t2h: $('#t2h'),
  t2m: $('#t2m'),
  
  // Buttons
  t1now: $('#t1now'),
  t2now: $('#t2now'),
  
  // Auto-play controls
  playBtn: $('#playBtn'),
  liveBtn: $('#liveBtn'),
  autoStatus: $('#autoStatus'),
  
  // Zoom controls
  zoomInBtn: $('#zoomInBtn'),
  zoomOutBtn: $('#zoomOutBtn'),
  zoomResetBtn: $('#zoomResetBtn'),
  zoomLevel: $('#zoomLevel'),
  
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
  bookmarkDropdown: $('#bookmarkDropdown'),
  bookmarkSave: $('#bookmarkSave'),
  bookmarkCancel: $('#bookmarkCancel'),
  
  // Bookmark list sheet
  bookmarkListSheet: $('#bookmarkListSheet'),
  bookmarkListBackdrop: $('#bookmarkListBackdrop'),
  bookmarkListClose: $('#bookmarkListClose'),
  bookmarkList: $('#bookmarkList'),
  clearAllBookmarks: $('#clearAllBookmarks'),
  
  // Export button
  exportBtn: $('#exportBtn')
};

// State variables
let start1Sec = null;
let start2Sec = null;
let seekSecVal = 0; // Current seek position (0-6600 seconds)
let dragging = false;
let lastX = 0;

// Auto-play state variables
let isAutoPlaying = false;
let autoPlayInterval = null;
let playbackSpeed = 1; // Fixed at 1x speed
let autoPlayStartTime = null;
let autoPlayStartFieldTime = 0;

// Bookmarks system
let bookmarks = []; // Array of bookmark objects
const BOOKMARK_STORAGE_KEY = 'ftt_bookmarks';

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

/* === PDF Export Functions === */

// Format time for PDF display (45+extra format)
function formatTimeForPDF(timeInSeconds) {
  const FIRST_HALF_MAX = 4500; // 75 minutes
  
  if (timeInSeconds <= 2700) {
    // First half (0-45:00)
    return fmtMMSS(timeInSeconds);
  } else if (timeInSeconds <= FIRST_HALF_MAX) {
    // First half extra time (45+0:01 to 45+30:00)
    const extraTime = timeInSeconds - 2700;
    const extraMinutes = Math.floor(extraTime / 60);
    const extraSeconds = Math.floor(extraTime % 60);
    return `45+${extraMinutes}:${pad2(extraSeconds)}`;
  } else if (timeInSeconds <= FIRST_HALF_MAX + 2700) {
    // Second half (45:01-90:00 equivalent)
    const secondHalfTime = timeInSeconds - FIRST_HALF_MAX;
    const totalMinutes = 45 + Math.floor(secondHalfTime / 60);
    const seconds = Math.floor(secondHalfTime % 60);
    return `${pad2(totalMinutes)}:${pad2(seconds)}`;
  } else {
    // Second half extra time (90+0:01 to 90+∞)
    const extraTime = timeInSeconds - (FIRST_HALF_MAX + 2700);
    const extraMinutes = Math.floor(extraTime / 60);
    const extraSeconds = Math.floor(extraTime % 60);
    return `90+${extraMinutes}:${pad2(extraSeconds)}`;
  }
}

// Load external libraries for PDF export
async function loadPDFLibraries() {
  if (html2canvas && jsPDF) return true;
  
  try {
    const loadingEl = createLoadingIndicator('กำลังเตรียมการ export...');
    
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
    console.error('Failed to load PDF libraries:', error);
    alert('ไม่สามารถโหลด libraries สำหรับสร้าง PDF ได้');
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

function createLoadingIndicator(text) {
  const loading = document.createElement('div');
  loading.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 20px 30px;
    border-radius: 12px;
    font-weight: bold;
    z-index: 10000;
    display: flex;
    align-items: center;
    gap: 12px;
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
  if (loadingEl && loadingEl.parentNode) {
    loadingEl.parentNode.removeChild(loadingEl);
  }
}

function generateMatchStats() {
  const now = new Date();
  const matchDate = now.toLocaleDateString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: tz
  });
  
  const statsByType = {};
  Object.keys(EVENT_TYPES).forEach(key => {
    statsByType[key] = bookmarks.filter(b => b.type === key).length;
  });
  
  const firstHalfStart = secToHM(start1Sec);
  const secondHalfStart = secToHM(start2Sec);
  const matchEnd = secToHM(start2Sec + 2700);
  
  const matchTitle = getMatchTitle();
  
  return {
    matchTitle,
    matchDate,
    firstHalfStart,
    secondHalfStart,
    matchEnd,
    totalEvents: bookmarks.length,
    statsByType,
    currentPosition: formatTimeForPDF(seekSecVal), // ใช้ formatTimeForPDF แทน fmtMMSS
    exportTime: now.toLocaleString('th-TH', { timeZone: tz })
  };
}

async function exportMatchToPDF() {
  let loadingEl = null;
  
  try {
    if (!start1Sec || !start2Sec) {
      alert('กรุณาตั้งเวลาเริ่มครึ่งแรกและครึ่งหลังก่อนส่งออก PDF');
      return;
    }

    ensureTeamNamesSaved();

    const loaded = await loadPDFLibraries();
    if (!loaded) return;

    loadingEl = createLoadingIndicator('กำลังสร้าง PDF หลายหน้า...');

    const stats = generateMatchStats();
    
    if (!stats || typeof stats !== 'object') {
      throw new Error('ไม่สามารถสร้างสถิติการแข่งขันได้');
    }
    
    if (!stats.matchTitle) {
      stats.matchTitle = 'ทีม A VS ทีม B';
    }
    
    await createMultiPagePDF(stats, loadingEl);
    
  } catch (error) {
    console.error('Export failed:', error);
    
    if (loadingEl) {
      removeLoadingIndicator(loadingEl);
    }
    
    let errorMessage = 'เกิดข้อผิดพลาดในการส่งออก PDF';
    
    if (error.message) {
      errorMessage += ':\n' + error.message;
    }
    
    alert(errorMessage);
  }
}

async function createMultiPagePDF(stats, loadingEl) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  let currentPage = 1;
  
  updateLoadingMessage(loadingEl, 'กำลังสร้างหน้าที่ 1...');
  
  const headerHtml = createHeaderHTML(stats);
  await addPageToPDF(pdf, headerHtml, currentPage === 1);
  
  if (bookmarks.length > 0) {
    const eventsPerPage = 15;
    const totalPages = Math.ceil(bookmarks.length / eventsPerPage);
    
    for (let page = 0; page < totalPages; page++) {
      currentPage++;
      updateLoadingMessage(loadingEl, `กำลังสร้างหน้าที่ ${currentPage}...`);
      
      const startIndex = page * eventsPerPage;
      const endIndex = Math.min(startIndex + eventsPerPage, bookmarks.length);
      const pageBookmarks = bookmarks.slice(startIndex, endIndex);
      
      pdf.addPage();
      
      const eventsHtml = createEventsPageHTML(pageBookmarks, page + 1, totalPages, stats);
      await addPageToPDF(pdf, eventsHtml, false);
    }
  }
  
  updateLoadingMessage(loadingEl, 'กำลังบันทึกไฟล์...');
  
  const now = new Date();
  const dateStr = now.toLocaleDateString('th-TH').replace(/\//g, '-');
  const timeStr = now.toLocaleTimeString('th-TH', { hour12: false }).replace(/:/g, '-');
  const filename = `Football-Match-Report-${dateStr}-${timeStr}.pdf`;
  
  pdf.save(filename);
  
  removeLoadingIndicator(loadingEl);
  
  showSuccessMessage(`✅ ส่งออก PDF สำเร็จ! (${currentPage} หน้า)`);
}

async function addPageToPDF(pdf, htmlContent, isFirstPage) {
  const container = document.createElement('div');
  container.style.cssText = `
    position: absolute;
    top: -10000px;
    left: -10000px;
    width: 210mm;
    background: white;
    padding: 15mm;
    box-sizing: border-box;
  `;
  
  container.innerHTML = htmlContent;
  
  if (isFirstPage) {
    const fontLink = document.createElement('link');
    fontLink.href = 'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;700&family=Noto+Sans+Thai:wght@300;400;700&display=swap';
    fontLink.rel = 'stylesheet';
    document.head.appendChild(fontLink);
  }
  
  document.body.appendChild(container);
  
  await new Promise(resolve => setTimeout(resolve, 500));
  
  try {
    const canvas = await html2canvas(container, {
      width: 794,
      height: 1123,
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    });
    
    if (canvas) {
      const imgWidth = 210;
      const imgHeight = 297;
      
      pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, imgWidth, imgHeight);
    }
  } finally {
    document.body.removeChild(container);
  }
}

function createHeaderHTML(stats) {
  const statsRows = Object.entries(stats.statsByType)
    .filter(([_, count]) => count > 0)
    .map(([type, count]) => {
      const eventType = EVENT_TYPES[type];
      if (!eventType) return '';
      return `
        <tr>
          <td style="padding: 8px; border: 1px solid #ddd;">
            ${eventType.icon} ${eventType.name}
          </td>
          <td style="padding: 8px; border: 1px solid #ddd; text-align: center; font-weight: bold;">
            ${count}
          </td>
        </tr>
      `;
    }).filter(row => row !== '').join('');

  return `
    <div style="
      font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
      color: #333;
      line-height: 1.6;
      height: 267mm;
      overflow: hidden;
    ">
      <div style="text-align: center; border-bottom: 3px solid #4caf50; padding-bottom: 20px; margin-bottom: 30px;">
        <h1 style="color: #2e7d32; margin: 0; font-size: 32px; font-weight: bold;">
          ⚽ สรุปการแข่งขันฟุตบอล
        </h1>
        <h2 style="color: #4caf50; margin: 10px 0 0 0; font-size: 24px; font-weight: bold;">
          ${stats.matchTitle}
        </h2>
        <p style="margin: 10px 0 0 0; color: #666; font-size: 16px;">
          Thai League Report
        </p>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
        <h2 style="color: #2e7d32; margin-top: 0; font-size: 20px;">📅 ข้อมูลการแข่งขัน</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
          <div>
            <strong>วันที่การแข่งขัน:</strong> ${stats.matchDate}<br>
            <strong>เริ่มครึ่งแรก:</strong> ${stats.firstHalfStart}<br>
            <strong>เริ่มครึ่งหลัง:</strong> ${stats.secondHalfStart}
          </div>
          <div>
            <strong>จบการแข่งขัน:</strong> ${stats.matchEnd}<br>
            <strong>ตำแหน่งปัจจุบัน:</strong> ${stats.currentPosition}<br>
            <strong>เวลาที่สร้างรายงาน:</strong> ${stats.exportTime}
          </div>
        </div>
      </div>

      <div style="margin-bottom: 25px;">
        <h2 style="color: #2e7d32; font-size: 20px;">📊 สถิติสรุป</h2>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
          <div style="background: #e8f5e8; padding: 15px; border-radius: 8px; text-align: center;">
            <div style="font-size: 36px; font-weight: bold; color: #2e7d32;">
              ${stats.totalEvents}
            </div>
            <div style="color: #666;">เหตุการณ์ทั้งหมด</div>
          </div>
          <div style="background: #fff3e0; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #f57c00; font-size: 16px;">รายละเอียดเหตุการณ์</h3>
            <table style="width: 100%; font-size: 14px;">
              ${statsRows || '<tr><td colspan="2" style="text-align: center; color: #666;">ไม่มีข้อมูล</td></tr>'}
            </table>
          </div>
        </div>
      </div>

      ${bookmarks.length > 0 ? `
      <div style="margin-bottom: 20px;">
        <h2 style="color: #2e7d32; font-size: 20px;">⏱️ ไทม์ไลน์เหตุการณ์</h2>
        <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
          แสดงเหตุการณ์ทั้งหมด ${bookmarks.length} รายการ (ต่อในหน้าถัดไป)
        </p>
        <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
          <p style="margin: 0; color: #1565c0; font-weight: bold;">
            📋 รายละเอียดเหตุการณ์แยกตามหน้า ${Math.ceil(bookmarks.length / 15)} หน้า
          </p>
        </div>
      </div>
      ` : ''}

      <div style="position: absolute; bottom: 0; left: 0; right: 0; text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
        สร้างโดย Thai League Report | หน้า 1
      </div>
    </div>
  `;
}

function createEventsPageHTML(pageBookmarks, pageNumber, totalPages, stats) {
  const eventsHtml = pageBookmarks.map(bookmark => {
    const eventType = EVENT_TYPES[bookmark.type];
    if (!eventType) return '';
    
    return `
      <tr>
        <td style="text-align: center; padding: 8px; border: 1px solid #ddd; width: 60px;">
          <span style="font-size: 18px;">${eventType.icon}</span>
        </td>
        <td style="padding: 8px; border: 1px solid #ddd; font-weight: bold; width: 80px;">
          ${formatTimeForPDF(bookmark.time)}
        </td>
        <td style="padding: 8px; border: 1px solid #ddd; width: 120px;">
          ${eventType.name}
        </td>
        <td style="padding: 8px; border: 1px solid #ddd;">
          ${bookmark.note || '-'}
        </td>
      </tr>
    `;
  }).filter(row => row !== '').join('');

  return `
    <div style="
      font-family: 'Sarabun', 'Noto Sans Thai', sans-serif;
      color: #333;
      line-height: 1.6;
      height: 267mm;
      overflow: hidden;
    ">
      <div style="border-bottom: 2px solid #4caf50; padding-bottom: 15px; margin-bottom: 20px;">
        <h1 style="color: #2e7d32; margin: 0; font-size: 24px; font-weight: bold;">
          ⏱️ ไทม์ไลน์เหตุการณ์ (หน้า ${pageNumber}/${totalPages})
        </h1>
        <p style="margin: 5px 0 0 0; color: #666; font-size: 14px;">
          แสดงเหตุการณ์ ${(pageNumber-1)*15 + 1} - ${Math.min(pageNumber*15, bookmarks.length)} จากทั้งหมด ${bookmarks.length} รายการ
        </p>
      </div>

      <div style="margin-bottom: 20px;">
        <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
          <thead>
            <tr style="background: #4caf50; color: white;">
              <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">ไอคอน</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">เวลา</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">ประเภท</th>
              <th style="padding: 12px; border: 1px solid #ddd; text-align: center;">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            ${eventsHtml}
          </tbody>
        </table>
      </div>

      <div style="position: absolute; bottom: 0; left: 0; right: 0; text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
        สร้างโดย Thai League Report | หน้า ${pageNumber + 1} | ${stats.exportTime}
      </div>
    </div>
  `;
}

function updateLoadingMessage(loadingEl, message) {
  if (loadingEl) {
    const textNode = loadingEl.childNodes[1];
    if (textNode) {
      textNode.textContent = message;
    }
  }
}

function showSuccessMessage(message) {
  const successEl = document.createElement('div');
  successEl.textContent = message;
  successEl.style.cssText = `
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
    animation: fadeInOut 3s ease-in-out;
  `;
  document.body.appendChild(successEl);
  setTimeout(() => {
    if (document.body.contains(successEl)) {
      document.body.removeChild(successEl);
    }
  }, 3000);
}

/* === Zoom Functions === */

function updateZoom() {
  PX_PER_SEC = BASE_PX_PER_SEC * currentZoomLevel;
  buildTicks();
  render();
  renderBookmarks();
  updateZoomDisplay();
}

function zoomIn() {
  const currentIndex = ZOOM_LEVELS.indexOf(currentZoomLevel);
  if (currentIndex < ZOOM_LEVELS.length - 1) {
    currentZoomLevel = ZOOM_LEVELS[currentIndex + 1];
    updateZoom();
  }
}

function zoomOut() {
  const currentIndex = ZOOM_LEVELS.indexOf(currentZoomLevel);
  if (currentIndex > 0) {
    currentZoomLevel = ZOOM_LEVELS[currentIndex - 1];
    updateZoom();
  }
}

function resetZoom() {
  currentZoomLevel = 1;
  updateZoom();
}

function updateZoomDisplay() {
  if (elements.zoomLevel) {
    elements.zoomLevel.textContent = `${currentZoomLevel}x`;
  }
  
  // Update button states
  if (elements.zoomInBtn) {
    const currentIndex = ZOOM_LEVELS.indexOf(currentZoomLevel);
    elements.zoomInBtn.disabled = currentIndex >= ZOOM_LEVELS.length - 1;
  }
  
  if (elements.zoomOutBtn) {
    const currentIndex = ZOOM_LEVELS.indexOf(currentZoomLevel);
    elements.zoomOutBtn.disabled = currentIndex <= 0;
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
  if (!isAutoPlaying) {
    elements.autoStatus.textContent = 'Paused';
  } else {
    elements.autoStatus.textContent = 'Playing';
  }
}

function goToLiveTime() {
  const nowSec = nowSecOfDay();
  const liveFieldTime = realToFieldSec(nowSec);
  
  if (isAutoPlaying) {
    stopAutoPlay();
  }
  
  seekSecVal = Math.max(0, Math.min(liveFieldTime, MAX_SEC));
  render();
  
  startAutoPlay();
  
  const liveFeedback = document.createElement('div');
  liveFeedback.textContent = `🔴 นาที ${formatTimeForPDF(seekSecVal)}`;
  liveFeedback.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(33, 150, 243, 0.9);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 1000;
    animation: fadeInOut 2s ease-in-out;
  `;
  document.body.appendChild(liveFeedback);
  setTimeout(() => document.body.removeChild(liveFeedback), 2000);
}

/* === Auto-calculation for Extra Time === */

function calculateExtraTimePeriods() {
  if (!start1Sec || !start2Sec) return;
  
  // Calculate end times for regular periods
  const firstHalfEnd = start1Sec + 2700; // 45 minutes after first half start
  const secondHalfEnd = start2Sec + 2700; // 45 minutes after second half start
  
  // Extra Time First Half: starts 5 minutes after second half ends
  const etFirstHalfStart = secondHalfEnd + 300; // 5 minutes break
  
  // Extra Time Second Half: starts 5 minutes after ET first half ends (15 minutes duration)
  const etSecondHalfStart = etFirstHalfStart + 900 + 300; // 15 minutes + 5 minutes break
  
  // Convert seconds to hours and minutes
  const et1Hours = Math.floor(etFirstHalfStart / 3600) % 24;
  const et1Minutes = Math.floor((etFirstHalfStart % 3600) / 60);
  
  const et2Hours = Math.floor(etSecondHalfStart / 3600) % 24;
  const et2Minutes = Math.floor((etSecondHalfStart % 3600) / 60);
  
  // Update the select elements
  if (elements.et1h && elements.et1m) {
    elements.et1h.value = et1Hours;
    elements.et1m.value = et1Minutes;
  }
  
  if (elements.et2h && elements.et2m) {
    elements.et2h.value = et2Hours;
    elements.et2m.value = et2Minutes;
  }
  
  // Update the state variables
  startET1Sec = getStartET1Sec();
  startET2Sec = getStartET2Sec();
  
  // Save the auto-calculated values
  saveStarts();
  
  // Show auto-calculation feedback
  showAutoCalculationFeedback();
}

function showAutoCalculationFeedback() {
  const et1Time = secToHM(startET1Sec);
  const et2Time = secToHM(startET2Sec);
  
  const feedback = document.createElement('div');
  feedback.innerHTML = `
    <div style="font-weight: bold; margin-bottom: 4px;">🔄 คำนวณเวลาพิเศษอัตโนมัติ</div>
    <div style="font-size: 12px; opacity: 0.9;">
      ET1: ${et1Time} | ET2: ${et2Time}
    </div>
  `;
  feedback.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(33, 150, 243, 0.9);
    color: white;
    padding: 16px 24px;
    border-radius: 12px;
    z-index: 1000;
    animation: fadeInOut 3s ease-in-out;
    text-align: center;
    box-shadow: 0 4px 20px rgba(33, 150, 243, 0.3);
  `;
  document.body.appendChild(feedback);
  setTimeout(() => {
    if (document.body.contains(feedback)) {
      document.body.removeChild(feedback);
    }
  }, 3000);
}

function saveTeamNames() {
  try {
    const teamAEl = document.querySelector('#teamA');
    const teamBEl = document.querySelector('#teamB');
    
    if (teamAEl) {
      localStorage.setItem(LS_KEYS.teamA, teamAEl.value.trim());
    }
    
    if (teamBEl) {
      localStorage.setItem(LS_KEYS.teamB, teamBEl.value.trim());
    }
  } catch (e) {
    console.warn('Could not save team names:', e);
  }
}

function loadTeamNames() {
  try {
    const teamA = localStorage.getItem(LS_KEYS.teamA);
    const teamB = localStorage.getItem(LS_KEYS.teamB);
    
    const teamAEl = document.querySelector('#teamA');
    const teamBEl = document.querySelector('#teamB');
    
    if (teamA !== null && teamAEl) {
      teamAEl.value = teamA;
    }
    
    if (teamB !== null && teamBEl) {
      teamBEl.value = teamB;
    }
    
    const hasTeamNames = teamA && teamB;
    return hasTeamNames;
  } catch (e) {
    console.warn('Could not load team names:', e);
    return false;
  }
}

function getMatchTitle() {
  let teamA = '';
  let teamB = '';
  
  try {
    const savedTeamA = localStorage.getItem(LS_KEYS.teamA);
    const savedTeamB = localStorage.getItem(LS_KEYS.teamB);
    
    if (savedTeamA) teamA = savedTeamA.trim();
    if (savedTeamB) teamB = savedTeamB.trim();
  } catch (e) {
    console.warn('Error reading from localStorage:', e);
  }
  
  if (!teamA) {
    const teamAElement = document.querySelector('#teamA');
    if (teamAElement && teamAElement.value) {
      teamA = teamAElement.value.trim();
    }
  }
  
  if (!teamB) {
    const teamBElement = document.querySelector('#teamB');
    if (teamBElement && teamBElement.value) {
      teamB = teamBElement.value.trim();
    }
  }
  
  if (!teamA) teamA = 'ทีม A';
  if (!teamB) teamB = 'ทีม B';
  
  return `${teamA} VS ${teamB}`;
}

function ensureTeamNamesSaved() {
  try {
    const teamAElement = document.querySelector('#teamA');
    const teamBElement = document.querySelector('#teamB');
    
    if (teamAElement && teamAElement.value.trim()) {
      localStorage.setItem(LS_KEYS.teamA, teamAElement.value.trim());
    }
    
    if (teamBElement && teamBElement.value.trim()) {
      localStorage.setItem(LS_KEYS.teamB, teamBElement.value.trim());
    }
  } catch (e) {
    console.warn('Error saving team names:', e);
  }
}

function setupTeamNameListeners() {
  const teamAEl = document.querySelector('#teamA');
  const teamBEl = document.querySelector('#teamB');
  
  if (teamAEl) {
    teamAEl.addEventListener('input', saveTeamNames);
    teamAEl.addEventListener('blur', saveTeamNames);
    teamAEl.addEventListener('change', saveTeamNames);
  }
  
  if (teamBEl) {
    teamBEl.addEventListener('input', saveTeamNames);
    teamBEl.addEventListener('blur', saveTeamNames);
    teamBEl.addEventListener('change', saveTeamNames);
  }
}

/* === Time calculation functions === */

function getStart1Sec() {
  return +elements.t1h.value * 3600 + +elements.t1m.value * 60;
}

function getStart2Sec() {
  return +elements.t2h.value * 3600 + +elements.t2m.value * 60;
}

function nowSecOfDay() {
  const d = new Date();
  return d.getHours() * 3600 + d.getMinutes() * 60 + d.getSeconds();
}

function secToHM(sec) {
  sec = ((sec % 86400) + 86400) % 86400;
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  return `${pad2(h)}:${pad2(m)}`;
}

/* === Field time <-> Real time conversion === */

function fieldToRealSec(fieldSec) {
  if (start1Sec == null || start2Sec == null) return null;
  
  const FIRST_HALF_MAX = 4500; // 75 minutes = 45 regular + up to 30 extra
  
  // First half and its extra time
  if (fieldSec <= FIRST_HALF_MAX) {
    return start1Sec + fieldSec;
  }
  // Second half and its extra time  
  else {
    const secondHalfFieldTime = fieldSec - FIRST_HALF_MAX;
    return start2Sec + secondHalfFieldTime;
  }
}

function realToFieldSec(realSec) {
  if (start1Sec == null || start2Sec == null) return 0;
  
  const FIRST_HALF_MAX = 4500; // 75 minutes = 45 regular + up to 30 extra
  
  // First half period (including extra time)
  if (realSec >= start1Sec && realSec < start2Sec) {
    return Math.min(realSec - start1Sec, FIRST_HALF_MAX);
  }
  // Second half period (including extra time)
  else if (realSec >= start2Sec) {
    return FIRST_HALF_MAX + (realSec - start2Sec);
  }
  // Before first half
  else {
    return 0;
  }
}

/* === Bookmark management functions === */

// Generate score options for goal events
function generateScoreOptions() {
  const scores = [];
  for (let total = 0; total <= 20; total++) {
    for (let home = 0; home <= total; home++) {
      const away = total - home;
      if (away <= 10 && home <= 10) {
        scores.push(`(${home}–${away})`);
      }
    }
  }
  return scores;
}

// Generate important event options
function generateImportantOptions() {
  return [
    'OFR (onfield review)',
    'ONR (only review)'
  ];
}

// Update bookmark dropdown based on selected event type
function updateBookmarkDropdown(eventType) {
  const dropdown = elements.bookmarkDropdown;
  const noteInput = elements.bookmarkNote;
  
  if (eventType === 'goal') {
    // Show dropdown with score options
    dropdown.innerHTML = '<option value="">เลือกคะแนน</option>';
    generateScoreOptions().forEach(score => {
      const option = document.createElement('option');
      option.value = score;
      option.textContent = score;
      dropdown.appendChild(option);
    });
    dropdown.style.display = 'block';
    noteInput.placeholder = 'หมายเหตุเพิ่มเติม (ไม่บังคับ)';
  } else if (eventType === 'important') {
    // Show dropdown with important event options
    dropdown.innerHTML = '<option value="">เลือกประเภท</option>';
    generateImportantOptions().forEach(option => {
      const optionEl = document.createElement('option');
      optionEl.value = option;
      optionEl.textContent = option;
      dropdown.appendChild(optionEl);
    });
    dropdown.style.display = 'block';
    noteInput.placeholder = 'หมายเหตุเพิ่มเติม (ไม่บังคับ)';
  } else {
    // Hide dropdown for other event types
    dropdown.style.display = 'none';
    noteInput.placeholder = 'หมายเหตุ (ไม่บังคับ)';
  }
  
  // Reset dropdown value
  dropdown.value = '';
}

// Get combined note from dropdown and text input
function getCombinedNote() {
  const dropdownValue = elements.bookmarkDropdown.value;
  const noteValue = elements.bookmarkNote.value.trim();
  
  if (dropdownValue && noteValue) {
    return `${dropdownValue} - ${noteValue}`;
  } else if (dropdownValue) {
    return dropdownValue;
  } else {
    return noteValue;
  }
}

function saveBookmarks() {
  try {
    localStorage.setItem(BOOKMARK_STORAGE_KEY, JSON.stringify(bookmarks));
  } catch (e) {
    console.warn('Could not save bookmarks:', e);
  }
}

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

function addBookmark(timeInSeconds, eventType, note = '') {
  const bookmark = {
    id: Date.now(),
    time: timeInSeconds,
    type: eventType,
    note: note.trim(),
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
    alert('ไม่มีเหตุการณ์ให้ลบ');
    return;
  }
  
  if (confirm(`ต้องการลบเหตุการณ์ทั้งหมด ${bookmarks.length} รายการหรือไม่?\n\nการดำเนินการนี้ไม่สามารถยกเลิกได้`)) {
    bookmarks = [];
    saveBookmarks();
    renderBookmarks();
    updateBookmarkCount();
    renderBookmarkList();
    
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

function getBookmarkAtTime(timeInSeconds) {
  return bookmarks.find(b => Math.abs(b.time - timeInSeconds) <= 5);
}

function updateBookmarkCount() {
  if (elements.bookmarkCount) {
    elements.bookmarkCount.textContent = bookmarks.length;
  }
}

function renderBookmarks() {
  const totalWidth = MAX_SEC * PX_PER_SEC;
  elements.bookmarks.style.width = totalWidth + 'px';
  elements.bookmarks.innerHTML = '';
  
  bookmarks.forEach(bookmark => {
    const x = bookmark.time * PX_PER_SEC;
    const marker = document.createElement('div');
    marker.className = `bookmark-marker ${EVENT_TYPES[bookmark.type].class}`;
    marker.style.left = (x - 12) + 'px';
    marker.innerHTML = EVENT_TYPES[bookmark.type].icon;
    marker.title = `${formatTimeForPDF(bookmark.time)} - ${EVENT_TYPES[bookmark.type].name}${bookmark.note ? ': ' + bookmark.note : ''}`;
    
    marker.addEventListener('click', () => {
      addClickEffect(marker);
      seekToTime(bookmark.time);
    });
    
    elements.bookmarks.appendChild(marker);
  });
}

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
          <div class="bookmark-time">${formatTimeForPDF(bookmark.time)}</div>
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

window.goToBookmark = function(time) {
  seekToTime(time);
  closeBookmarkListSheet();
};

window.deleteBookmark = function(id) {
  if (confirm('ต้องการลบเหตุการณ์นี้หรือไม่?')) {
    removeBookmark(id);
  }
};

function seekToTime(time) {
  if (isAutoPlaying) {
    stopAutoPlay();
  }
  
  seekSecVal = time;
  render();
}

function saveSeekPosition() {
  try {
    localStorage.setItem(LS_KEYS.seekPos, String(seekSecVal));
  } catch (e) {
    console.warn('Could not save seek position:', e);
  }
}

function loadSeekPosition() {
  try {
    const saved = localStorage.getItem(LS_KEYS.seekPos);
    if (saved !== null) {
      const position = parseInt(saved, 10);
      if (!isNaN(position) && position >= 0 && position <= MAX_SEC) {
        seekSecVal = position;
        return true;
      }
    }
  } catch (e) {
    console.warn('Could not load seek position:', e);
  }
  return false;
}

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
    
    const hasAllSavedTimes = (a && b && c && d) != null;
    return hasAllSavedTimes;
  } catch (e) {
    console.warn('Could not load from localStorage:', e);
    return false;
  }
}

/* === UI Building functions === */

function fillSelect(el, max) {
  el.innerHTML = '';
  for (let i = 0; i <= max; i++) {
    const option = document.createElement('option');
    option.value = i;
    option.textContent = pad2(i);
    el.appendChild(option);
  }
}

function buildTicks() {
  const totalWidth = MAX_SEC * PX_PER_SEC;
  elements.ticks.style.width = totalWidth + 'px';
  
  const FIRST_HALF_MAX = 4500; // 75 minutes
  
  // Create background zones for different periods
  const split1 = 2700 * PX_PER_SEC; // End of first half (45:00)
  const split2 = FIRST_HALF_MAX * PX_PER_SEC; // End of first half extra time
  const split3 = (FIRST_HALF_MAX + 2700) * PX_PER_SEC; // End of second half (90:00)
  
  elements.ticks.style.background = `
    linear-gradient(90deg, 
      rgba(76,175,80,.15) 0 ${split1}px, 
      rgba(255,152,0,.15) ${split1}px ${split2}px,
      rgba(139,195,74,.15) ${split2}px ${split3}px,
      rgba(244,67,54,.15) ${split3}px 100%
    )`;
  
  elements.ticks.innerHTML = '';
  
  // Determine tick interval based on zoom level
  let tickInterval = 60; // Default: every minute
  let majorTickInterval = 300; // Default: every 5 minutes
  
  if (currentZoomLevel <= 0.5) {
    // Zoomed out: less dense ticks
    tickInterval = 300; // Every 5 minutes
    majorTickInterval = 900; // Every 15 minutes
  } else if (currentZoomLevel >= 4) {
    // Zoomed in: more dense ticks
    tickInterval = 30; // Every 30 seconds
    majorTickInterval = 300; // Every 5 minutes
  } else if (currentZoomLevel >= 2) {
    // Medium zoom in: moderate density
    tickInterval = 60; // Every minute
    majorTickInterval = 300; // Every 5 minutes
  }
  
  // Create ticks
  for (let s = 0; s <= MAX_SEC; s += tickInterval) {
    const x = s * PX_PER_SEC;
    const tick = document.createElement('div');
    const isMajor = (s % majorTickInterval === 0);
    
    tick.className = 'tick' + (isMajor ? ' major' : '');
    tick.style.left = x + 'px';
    
    // Add labels to major ticks or when zoomed in enough
    if (isMajor || (currentZoomLevel >= 2 && s % 60 === 0)) {
      const label = document.createElement('div');
      
      // Determine the display text and color based on the time period
      let labelText = '';
      let labelClass = '';
      
      if (s <= 2700) {
        // First half (0-45)
        const minutes = Math.floor(s / 60);
        labelText = currentZoomLevel >= 2 ? `${pad2(minutes)}:00` : `${minutes}'`;
        labelClass = 'gr';
      } else if (s <= FIRST_HALF_MAX) {
        // First half extra time (45+0 to 45+30)
        const extraMinutes = Math.floor((s - 2700) / 60);
        labelText = currentZoomLevel >= 2 ? `45+${extraMinutes}:00` : `45+${extraMinutes}'`;
        labelClass = 'et1';
      } else if (s <= FIRST_HALF_MAX + 2700) {
        // Second half (45-90)
        const totalMinutes = 45 + Math.floor((s - FIRST_HALF_MAX) / 60);
        labelText = currentZoomLevel >= 2 ? `${pad2(totalMinutes)}:00` : `${totalMinutes}'`;
        labelClass = 'pu';
      } else {
        // Second half extra time (90+0 to 90+∞)
        const extraMinutes = Math.floor((s - FIRST_HALF_MAX - 2700) / 60);
        labelText = currentZoomLevel >= 2 ? `90+${extraMinutes}:00` : `90+${extraMinutes}'`;
        labelClass = 'et2';
      }
      
      label.className = 'label ' + labelClass;
      label.textContent = labelText;
      tick.appendChild(label);
    }
    
    elements.ticks.appendChild(tick);
  }
}

/* === Rendering function === */

function render() {
  const containerWidth = elements.wrap.clientWidth;
  const left = containerWidth / 2 - (seekSecVal * PX_PER_SEC);
  
  elements.scale.style.transform = `translateX(${left}px)`;
  
  const pill = elements.barFieldPill;
  
  // Remove all period classes
  pill.classList.remove('h1', 'h2', 'et1', 'et2');
  
  const FIRST_HALF_MAX = 4500; // 75 minutes
  
  // Format field time display with extra time notation
  let displayText = '';
  
  if (seekSecVal <= 2700) {
    // First half (0-45:00)
    pill.classList.add('h1');
    displayText = fmtMMSS(seekSecVal);
  } else if (seekSecVal <= FIRST_HALF_MAX) {
    // First half extra time (45+0:01 to 45+30:00)
    pill.classList.add('et1');
    const extraTime = seekSecVal - 2700;
    const extraMinutes = Math.floor(extraTime / 60);
    const extraSeconds = Math.floor(extraTime % 60);
    displayText = `45+${extraMinutes}:${pad2(extraSeconds)}`;
  } else if (seekSecVal <= FIRST_HALF_MAX + 2700) {
    // Second half (45:01-90:00 equivalent)
    pill.classList.add('h2');
    const secondHalfTime = seekSecVal - FIRST_HALF_MAX;
    const totalMinutes = 45 + Math.floor(secondHalfTime / 60);
    const seconds = Math.floor(secondHalfTime % 60);
    displayText = `${pad2(totalMinutes)}:${pad2(seconds)}`;
  } else {
    // Second half extra time (90+0:01 to 90+∞)
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

/* === Interaction handlers === */

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pxToSec(px) {
  return px / PX_PER_SEC;
}

function addClickEffect(button) {
  button.style.transform = 'scale(0.95)';
  setTimeout(() => {
    button.style.transform = '';
  }, 150);
}

/* === Event Listeners === */

elements.playBtn.addEventListener('click', () => {
  addClickEffect(elements.playBtn);
  
  if (isAutoPlaying) {
    stopAutoPlay();
  } else {
    startAutoPlay();
  }
});

elements.liveBtn.addEventListener('click', () => {
  addClickEffect(elements.liveBtn);
  goToLiveTime();
});

// Zoom control event listeners
if (elements.zoomInBtn) {
  elements.zoomInBtn.addEventListener('click', () => {
    addClickEffect(elements.zoomInBtn);
    zoomIn();
  });
}

if (elements.zoomOutBtn) {
  elements.zoomOutBtn.addEventListener('click', () => {
    addClickEffect(elements.zoomOutBtn);
    zoomOut();
  });
}

if (elements.zoomResetBtn) {
  elements.zoomResetBtn.addEventListener('click', () => {
    addClickEffect(elements.zoomResetBtn);
    resetZoom();
  });
}

elements.wrap.addEventListener('pointerdown', e => {
  if (isAutoPlaying) {
    stopAutoPlay();
  }
  
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

elements.wrap.addEventListener('wheel', e => {
  e.preventDefault();
  
  if (isAutoPlaying) {
    stopAutoPlay();
  }
  
  const step = e.shiftKey ? 30 : 5;
  const direction = (e.deltaY > 0 || e.deltaX > 0) ? 1 : -1;
  seekSecVal = clamp(seekSecVal + direction * step, 0, MAX_SEC);
  render();
}, { passive: false });

window.addEventListener('keydown', e => {
  if (e.key === 'ArrowLeft') {
    if (isAutoPlaying) {
      stopAutoPlay();
    }
    seekSecVal = clamp(seekSecVal - (e.shiftKey ? 30 : 5), 0, MAX_SEC);
    render();
  }
  if (e.key === 'ArrowRight') {
    if (isAutoPlaying) {
      stopAutoPlay();
    }
    seekSecVal = clamp(seekSecVal + (e.shiftKey ? 30 : 5), 0, MAX_SEC);
    render();
  }
  if (e.key === ' ') {
    e.preventDefault();
    if (isAutoPlaying) {
      stopAutoPlay();
    } else {
      startAutoPlay();
    }
  }
  // Zoom shortcuts
  if (e.key === '=' || e.key === '+') {
    e.preventDefault();
    zoomIn();
  }
  if (e.key === '-') {
    e.preventDefault();
    zoomOut();
  }
  if (e.key === '0') {
    e.preventDefault();
    resetZoom();
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
  elements.bookmarkTime.textContent = formatTimeForPDF(seekSecVal);
  elements.bookmarkNote.value = '';
  elements.bookmarkDropdown.value = '';
  const yellowRadio = document.querySelector('input[name="eventType"][value="yellow"]');
  if (yellowRadio) yellowRadio.checked = true;
  
  // Update dropdown for default selection (yellow)
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

// Add quick buttons for extra time
const quick45plus5 = $('#quick45plus5');
const quick90plus5 = $('#quick90plus5');
const quick90plus10 = $('#quick90plus10');

if (quick45plus5) {
  quick45plus5.addEventListener('click', () => {
    addClickEffect(quick45plus5);
    // 45+5 = 2700 + 300 = 3000 seconds
    seekSecVal = 3000;
    render();
    closeSheet();
  });
}

if (quick90plus5) {
  quick90plus5.addEventListener('click', () => {
    addClickEffect(quick90plus5);
    // 90+5 = 4500 (first half max) + 2700 (second half) + 300 (5 minutes extra) = 7500 seconds  
    seekSecVal = 7500;
    render();
    closeSheet();
  });
}

if (quick90plus10) {
  quick90plus10.addEventListener('click', () => {
    addClickEffect(quick90plus10);
    // 90+10 = 4500 (first half max) + 2700 (second half) + 600 (10 minutes extra) = 7800 seconds  
    seekSecVal = 7800;
    render();
    closeSheet();
  });
}

/* === Bookmark event listeners === */

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
  const note = getCombinedNote(); // Use combined note from dropdown and text input
  
  const existingBookmark = getBookmarkAtTime(seekSecVal);
  if (existingBookmark) {
    if (!confirm('มีเหตุการณ์อยู่แล้วในเวลานี้ ต้องการเขียนทับหรือไม่?')) {
      return;
    }
    removeBookmark(existingBookmark.id);
  }
  
  addBookmark(seekSecVal, eventType, note);
  closeBookmarkSheet();
  
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

// Add event listener for event type changes
document.addEventListener('change', (e) => {
  if (e.target.name === 'eventType') {
    updateBookmarkDropdown(e.target.value);
  }
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

/* === Start time controls === */

function syncStarts() {
  start1Sec = getStart1Sec();
  start2Sec = getStart2Sec();
  saveStarts();
  render();
}

function syncStarts() {
  start1Sec = getStart1Sec();
  start2Sec = getStart2Sec();
  saveStarts();
  render();
}

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

/* === Initialization === */

function init() {
  fillSelect(elements.t1h, 23);
  fillSelect(elements.t2h, 23);
  fillSelect(elements.t1m, 59);
  fillSelect(elements.t2m, 59);
  
  fillSelect(elements.sheetMin, 150); // Extended to 150 minutes for unlimited extra time
  fillSelect(elements.sheetSec, 59);
  
  setupTeamNameListeners();
  
  const hadSavedTimes = loadStarts();
  const hadSavedTeams = loadTeamNames();
  
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
  
  buildTicks();
  syncStarts();
  
  const hadSavedPosition = loadSeekPosition();
  if (!hadSavedPosition) {
    seekSecVal = 0;
  }
  
  render();
  renderBookmarks();
  
  updateAutoStatus();
  updateZoomDisplay(); // Initialize zoom display
  
  if (hadSavedTimes || hadSavedPosition || bookmarks.length > 0 || hadSavedTeams) {
    const restoredItems = [];
    if (hadSavedTimes) restoredItems.push('เวลาเริ่มแมตช์');
    if (hadSavedPosition) restoredItems.push('ตำแหน่งเวลา');
    if (bookmarks.length > 0) restoredItems.push(`เหตุการณ์ ${bookmarks.length} รายการ`);
    if (hadSavedTeams) restoredItems.push('ชื่อทีม');
    
    const restoredFeedback = document.createElement('div');
    restoredFeedback.textContent = `✅ กู้คืนข้อมูล: ${restoredItems.join(', ')}`;
    restoredFeedback.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(76, 175, 80, 0.9);
      color: white;
      padding: 12px 24px;
      border-radius: 8px;
      font-weight: bold;
      z-index: 1000;
      animation: fadeInOut 3s ease-in-out;
      font-size: 14px;
    `;
    document.body.appendChild(restoredFeedback);
    setTimeout(() => {
      if (document.body.contains(restoredFeedback)) {
        document.body.removeChild(restoredFeedback);
      }
    }, 3000);
  }
}

window.addEventListener('resize', render);

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}

setInterval(() => {
  if (start1Sec !== null && start2Sec !== null) {
    const realSec = fieldToRealSec(seekSecVal);
    if (realSec !== null) {
      elements.barReal.textContent = secToHM(realSec);
    }
  }
}, 1000);