/* === Football Time Tuner JavaScript with Dual Timeline === */

// Configuration constants
const tz = 'Asia/Bangkok';
const MAX_SEC = 150 * 60; // 150 minutes (enough for very long extra time)
const BASE_PX_PER_SEC = 3; // Base pixels per second

// Zoom system - 3 levels: 1min, 5min, 10min
let currentZoomLevel = 0; // Index in ZOOM_LEVELS array
const ZOOM_LEVELS = [
  { name: '1min', tickInterval: 60, majorTickInterval: 300, pxPerSec: 3 },      // 1 minute ticks, 5 minute major
  { name: '5min', tickInterval: 300, majorTickInterval: 900, pxPerSec: 1.5 },   // 5 minute ticks, 15 minute major  
  { name: '10min', tickInterval: 600, majorTickInterval: 1800, pxPerSec: 0.75 } // 10 minute ticks, 30 minute major
];
let PX_PER_SEC = ZOOM_LEVELS[currentZoomLevel].pxPerSec; // Current pixels per second

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
  teamB: 'ftt_team_b',
  colorA: 'ftt_color_a',
  colorB: 'ftt_color_b',
  firstHalfEnd: 'ftt_first_half_end',
  secondHalfEnd: 'ftt_second_half_end'
};

// DOM Elements
const elements = {
  // Team inputs
  teamA: $('#teamA'),
  teamB: $('#teamB'),
  colorA: $('#colorA'),
  colorB: $('#colorB'),
  
  // Time inputs
  t1h: $('#t1h'),
  t1m: $('#t1m'),
  t2h: $('#t2h'),
  t2m: $('#t2m'),
  
  // Buttons
  t1now: $('#t1now'),
  t2now: $('#t2now'),
  
  // Half end controls
  endFirstHalf: $('#endFirstHalf'),
  endSecondHalf: $('#endSecondHalf'),
  resetFirstHalf: $('#resetFirstHalf'),
  resetSecondHalf: $('#resetSecondHalf'),
  firstHalfEndTime: $('#firstHalfEndTime'),
  secondHalfEndTime: $('#secondHalfEndTime'),
  
  // Auto-play controls
  playBtn: $('#playBtn'),
  liveBtn: $('#liveBtn'),
  autoStatus: $('#autoStatus'),
  
  // Zoom controls
  zoomIn: $('#zoomIn'),
  zoomOut: $('#zoomOut'), 
  zoomLevel: $('#zoomLevel'),
  
  // Tuner components
  wrap: $('#wrap'),
  scaleFirstHalf: $('#scaleFirstHalf'),
  scaleSecondHalf: $('#scaleSecondHalf'),
  ticksFirstHalf: $('#ticksFirstHalf'),
  ticksSecondHalf: $('#ticksSecondHalf'),
  bookmarksFirstHalf: $('#bookmarksFirstHalf'),
  bookmarksSecondHalf: $('#bookmarksSecondHalf'),
  needleFirstHalf: $('#needleFirstHalf'),
  needleSecondHalf: $('#needleSecondHalf'),
  
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
let firstHalfEndSec = null; // เวลาจบครึ่งแรก (field time)
let secondHalfEndSec = null; // เวลาจบครึ่งหลัง (field time)
let seekSecVal = 0; // Current seek position (0-9000 seconds)
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

// Event type configurations with team dropdown options
const EVENT_TYPES = {
  
  yellow: { 
    icon: '🟨', 
    name: 'ใบเหลือง', 
    class: 'yellow',
    teamOptions: true
  },
  secondYellow: { 
    icon: '🟨²🟥', 
    name: 'ใบเหลืองที่2', 
    class: 'secondYellow',
    teamOptions: true
  },
  red: { 
    icon: '🟥', 
    name: 'ใบแดง', 
    class: 'red',
    teamOptions: true
  },
  penalty: { 
    icon: '🔴', 
    name: 'จุดโทษ', 
    class: 'penalty',
    teamOptions: true
  },
  goal: { 
    icon: '⚽', 
    name: 'ประตู', 
    class: 'goal',
    teamOptions: true
  },
  substitution: { 
    icon: '🔄', 
    name: 'เปลี่ยนตัว', 
    class: 'substitution',
    teamOptions: true
  },
  important: { 
    icon: '⭐', 
    name: 'เหตุการณ์สำคัญ', 
    class: 'important',
    importantOptions: true
  },
  custom: { icon: '📝', name: 'กำหนดเอง', class: 'custom' }
};

/* === PDF Export Functions === */

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

function getMatchTitle() {
  const { teamA, teamB } = getTeamNames();
  return `${teamA} VS ${teamB}`;
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
  const matchTitle = getMatchTitle();
  
  return {
    matchTitle,
    matchDate,
    firstHalfStart,
    secondHalfStart,
    firstHalfEnd: firstHalfEndSec ? formatTimeForPDF(firstHalfEndSec) : 'ยังไม่กำหนด',
    secondHalfEnd: secondHalfEndSec ? formatTimeForPDF(secondHalfEndSec) : 'ยังไม่กำหนด',
    totalEvents: bookmarks.length,
    statsByType,
    currentPosition: formatTimeForPDF(seekSecVal),
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

    // Ensure team names are saved
    const teamAEl = document.querySelector('#teamA');
    const teamBEl = document.querySelector('#teamB');
    if (teamAEl && teamAEl.value.trim()) {
      localStorage.setItem(LS_KEYS.teamA, teamAEl.value.trim());
    }
    if (teamBEl && teamBEl.value.trim()) {
      localStorage.setItem(LS_KEYS.teamB, teamBEl.value.trim());
    }

    const loaded = await loadPDFLibraries();
    if (!loaded) return;

    loadingEl = createLoadingIndicator('กำลังสร้าง PDF หลายหน้า...');

    const stats = generateMatchStats();
    await createPDFReport(stats, loadingEl);
    
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

async function createPDFReport(stats, loadingEl) {
  const pdf = new jsPDF('p', 'mm', 'a4');
  let currentPage = 1;
  
  updateLoadingMessage(loadingEl, 'กำลังสร้างหน้าที่ 1...');
  
  // Create summary page
  await addSummaryPageToPDF(pdf, stats);
  
  // Create events pages if there are bookmarks
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
      await addEventsPageToPDF(pdf, pageBookmarks, page + 1, totalPages, stats);
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
    position: absolute;
    top: -10000px;
    left: -10000px;
    width: 210mm;
    height: 297mm;
    background: white;
    padding: 15mm;
    box-sizing: border-box;
    font-family: 'Sarabun', 'Noto Sans Thai', 'Kanit', sans-serif;
  `;
  
  container.innerHTML = htmlContent;
  
  // Add Google Fonts for Thai support
  const fontLink = document.createElement('link');
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Sarabun:wght@300;400;700&family=Noto+Sans+Thai:wght@300;400;700&family=Kanit:wght@300;400;700&display=swap';
  fontLink.rel = 'stylesheet';
  document.head.appendChild(fontLink);
  
  document.body.appendChild(container);
  
  // Wait for fonts to load
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  try {
    const canvas = await html2canvas(container, {
      width: 794,  // A4 width in pixels at 96 DPI
      height: 1123, // A4 height in pixels at 96 DPI
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      fontEmbedded: true
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
    <div style="
      font-family: 'Sarabun', 'Noto Sans Thai', 'Kanit', sans-serif;
      color: #333;
      line-height: 1.6;
      height: 267mm;
      overflow: hidden;
      padding: 10mm;
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
            <div style="font-size: 36px; font-weight: bold; color: #2e7d32;">
              ${stats.totalEvents}
            </div>
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
        <p style="color: #666; font-size: 14px; margin-bottom: 15px;">
          แสดงเหตุการณ์ทั้งหมด ${bookmarks.length} รายการ (ต่อในหน้าถัดไป)
        </p>
        <div style="background: #f0f8ff; padding: 15px; border-radius: 8px; border-left: 4px solid #2196f3;">
          <p style="margin: 0; color: #1565c0; font-weight: bold; font-size: 14px;">
            📋 รายละเอียดเหตุการณ์แยกตามหน้า ${Math.ceil(bookmarks.length / 15)} หน้า
          </p>
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
    <div style="
      font-family: 'Sarabun', 'Noto Sans Thai', 'Kanit', sans-serif;
      color: #333;
      line-height: 1.6;
      height: 267mm;
      overflow: hidden;
      padding: 10mm;
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
        <table style="width: 100%; border-collapse: collapse; font-size: 14px; background: white; border: 1px solid #ddd;">
          <thead>
            <tr style="background: #4caf50; color: white;">
              <th style="padding: 15px 8px; text-align: center; font-size: 16px; font-weight: bold;">ไอคอน</th>
              <th style="padding: 15px 8px; text-align: center; font-size: 16px; font-weight: bold;">เวลา</th>
              <th style="padding: 15px 8px; text-align: center; font-size: 16px; font-weight: bold;">ประเภท</th>
              <th style="padding: 15px 8px; text-align: center; font-size: 16px; font-weight: bold;">หมายเหตุ</th>
            </tr>
          </thead>
          <tbody>
            ${eventsHtml}
          </tbody>
        </table>
      </div>

      <div style="position: absolute; bottom: 10mm; left: 0; right: 0; text-align: center; padding-top: 20px; border-top: 1px solid #ddd; color: #666; font-size: 12px;">
        สร้างโดย Football Time Tuner | หน้า ${pageNumber + 1} | ${stats.exportTime}
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

function formatTimeForPDF(timeInSeconds) {
  const FIRST_HALF_MAX = getFirstHalfMaxSec();
  
  if (timeInSeconds <= 2700) {
    // First half (0-45:00)
    return fmtMMSS(timeInSeconds);
  } else if (timeInSeconds <= FIRST_HALF_MAX) {
    // First half extra time (45+0:01 to 45+end)
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

// Get current team names from inputs or localStorage
function getTeamNames() {
  let teamA = '';
  let teamB = '';
  
  // Try to get from DOM first
  const teamAEl = document.querySelector('#teamA');
  const teamBEl = document.querySelector('#teamB');
  
  if (teamAEl && teamAEl.value.trim()) {
    teamA = teamAEl.value.trim();
  }
  if (teamBEl && teamBEl.value.trim()) {
    teamB = teamBEl.value.trim();
  }
  
  // If not in DOM, try localStorage
  if (!teamA) {
    try {
      const savedTeamA = localStorage.getItem(LS_KEYS.teamA);
      if (savedTeamA) teamA = savedTeamA.trim();
    } catch (e) {
      console.warn('Error reading teamA from localStorage:', e);
    }
  }
  
  if (!teamB) {
    try {
      const savedTeamB = localStorage.getItem(LS_KEYS.teamB);
      if (savedTeamB) teamB = savedTeamB.trim();
    } catch (e) {
      console.warn('Error reading teamB from localStorage:', e);
    }
  }
  
  // Fallback to default names
  if (!teamA) teamA = 'ทีมเจ้าบ้าน';
  if (!teamB) teamB = 'ทีมเยือน';
  
  return { teamA, teamB };
}

// Update bookmark dropdown based on selected event type
function updateBookmarkDropdown(eventType) {
  const dropdown = elements.bookmarkDropdown;
  const noteInput = elements.bookmarkNote;
  const eventConfig = EVENT_TYPES[eventType];
  
  // Remove existing event listeners to prevent duplicates
  const newDropdown = dropdown.cloneNode(false);
  dropdown.parentNode.replaceChild(newDropdown, dropdown);
  elements.bookmarkDropdown = newDropdown;
  
  if (eventConfig.teamOptions) {
    // Show dropdown with actual team names and colors
    const { teamA, teamB } = getTeamNames();
    const { colorA, colorB } = getTeamColors();
    
    newDropdown.innerHTML = '<option value="">เลือกทีม</option>';
    
    // Add Team A option with color
    const optionA = document.createElement('option');
    optionA.value = teamA;
    optionA.textContent = `🏠 ${teamA}`;
    optionA.style.color = colorA;
    optionA.style.fontWeight = 'bold';
    optionA.dataset.teamColor = colorA;
    newDropdown.appendChild(optionA);
    
    // Add Team B option with color
    const optionB = document.createElement('option');
    optionB.value = teamB;
    optionB.textContent = `🚌 ${teamB}`;
    optionB.style.color = colorB;
    optionB.style.fontWeight = 'bold';
    optionB.dataset.teamColor = colorB;
    newDropdown.appendChild(optionB);
    
    newDropdown.style.display = 'block';
    noteInput.placeholder = 'หมายเหตุเพิ่มเติม (ไม่บังคับ)';
    
    // Update dropdown style when selection changes
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
    
  } else if (eventConfig.scoreOptions) {
    // Show dropdown with score options
    newDropdown.innerHTML = '<option value="">เลือกสกอร์</option>';
    generateScoreOptions().forEach(score => {
      const option = document.createElement('option');
      option.value = score;
      option.textContent = score;
      newDropdown.appendChild(option);
    });
    newDropdown.style.display = 'block';
    noteInput.placeholder = 'หมายเหตุเพิ่มเติม (ไม่บังคับ)';
  } else if (eventConfig.importantOptions) {
    // Show dropdown with important event options
    newDropdown.innerHTML = '<option value="">เลือกประเภท</option>';
    generateImportantOptions().forEach(option => {
      const optionEl = document.createElement('option');
      optionEl.value = option;
      optionEl.textContent = option;
      newDropdown.appendChild(optionEl);
    });
    newDropdown.style.display = 'block';
    noteInput.placeholder = 'หมายเหตุเพิ่มเติม (ไม่บังคับ)';
  } else {
    // Hide dropdown for other event types
    newDropdown.style.display = 'none';
    noteInput.placeholder = 'หมายเหตุ (ไม่บังคับ)';
  }
  
  // Reset dropdown value and style
  newDropdown.value = '';
  newDropdown.style.color = '#fff';
  newDropdown.style.fontWeight = 'normal';
  newDropdown.style.background = 'rgba(0, 0, 0, 0.3)';
  newDropdown.style.borderColor = 'rgba(255, 255, 255, 0.2)';
}

// Get combined note from dropdown and text input with team color indicator
function getCombinedNote() {
  const dropdown = elements.bookmarkDropdown || document.querySelector('#bookmarkDropdown');
  const dropdownValue = dropdown.value;
  const noteValue = elements.bookmarkNote.value.trim();
  
  // Get selected option to check for team color
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
  
  // Add color metadata if team is selected
  if (teamColor && dropdownValue) {
    combinedNote = {
      text: combinedNote,
      teamColor: teamColor,
      teamName: dropdownValue
    };
  }
  
  return combinedNote;
}

/* === Team Color Management Functions === */

// Default team colors
const DEFAULT_COLORS = {
  teamA: '#4caf50',
  teamB: '#8bc34a'
};

// Get current team colors from inputs or localStorage
function getTeamColors() {
  let colorA = DEFAULT_COLORS.teamA;
  let colorB = DEFAULT_COLORS.teamB;
  
  // Try to get from DOM first
  const colorAEl = document.querySelector('#colorA');
  const colorBEl = document.querySelector('#colorB');
  
  if (colorAEl && colorAEl.value) {
    colorA = colorAEl.value;
  }
  if (colorBEl && colorBEl.value) {
    colorB = colorBEl.value;
  }
  
  // If not in DOM, try localStorage
  try {
    const savedColorA = localStorage.getItem(LS_KEYS.colorA);
    const savedColorB = localStorage.getItem(LS_KEYS.colorB);
    
    if (savedColorA && !colorAEl?.value) colorA = savedColorA;
    if (savedColorB && !colorBEl?.value) colorB = savedColorB;
  } catch (e) {
    console.warn('Error reading colors from localStorage:', e);
  }
  
  return { colorA, colorB };
}

// Save team colors to localStorage
function saveTeamColors() {
  try {
    const colorAEl = document.querySelector('#colorA');
    const colorBEl = document.querySelector('#colorB');
    
    if (colorAEl) {
      localStorage.setItem(LS_KEYS.colorA, colorAEl.value);
    }
    
    if (colorBEl) {
      localStorage.setItem(LS_KEYS.colorB, colorBEl.value);
    }
  } catch (e) {
    console.warn('Could not save team colors:', e);
  }
}

// Load team colors from localStorage
function loadTeamColors() {
  try {
    const colorA = localStorage.getItem(LS_KEYS.colorA);
    const colorB = localStorage.getItem(LS_KEYS.colorB);
    
    const colorAEl = document.querySelector('#colorA');
    const colorBEl = document.querySelector('#colorB');
    
    if (colorA && colorAEl) {
      colorAEl.value = colorA;
    }
    
    if (colorB && colorBEl) {
      colorBEl.value = colorB;
    }
    
    const hasColors = colorA && colorB;
    return hasColors;
  } catch (e) {
    console.warn('Could not load team colors:', e);
    return false;
  }
}

// Update CSS custom properties with team colors
function updateTeamColorsInCSS() {
  const colors = getTeamColors();
  
  // Update CSS custom properties
  document.documentElement.style.setProperty('--team-a-color', colors.colorA);
  document.documentElement.style.setProperty('--team-b-color', colors.colorB);
  
  // Update half colors to use team colors
  document.documentElement.style.setProperty('--half1', colors.colorA);
  document.documentElement.style.setProperty('--half2', colors.colorB);
  
  // Create lighter versions for backgrounds
  const colorALight = hexToRgba(colors.colorA, 0.2);
  const colorBLight = hexToRgba(colors.colorB, 0.2);
  
  document.documentElement.style.setProperty('--team-a-light', colorALight);
  document.documentElement.style.setProperty('--team-b-light', colorBLight);
  
  // Update VS divider gradient with team colors
  const vsDiv = document.querySelector('.vs-divider');
  if (vsDiv) {
    vsDiv.style.background = `linear-gradient(135deg, ${colors.colorA}, ${colors.colorB})`;
  }
}

// Convert hex color to rgba with opacity
function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Handle color preset button clicks
function handleColorPreset(presetButton, colorInput) {
  const color = presetButton.dataset.color;
  colorInput.value = color;
  
  // Update selected state
  const presets = presetButton.parentElement.querySelectorAll('.color-preset');
  presets.forEach(p => p.classList.remove('selected'));
  presetButton.classList.add('selected');
  
  // Trigger change event
  colorInput.dispatchEvent(new Event('change'));
}

// Update preset button selection based on current color
function updatePresetSelection(colorInput) {
  const currentColor = colorInput.value.toLowerCase();
  const presets = colorInput.parentElement.querySelectorAll('.color-preset');
  
  presets.forEach(preset => {
    const presetColor = preset.dataset.color.toLowerCase();
    if (presetColor === currentColor) {
      preset.classList.add('selected');
    } else {
      preset.classList.remove('selected');
    }
  });
}

// Setup color input event listeners
function setupColorListeners() {
  const colorAEl = document.querySelector('#colorA');
  const colorBEl = document.querySelector('#colorB');
  
  // Color input change handlers
  [colorAEl, colorBEl].forEach(colorEl => {
    if (colorEl) {
      colorEl.addEventListener('change', () => {
        saveTeamColors();
        updateTeamColorsInCSS();
        updatePresetSelection(colorEl);
        
        // Show color change feedback
        const colors = getTeamColors();
        const teamName = colorEl.id === 'colorA' ? 'ทีมเจ้าบ้าน' : 'ทีมเยือน';
        showColorChangeFeedback(teamName, colorEl.value);
      });
      
      colorEl.addEventListener('input', () => {
        updateTeamColorsInCSS();
      });
    }
  });
  
  // Color preset button handlers
  document.querySelectorAll('.color-preset').forEach(preset => {
    preset.addEventListener('click', () => {
      const colorSelector = preset.closest('.color-selector');
      const colorInput = colorSelector.querySelector('.color-input');
      handleColorPreset(preset, colorInput);
    });
  });
}

// Show feedback when color changes
function showColorChangeFeedback(teamName, color) {
  const feedback = document.createElement('div');
  feedback.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px;">
      <div style="width: 20px; height: 20px; background: ${color}; border-radius: 50%; border: 2px solid white;"></div>
      <span>🎨 เปลี่ยนสี${teamName}แล้ว</span>
    </div>
  `;
  feedback.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(76, 175, 80, 0.9);
    color: white;
    padding: 12px 20px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 1000;
    animation: fadeInOut 2s ease-in-out;
    font-size: 14px;
  `;
  document.body.appendChild(feedback);
  setTimeout(() => {
    if (document.body.contains(feedback)) {
      document.body.removeChild(feedback);
    }
  }, 2000);
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

/* === Zoom Functions === */

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

function updateZoom() {
  PX_PER_SEC = ZOOM_LEVELS[currentZoomLevel].pxPerSec;
  
  // Update zoom display
  elements.zoomLevel.textContent = ZOOM_LEVELS[currentZoomLevel].name;
  
  // Enable/disable zoom buttons
  elements.zoomOut.disabled = (currentZoomLevel === 0);
  elements.zoomIn.disabled = (currentZoomLevel === ZOOM_LEVELS.length - 1);
  
  // Rebuild ticks with new zoom level
  buildTicks();
  
  // Re-render bookmarks with new scale
  renderBookmarks();
  
  // Re-render current position
  render();
  
  // Show zoom feedback
  const zoomFeedback = document.createElement('div');
  zoomFeedback.textContent = `🔍 ซูมเป็น ${ZOOM_LEVELS[currentZoomLevel].name}`;
  zoomFeedback.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(33, 150, 243, 0.9);
    color: white;
    padding: 10px 20px;
    border-radius: 6px;
    font-weight: bold;
    z-index: 1000;
    animation: fadeInOut 1.5s ease-in-out;
    font-size: 14px;
  `;
  document.body.appendChild(zoomFeedback);
  setTimeout(() => {
    if (document.body.contains(zoomFeedback)) {
      document.body.removeChild(zoomFeedback);
    }
  }, 1500);
}

/* === Half End Management === */

function endFirstHalf() {
  firstHalfEndSec = seekSecVal;
  saveHalfEndTimes();
  updateHalfEndDisplay();
  
  // Show feedback
  const feedback = document.createElement('div');
  feedback.textContent = `⏹️ จบครึ่งแรกที่ ${formatTimeForPDF(firstHalfEndSec)}`;
  feedback.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: rgba(255, 152, 0, 0.9);
    color: white;
    padding: 12px 24px;
    border-radius: 8px;
    font-weight: bold;
    z-index: 1000;
    animation: fadeInOut 3s ease-in-out;
  `;
  document.body.appendChild(feedback);
  setTimeout(() => {
    if (document.body.contains(feedback)) {
      document.body.removeChild(feedback);
    }
  }, 3000);
  
  // Rebuild ticks and bookmarks with new timeline
  buildTicks();
  renderBookmarks();
}

function endSecondHalf() {
  secondHalfEndSec = seekSecVal;
  saveHalfEndTimes();
  updateHalfEndDisplay();
  
  // Show feedback
  const feedback = document.createElement('div');
  feedback.textContent = `🏆 จบเกมที่ ${formatTimeForPDF(secondHalfEndSec)}`;
  feedback.style.cssText = `
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
  document.body.appendChild(feedback);
  setTimeout(() => {
    if (document.body.contains(feedback)) {
      document.body.removeChild(feedback);
    }
  }, 3000);
  
  // Stop auto-play if running
  if (isAutoPlaying) {
    stopAutoPlay();
  }
}

function updateHalfEndDisplay() {
  // Update first half end display
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
  
  // Update second half end display
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
    
    // Remove from localStorage
    try {
      localStorage.removeItem(LS_KEYS.firstHalfEnd);
    } catch (e) {
      console.warn('Could not remove first half end time:', e);
    }
    
    updateHalfEndDisplay();
    
    // Show feedback
    const feedback = document.createElement('div');
    feedback.textContent = '🔄 รีเซ็ตเวลาจบครึ่งแรกแล้ว';
    feedback.style.cssText = `
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
    document.body.appendChild(feedback);
    setTimeout(() => {
      if (document.body.contains(feedback)) {
        document.body.removeChild(feedback);
      }
    }, 2000);
    
    // Rebuild ticks and bookmarks
    buildTicks();
    renderBookmarks();
    render();
  }
}

function resetSecondHalf() {
  if (confirm('ต้องการรีเซ็ตเวลาจบเกมหรือไม่?')) {
    secondHalfEndSec = null;
    
    // Remove from localStorage
    try {
      localStorage.removeItem(LS_KEYS.secondHalfEnd);
    } catch (e) {
      console.warn('Could not remove second half end time:', e);
    }
    
    updateHalfEndDisplay();
    
    // Show feedback
    const feedback = document.createElement('div');
    feedback.textContent = '🔄 รีเซ็ตเวลาจบเกมแล้ว';
    feedback.style.cssText = `
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
    document.body.appendChild(feedback);
    setTimeout(() => {
      if (document.body.contains(feedback)) {
        document.body.removeChild(feedback);
      }
    }, 2000);
    
    // Rebuild ticks and bookmarks
    buildTicks();
    renderBookmarks();
    render();
  }
}

function saveHalfEndTimes() {
  try {
    if (firstHalfEndSec !== null) {
      localStorage.setItem(LS_KEYS.firstHalfEnd, String(firstHalfEndSec));
    }
    if (secondHalfEndSec !== null) {
      localStorage.setItem(LS_KEYS.secondHalfEnd, String(secondHalfEndSec));
    }
  } catch (e) {
    console.warn('Could not save half end times:', e);
  }
}

function loadHalfEndTimes() {
  try {
    const firstEnd = localStorage.getItem(LS_KEYS.firstHalfEnd);
    const secondEnd = localStorage.getItem(LS_KEYS.secondHalfEnd);
    
    if (firstEnd !== null) {
      firstHalfEndSec = parseInt(firstEnd, 10);
    }
    if (secondEnd !== null) {
      secondHalfEndSec = parseInt(secondEnd, 10);
    }
    
    updateHalfEndDisplay();
    return (firstEnd !== null || secondEnd !== null);
  } catch (e) {
    console.warn('Could not load half end times:', e);
    return false;
  }
}

function getFirstHalfMaxSec() {
  // ถ้ากำหนดเวลาจบครึ่งแรกแล้ว ใช้เวลานั้น
  // ถ้าไม่ใช้ default 75 นาที (4500 วินาที)
  return firstHalfEndSec !== null ? firstHalfEndSec : 4500;
}

/* === Field time <-> Real time conversion === */

function fieldToRealSec(fieldSec) {
  if (start1Sec == null || start2Sec == null) return null;
  
  const FIRST_HALF_MAX = getFirstHalfMaxSec();
  
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
  
  const FIRST_HALF_MAX = getFirstHalfMaxSec();
  
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

/* === Bookmark management functions === */

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
  // Handle note object with team color
  let noteText = '';
  let teamColor = null;
  let teamName = null;
  
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
  const FIRST_HALF_MAX = getFirstHalfMaxSec();
  const totalWidth = FIRST_HALF_MAX * PX_PER_SEC;
  
  // Clear both timeline bookmarks
  elements.bookmarksFirstHalf.style.width = totalWidth + 'px';
  elements.bookmarksFirstHalf.innerHTML = '';
  elements.bookmarksSecondHalf.style.width = totalWidth + 'px';
  elements.bookmarksSecondHalf.innerHTML = '';
  
  bookmarks.forEach(bookmark => {
    const marker = document.createElement('div');
    marker.className = `bookmark-marker ${EVENT_TYPES[bookmark.type].class}`;
    marker.innerHTML = EVENT_TYPES[bookmark.type].icon;
    
    // Add team color border if available
    if (bookmark.teamColor) {
      marker.style.borderColor = bookmark.teamColor;
      marker.style.boxShadow = `0 0 12px ${bookmark.teamColor}40`;
      marker.classList.add('team-colored');
    }
    
    // Enhanced tooltip with team info
    let tooltipText = `${formatTimeForPDF(bookmark.time)} - ${EVENT_TYPES[bookmark.type].name}`;
    if (bookmark.teamName) {
      tooltipText += ` (${bookmark.teamName})`;
    }
    if (bookmark.note) {
      tooltipText += `: ${bookmark.note}`;
    }
    marker.title = tooltipText;
    
    marker.addEventListener('click', () => {
      addClickEffect(marker);
      seekToTime(bookmark.time);
    });
    
    if (bookmark.time <= FIRST_HALF_MAX) {
      // First half timeline
      const x = bookmark.time * PX_PER_SEC;
      marker.style.left = (x - 12) + 'px';
      marker.style.top = '33px';
      elements.bookmarksFirstHalf.appendChild(marker);
    } else {
      // Second half timeline
      const secondHalfTime = bookmark.time - FIRST_HALF_MAX;
      const x = secondHalfTime * PX_PER_SEC;
      marker.style.left = (x - 12) + 'px';
      marker.style.top = '33px';
      elements.bookmarksSecondHalf.appendChild(marker);
    }
  });
}

function renderBookmarkList() {
  if (!elements.bookmarkList) return;
  
  if (bookmarks.length === 0) {
    elements.bookmarkList.innerHTML = '<div class="bookmark-empty">ยังไม่มีเหตุการณ์ที่บันทึกไว้</div>';
    return;
  }
  
  elements.bookmarkList.innerHTML = bookmarks.map(bookmark => {
    // Create team color indicator if available
    let teamColorIndicator = '';
    if (bookmark.teamColor && bookmark.teamName) {
      teamColorIndicator = `<div class="team-color-indicator" style="background: ${bookmark.teamColor};" title="${bookmark.teamName}"></div>`;
    }
    
    // Style bookmark note with team color
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
    
    // Also save colors when saving team names
    saveTeamColors();
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
    
    // Also load colors
    const hasColors = loadTeamColors();
    
    return hasTeamNames;
  } catch (e) {
    console.warn('Could not load team names:', e);
    return false;
  }
}

function setupTeamNameListeners() {
  const teamAEl = document.querySelector('#teamA');
  const teamBEl = document.querySelector('#teamB');
  
  if (teamAEl) {
    teamAEl.addEventListener('input', () => {
      saveTeamNames();
      // Update bookmark dropdown if it's currently showing team options
      const bookmarkSheet = elements.bookmarkSheet;
      if (bookmarkSheet && bookmarkSheet.classList.contains('open')) {
        const checkedRadio = document.querySelector('input[name="eventType"]:checked');
        if (checkedRadio && EVENT_TYPES[checkedRadio.value]?.teamOptions) {
          updateBookmarkDropdown(checkedRadio.value);
        }
      }
    });
    teamAEl.addEventListener('blur', saveTeamNames);
    teamAEl.addEventListener('change', saveTeamNames);
  }
  
  if (teamBEl) {
    teamBEl.addEventListener('input', () => {
      saveTeamNames();
      // Update bookmark dropdown if it's currently showing team options
      const bookmarkSheet = elements.bookmarkSheet;
      if (bookmarkSheet && bookmarkSheet.classList.contains('open')) {
        const checkedRadio = document.querySelector('input[name="eventType"]:checked');
        if (checkedRadio && EVENT_TYPES[checkedRadio.value]?.teamOptions) {
          updateBookmarkDropdown(checkedRadio.value);
        }
      }
    });
    teamBEl.addEventListener('blur', saveTeamNames);
    teamBEl.addEventListener('change', saveTeamNames);
  }
  
  // Setup color listeners as well
  setupColorListeners();
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
  
  // Create ticks for first half using current zoom level
  for (let s = 0; s <= FIRST_HALF_MAX; s += currentZoom.tickInterval) {
    const x = s * PX_PER_SEC;
    const tick = document.createElement('div');
    const isMajor = (s % currentZoom.majorTickInterval === 0);
    
    tick.className = 'tick' + (isMajor ? ' major' : '');
    tick.style.left = x + 'px';
    
    // Add label to every tick
    const label = document.createElement('div');
    let labelText = '';
    let labelClass = '';
    
    if (s <= 2700) {
      const minutes = Math.floor(s / 60);
      labelText = `${minutes}'`;
      labelClass = 'gr';
    } else {
      const extraMinutes = Math.floor((s - 2700) / 60);
      labelText = `45+${extraMinutes}'`;
      labelClass = 'et1';
    }
    
    label.className = 'label ' + labelClass + (isMajor ? ' major-label' : ' minor-label');
    label.textContent = labelText;
    tick.appendChild(label);
    
    elements.ticksFirstHalf.appendChild(tick);
  }
  
  // Create ticks for second half using current zoom level
  for (let s = 0; s <= FIRST_HALF_MAX; s += currentZoom.tickInterval) {
    const x = s * PX_PER_SEC;
    const tick = document.createElement('div');
    const isMajor = (s % currentZoom.majorTickInterval === 0);
    
    tick.className = 'tick' + (isMajor ? ' major' : '');
    tick.style.left = x + 'px';
    
    // Add label to every tick
    const label = document.createElement('div');
    let labelText = '';
    let labelClass = '';
    
    if (s <= 2700) {
      const minutes = 45 + Math.floor(s / 60);
      labelText = `${minutes}'`;
      labelClass = 'pu';
    } else {
      const extraMinutes = Math.floor((s - 2700) / 60);
      labelText = `90+${extraMinutes}'`;
      labelClass = 'et2';
    }
    
    label.className = 'label ' + labelClass + (isMajor ? ' major-label' : ' minor-label');
    label.textContent = labelText;
    tick.appendChild(label);
    
    elements.ticksSecondHalf.appendChild(tick);
  }
}

/* === Rendering function === */

function render() {
  const FIRST_HALF_MAX = getFirstHalfMaxSec();
  const containerWidth = elements.wrap.clientWidth;
  
  // Determine which half we're in
  const isFirstHalf = seekSecVal <= FIRST_HALF_MAX;
  const isSecondHalf = seekSecVal > FIRST_HALF_MAX;
  
  if (isFirstHalf) {
    // First half positioning
    const left = containerWidth / 2 - (seekSecVal * PX_PER_SEC);
    elements.scaleFirstHalf.style.transform = `translateX(${left}px)`;
    elements.scaleSecondHalf.style.transform = `translateX(${containerWidth / 2}px)`; // Reset second half
    
    // Update needle visibility
    elements.needleFirstHalf.classList.add('active');
    elements.needleFirstHalf.classList.remove('inactive');
    elements.needleSecondHalf.classList.add('inactive');
    elements.needleSecondHalf.classList.remove('active');
  } else {
    // Second half positioning
    const secondHalfTime = seekSecVal - FIRST_HALF_MAX;
    const left = containerWidth / 2 - (secondHalfTime * PX_PER_SEC);
    elements.scaleSecondHalf.style.transform = `translateX(${left}px)`;
    elements.scaleFirstHalf.style.transform = `translateX(${containerWidth / 2 - FIRST_HALF_MAX * PX_PER_SEC}px)`; // Show end of first half
    
    // Update needle visibility
    elements.needleSecondHalf.classList.add('active');
    elements.needleSecondHalf.classList.remove('inactive');
    elements.needleFirstHalf.classList.add('inactive');
    elements.needleFirstHalf.classList.remove('active');
  }
  
  // Update pill styling and display text
  const pill = elements.barFieldPill;
  pill.classList.remove('h1', 'h2', 'et1', 'et2');
  
  let displayText = '';
  
  if (seekSecVal <= 2700) {
    // First half (0-45:00)
    pill.classList.add('h1');
    displayText = fmtMMSS(seekSecVal);
  } else if (seekSecVal <= FIRST_HALF_MAX) {
    // First half extra time (45+0:01 to 45+end)
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

// Zoom controls
elements.zoomIn.addEventListener('click', () => {
  addClickEffect(elements.zoomIn);
  zoomIn();
});

elements.zoomOut.addEventListener('click', () => {
  addClickEffect(elements.zoomOut);
  zoomOut();
});

// Updated drag handling for dual timeline
elements.wrap.addEventListener('pointerdown', e => {
  if (isAutoPlaying) {
    stopAutoPlay();
  }
  
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
  
  if (isAutoPlaying) {
    stopAutoPlay();
  }
  
  const step = e.shiftKey ? 30 : 5;
  const direction = (e.deltaY > 0 || e.deltaX > 0) ? 1 : -1;
  seekSecVal = clamp(seekSecVal + direction * step, 0, MAX_SEC);
  render();
}, { passive: false });

window.addEventListener('keydown', e => {
  // Check if user is typing in an input field - if so, don't trigger shortcuts
  const activeElement = document.activeElement;
  const isTyping = activeElement && (
    activeElement.tagName === 'INPUT' || 
    activeElement.tagName === 'TEXTAREA' || 
    activeElement.tagName === 'SELECT' ||
    activeElement.contentEditable === 'true'
  );
  
  // Only trigger keyboard shortcuts if user is not typing
  if (!isTyping) {
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
    // Zoom keyboard shortcuts
    if (e.key === '+' || e.key === '=') {
      e.preventDefault();
      zoomIn();
    }
    if (e.key === '-' || e.key === '_') {
      e.preventDefault();
      zoomOut();
    }
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

/* === Half End Event Listeners === */

elements.endFirstHalf.addEventListener('click', () => {
  addClickEffect(elements.endFirstHalf);
  if (firstHalfEndSec === null) {
    endFirstHalf();
  }
});

elements.endSecondHalf.addEventListener('click', () => {
  addClickEffect(elements.endSecondHalf);
  if (secondHalfEndSec === null) {
    endSecondHalf();
  }
});

elements.resetFirstHalf.addEventListener('click', () => {
  addClickEffect(elements.resetFirstHalf);
  resetFirstHalf();
});

elements.resetSecondHalf.addEventListener('click', () => {
  addClickEffect(elements.resetSecondHalf);
  resetSecondHalf();
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
  const hadSavedHalfEnds = loadHalfEndTimes();
  
  // Initialize team colors
  updateTeamColorsInCSS();
  
  // Update preset selections based on current colors
  const colorAEl = document.querySelector('#colorA');
  const colorBEl = document.querySelector('#colorB');
  if (colorAEl) updatePresetSelection(colorAEl);
  if (colorBEl) updatePresetSelection(colorBEl);
  
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
  
  // Initialize zoom controls
  updateZoom();
  
  buildTicks();
  syncStarts();
  
  const hadSavedPosition = loadSeekPosition();
  if (!hadSavedPosition) {
    seekSecVal = 0;
  }
  
  render();
  renderBookmarks();
  
  updateAutoStatus();
  
  const hadSavedColors = loadTeamColors();
  
  if (hadSavedTimes || hadSavedPosition || bookmarks.length > 0 || hadSavedTeams || hadSavedHalfEnds || hadSavedColors) {
    const restoredItems = [];
    if (hadSavedTimes) restoredItems.push('เวลาเริ่มแมตช์');
    if (hadSavedPosition) restoredItems.push('ตำแหน่งเวลา');
    if (bookmarks.length > 0) restoredItems.push(`เหตุการณ์ ${bookmarks.length} รายการ`);
    if (hadSavedTeams) restoredItems.push('ชื่อทีม');
    if (hadSavedColors) restoredItems.push('สีทีม');
    if (hadSavedHalfEnds) restoredItems.push('เวลาจบครึ่ง');
    
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
