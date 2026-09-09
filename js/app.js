// Main Client JS Application for SofiaRizqi Homestay

const API_BASE = window.location.protocol.startsWith('http') ? '' : 'http://localhost:3000';
const CLOUD_SYNC_URL = 'https://ntfy.sh/sofia_homestay_sync_v1';

let currentUser = null;
let bookingsData = [];
let usersData = [];
let calendar = null;
let activeProofBookingId = null;
let activePendingUploadBookingId = null;
let activeReceiptBookingId = null;
let activeReceiptType = 'RESIT PEMBAYARAN';

// Default Fallback Admin & Pre-seeded User Accounts
const DEFAULT_USERS = [
  { id: 'USR-ADMIN', username: 'admin', phone: '0192298176', name: 'Pengurusan SofiaRizqi', role: 'admin', password: '1234', createdAt: '2026-08-25T00:00:00.000Z' },
  { id: 'USR-2580', username: '0194218635', phone: '0194218635', ic: '810316025699', name: 'MOHD AZRULNIZAM', role: 'user', password: '1234', address: 'ALOR SETAR', createdAt: '2026-08-25T00:00:00.000Z' }
];

// Default Fallback Bookings (Guaranteed to be present across all devices and platforms)
const DEFAULT_BOOKINGS = [
  {
    id: 'SRH2580',
    receiptNo: 'SRH-0001',
    invoiceNo: 'INV-0001',
    userId: 'USR-2580',
    guestName: 'MOHD AZRULNIZAM',
    guestPhone: '0194218635',
    guestAddress: 'ALOR SETAR',
    homestayName: 'SofiaRizqi Homestay',
    checkInDate: '2026-09-10',
    checkInTime: '2 petang',
    checkOutDate: '2026-09-11',
    checkOutTime: '12.00 Tengahari',
    guestCount: '4',
    vehicleNumbers: 'VDK9939',
    purpose: 'Penginapan Homestay',
    nights: 1,
    ratePerNight: 350,
    accommodationTotal: 350,
    securityDeposit: 100,
    grandTotal: 450,
    paidAmount: 450,
    totalPayment: 450,
    balancePayment: 0,
    paymentMethod: 'Online Transfer',
    status: 'DISAHKAN',
    depositReceived: true,
    fullPaymentReceived: true,
    approvedByAdmin: true,
    paymentDate: '2026-09-08',
    receivedBy: 'Pengurusan SofiaRizqi',
    proofImage: '',
    createdAt: '2026-09-08T00:00:00.000Z'
  },
  {
    id: 'SRH2581',
    receiptNo: 'SRH-0002',
    invoiceNo: 'INV-0002',
    userId: 'USR-2580',
    guestName: 'MOHD AZRULNIZAM',
    guestPhone: '0194218635',
    guestAddress: 'ALOR SETAR',
    homestayName: 'SofiaRizqi Homestay',
    checkInDate: '2026-09-29',
    checkInTime: '2 petang',
    checkOutDate: '2026-09-30',
    checkOutTime: '12.00 Tengahari',
    guestCount: '4',
    vehicleNumbers: 'VDK9939',
    purpose: 'Penginapan Homestay',
    nights: 1,
    ratePerNight: 350,
    accommodationTotal: 350,
    securityDeposit: 100,
    grandTotal: 450,
    paidAmount: 100,
    totalPayment: 450,
    balancePayment: 350,
    paymentMethod: 'Online Transfer',
    status: 'MENUNGGU PENGESAHAN',
    depositReceived: true,
    fullPaymentReceived: false,
    approvedByAdmin: false,
    paymentDate: '2026-09-08',
    receivedBy: 'Pengurusan SofiaRizqi',
    proofImage: '',
    createdAt: '2026-09-08T00:00:00.000Z'
  }
];

// Broadcast event to Cloud Sync topic
async function broadcastSyncEvent(eventData) {
  try {
    await fetch(CLOUD_SYNC_URL, {
      method: 'POST',
      headers: { 'Title': 'SofiaRizqi Sync' },
      body: JSON.stringify(eventData)
    });
  } catch (err) {
    console.log('Broadcast sync error:', err);
  }
}

// Fetch latest events from Cloud Sync
async function fetchCloudSyncEvents() {
  try {
    const res = await fetch(`${CLOUD_SYNC_URL}/json?poll=1`);
    if (!res.ok) return;
    const text = await res.text();
    const lines = text.trim().split('\n');
    let hasChanges = false;

    lines.forEach(line => {
      if (!line.trim()) return;
      try {
        const item = JSON.parse(line);
        if (item.event === 'message' && item.message) {
          const payload = JSON.parse(item.message);
          if (payload.type === 'NEW_BOOKING' && payload.booking) {
            const b = payload.booking;
            const idx = bookingsData.findIndex(x => x.id === b.id);
            if (idx === -1) {
              bookingsData.push(b);
              hasChanges = true;
            } else {
              // Merge cloud data BUT preserve local proofImage if cloud doesn't have one
              const existingProof = bookingsData[idx].proofImage;
              bookingsData[idx] = { ...bookingsData[idx], ...b };
              if (existingProof && !b.proofImage) {
                bookingsData[idx].proofImage = existingProof;
              }
              hasChanges = true;
            }
          } else if (payload.type === 'UPDATE_STATUS' && payload.bookingId) {
            const b = bookingsData.find(x => x.id === payload.bookingId);
            if (b && b.status !== payload.status) {
              b.status = payload.status;
              if (payload.status === 'DISAHKAN') {
                b.approvedByAdmin = true;
                b.depositReceived = true;
              }
              hasChanges = true;
            }
          } else if (payload.type === 'SYNC_BOOKINGS' && Array.isArray(payload.bookings)) {
            payload.bookings.forEach(b => {
              const idx = bookingsData.findIndex(x => x.id === b.id);
              if (idx === -1) {
                bookingsData.push(b);
                hasChanges = true;
              }
            });
          } else if (payload.type === 'REGISTER_USER' && payload.user) {
            const u = payload.user;
            const idx = usersData.findIndex(x => x.id === u.id || (u.phone && x.phone === u.phone));
            if (idx === -1) {
              usersData.push(u);
              localStorage.setItem('sofia_users', JSON.stringify(usersData));
            }
          } else if (payload.type === 'NEW_DISCOUNT' && payload.discount) {
            const d = payload.discount;
            const exists = discountsData.find(x => x.code === d.code);
            if (!exists) {
              discountsData.push(d);
              localStorage.setItem('sofia_discounts', JSON.stringify(discountsData));
              renderDiscountsTable();
              console.log('✅ Kod diskaun baru diterima dari sync:', d.code);
            }
          } else if (payload.type === 'DELETE_DISCOUNT' && payload.discountId) {
            const before = discountsData.length;
            discountsData = discountsData.filter(x => x.id !== payload.discountId);
            if (discountsData.length !== before) {
              localStorage.setItem('sofia_discounts', JSON.stringify(discountsData));
              renderDiscountsTable();
            }
          } else if (payload.type === 'PROOF_UPLOADED' && payload.bookingId) {
            const b = bookingsData.find(x => x.id === payload.bookingId);
            if (b) {
              if (payload.proofImage) b.proofImage = payload.proofImage;
              if (payload.paidAmount) b.paidAmount = payload.paidAmount;
              if (payload.depositReceived !== undefined) b.depositReceived = payload.depositReceived;
              if (payload.fullPaymentReceived !== undefined) b.fullPaymentReceived = payload.fullPaymentReceived;
              if (payload.balancePayment !== undefined) b.balancePayment = payload.balancePayment;
              hasChanges = true;
              console.log('✅ Bukti bayaran diterima dari sync untuk:', payload.bookingId);
            }
          }
        }
      } catch (e) {}
    });

    if (hasChanges) {
      localStorage.setItem('sofia_bookings', JSON.stringify(bookingsData));
      updateStatsOverview();
      updateCalendarEvents();
      renderBookingsTable();
      renderMyBookings();
    }
  } catch (err) {
    console.log('Fetch cloud sync error:', err);
  }
}

// Safe icon renderer
function safeRenderIcons() {
  if (typeof lucide !== 'undefined' && lucide.createIcons) {
    try { lucide.createIcons(); } catch(e) {}
  }
}

// Strict Helper: Check if a booking belongs to the currently logged in user
function isBookingOwnedByUser(booking, user) {
  if (!user || user.role === 'admin' || !booking) return false;

  const curUserId = (user.id || '').trim();
  const curPhone = (user.phone || '').replace(/\D/g, '');

  const bookUserId = (booking.userId || '').trim();
  const bookPhone = (booking.guestPhone || '').replace(/\D/g, '');

  if (curUserId !== '' && bookUserId !== '' && bookUserId !== 'USR-GUEST' && curUserId === bookUserId) {
    return true;
  }

  if (curPhone.length >= 6 && bookPhone.length >= 6 && curPhone === bookPhone) {
    return true;
  }

  return false;
}

let currentSettings = { ratePerNight: 350, securityDeposit: 100 };

async function fetchSettings() {
  try {
    const res = await fetch(`${API_BASE}/api/settings`);
    if (res.ok) {
      const data = await res.json();
      currentSettings = {
        ratePerNight: data.ratePerNight !== undefined ? parseFloat(data.ratePerNight) : 350,
        securityDeposit: data.securityDeposit !== undefined ? parseFloat(data.securityDeposit) : 100
      };
      localStorage.setItem('sofia_settings', JSON.stringify(currentSettings));
    } else {
      throw new Error('Settings API response not OK');
    }
  } catch (err) {
    const saved = localStorage.getItem('sofia_settings');
    if (saved) {
      try {
        currentSettings = JSON.parse(saved);
      } catch (e) {
        currentSettings = { ratePerNight: 350, securityDeposit: 100 };
      }
    } else {
      currentSettings = { ratePerNight: 350, securityDeposit: 100 };
      localStorage.setItem('sofia_settings', JSON.stringify(currentSettings));
    }
  }
  updatePricingUI();
}

function updatePricingUI() {
  const sidebarRate = document.getElementById('sidebar-rate-per-night');
  const sidebarDeposit = document.getElementById('sidebar-security-deposit');
  const inputRate = document.getElementById('setting-rate-per-night');
  const inputDeposit = document.getElementById('setting-security-deposit');

  if (sidebarRate) sidebarRate.innerText = `RM ${currentSettings.ratePerNight} / malam`;
  if (sidebarDeposit) sidebarDeposit.innerText = `RM ${currentSettings.securityDeposit}`;
  if (inputRate && document.activeElement !== inputRate) inputRate.value = currentSettings.ratePerNight;
  if (inputDeposit && document.activeElement !== inputDeposit) inputDeposit.value = currentSettings.securityDeposit;

  calculateBookingPrice();
}

async function handleSettingsUpdateSubmit(e) {
  e.preventDefault();
  const rateInput = document.getElementById('setting-rate-per-night')?.value.trim();
  const depositInput = document.getElementById('setting-security-deposit')?.value.trim();

  const newRate = parseFloat(rateInput);
  const newDeposit = parseFloat(depositInput);

  if (isNaN(newRate) || newRate <= 0 || isNaN(newDeposit) || newDeposit < 0) {
    alert('Sila masukkan nilai kadar sewa dan deposit yang sah!');
    return;
  }

  currentSettings = { ratePerNight: newRate, securityDeposit: newDeposit };
  localStorage.setItem('sofia_settings', JSON.stringify(currentSettings));

  try {
    await fetch(`${API_BASE}/api/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(currentSettings)
    });
  } catch (err) {
    console.log('API unavailable, settings saved in LocalStorage...');
  }

  updatePricingUI();
  alert(`🎉 Kadar harga semasa berjaya dikemaskini!\nKadar Sewa: RM ${newRate} / malam\nDeposit Sekuriti: RM ${newDeposit}`);
}

let discountsData = [];
let activeAppliedDiscount = null;

async function fetchDiscounts() {
  const DEFAULT_DISC = [
    { id: 'DISC-001', code: 'PROMO50', amount: 50, active: true, createdAt: new Date().toISOString() },
    { id: 'DISC-002', code: 'TRY50', amount: 50, active: true, createdAt: new Date().toISOString() },
    { id: 'DISC-003', code: 'RAYA50', amount: 50, active: true, createdAt: new Date().toISOString() }
  ];

  try {
    const res = await fetch(`${API_BASE}/api/discounts`);
    if (res.ok) {
      discountsData = await res.json();
      // Merge in any defaults that aren't already in the API result
      DEFAULT_DISC.forEach(def => {
        if (!discountsData.find(d => d.code === def.code)) {
          discountsData.push(def);
        }
      });
      localStorage.setItem('sofia_discounts', JSON.stringify(discountsData));
    } else {
      throw new Error('Discounts API response not OK');
    }
  } catch (err) {
    const saved = localStorage.getItem('sofia_discounts');
    if (saved) {
      try {
        discountsData = JSON.parse(saved);
        // Always merge defaults into cached data
        DEFAULT_DISC.forEach(def => {
          if (!discountsData.find(d => d.code === def.code)) {
            discountsData.push(def);
          }
        });
        localStorage.setItem('sofia_discounts', JSON.stringify(discountsData));
      } catch (e) {
        discountsData = [...DEFAULT_DISC];
        localStorage.setItem('sofia_discounts', JSON.stringify(discountsData));
      }
    } else {
      discountsData = [...DEFAULT_DISC];
      localStorage.setItem('sofia_discounts', JSON.stringify(discountsData));
    }
  }
  renderDiscountsTable();
}

function renderDiscountsTable() {
  const tbody = document.getElementById('discounts-table-body');
  if (!tbody) return;

  if (discountsData.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" class="p-3 text-center text-slate-400 text-xs">Tiada kod diskaun didaftarkan.</td></tr>`;
    return;
  }

  tbody.innerHTML = discountsData.map(d => `
    <tr>
      <td class="p-2.5 font-bold text-navy-900 font-mono text-xs">${d.code}</td>
      <td class="p-2.5 font-bold text-emerald-700 text-xs">RM ${parseFloat(d.amount).toFixed(2)}</td>
      <td class="p-2.5"><span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Aktif</span></td>
      <td class="p-2.5 text-center">
        <button onclick="deleteDiscount('${d.id}')" class="bg-red-50 hover:bg-red-100 text-red-600 font-bold p-1 rounded-lg transition" title="Padam Kod">
          <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
        </button>
      </td>
    </tr>
  `).join('');
  safeRenderIcons();
}

async function handleCreateDiscountSubmit(e) {
  e.preventDefault();
  const codeInput = document.getElementById('discount-code-input')?.value.trim();
  const amountInput = document.getElementById('discount-amount-input')?.value.trim();

  if (!codeInput || !amountInput) {
    alert('Sila masukkan Kod Diskaun dan Jumlah Diskaun!');
    return;
  }

  const cleanCode = codeInput.toUpperCase();
  const numAmount = parseFloat(amountInput);
  if (isNaN(numAmount) || numAmount <= 0) {
    alert('Sila masukkan nilai diskaun yang sah!');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/discounts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanCode, amount: numAmount })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        alert('🎉 Kod Diskaun berjaya ditambah!');
        if (document.getElementById('discount-code-input')) document.getElementById('discount-code-input').value = '';
        if (document.getElementById('discount-amount-input')) document.getElementById('discount-amount-input').value = '';
        await fetchDiscounts();
        return;
      } else {
        alert(data.message);
        return;
      }
    }
  } catch (err) {
    console.log('API unavailable, adding discount in LocalStorage...');
  }

  if (discountsData.some(d => d.code === cleanCode)) {
    alert('Kod Diskaun ini telah wujud!');
    return;
  }

  const newD = {
    id: `DISC-${Math.floor(1000 + Math.random() * 9000)}`,
    code: cleanCode,
    amount: numAmount,
    active: true,
    createdAt: new Date().toISOString()
  };
  discountsData.push(newD);
  localStorage.setItem('sofia_discounts', JSON.stringify(discountsData));
  broadcastSyncEvent({ type: 'NEW_DISCOUNT', discount: newD });
  if (document.getElementById('discount-code-input')) document.getElementById('discount-code-input').value = '';
  if (document.getElementById('discount-amount-input')) document.getElementById('discount-amount-input').value = '';
  renderDiscountsTable();
  alert('🎉 Kod Diskaun berjaya ditambah!');
}

async function deleteDiscount(discountId) {
  if (!confirm('Adakah anda pasti mahu memadam kod diskaun ini?')) return;
  try {
    await fetch(`${API_BASE}/api/discounts/${discountId}`, { method: 'DELETE' });
  } catch (err) {}
  discountsData = discountsData.filter(d => d.id !== discountId);
  localStorage.setItem('sofia_discounts', JSON.stringify(discountsData));
  broadcastSyncEvent({ type: 'DELETE_DISCOUNT', discountId: discountId });
  renderDiscountsTable();
}

async function applyDiscountCode() {
  const codeInput = document.getElementById('book-discount-code')?.value.trim();
  const feedbackBox = document.getElementById('discount-feedback-box');
  if (!codeInput) {
    activeAppliedDiscount = null;
    if (feedbackBox) feedbackBox.classList.add('hidden');
    calculateBookingPrice();
    return;
  }

  const cleanCode = codeInput.toUpperCase();
  let foundDiscount = null;

  try {
    const res = await fetch(`${API_BASE}/api/discounts/validate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanCode })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.valid) {
        foundDiscount = { code: data.code, amount: data.discountAmount };
      } else {
        if (feedbackBox) {
          feedbackBox.className = 'text-[11px] p-2 rounded-lg font-medium bg-red-50 text-red-700 border border-red-200 block';
          feedbackBox.innerText = `❌ ${data.message}`;
        }
        activeAppliedDiscount = null;
        calculateBookingPrice();
        return;
      }
    }
  } catch (err) {
    console.log('API unavailable, checking discount in LocalStorage...');
  }

  if (!foundDiscount) {
    const match = discountsData.find(d => d.code === cleanCode && d.active);
    if (match) {
      foundDiscount = { code: match.code, amount: match.amount };
    }
  }

  if (foundDiscount) {
    activeAppliedDiscount = foundDiscount;
    if (feedbackBox) {
      feedbackBox.className = 'text-[11px] p-2 rounded-lg font-medium bg-emerald-50 text-emerald-800 border border-emerald-300 block';
      feedbackBox.innerText = `✅ Kod Diskaun ${foundDiscount.code} Sah! Diskaun RM ${foundDiscount.amount.toFixed(2)} diberikan.`;
    }
  } else {
    activeAppliedDiscount = null;
    if (feedbackBox) {
      feedbackBox.className = 'text-[11px] p-2 rounded-lg font-medium bg-red-50 text-red-700 border border-red-200 block';
      feedbackBox.innerText = `❌ Kod diskaun "${cleanCode}" tidak sah atau tidak wujud.`;
    }
  }
  calculateBookingPrice();
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  safeRenderIcons();
  checkAuthSession();
  initCalendar();
  fetchSettings();
  fetchDiscounts();
  fetchBookings();
  fetchUsers();

  // Auto-sync across devices every 15 seconds
  setInterval(() => {
    fetchCloudSyncEvents();
  }, 15000);
});

// Left Sidebar Navigation Toggle Hide / Show
function toggleSidebarNav() {
  const sidebar = document.getElementById('sidebar-nav');
  const btnShow = document.getElementById('btn-show-sidebar');

  if (!sidebar) return;

  if (sidebar.classList.contains('hidden')) {
    sidebar.classList.remove('hidden');
    if (btnShow) btnShow.classList.add('hidden');
  } else {
    sidebar.classList.add('hidden');
    if (btnShow) btnShow.classList.remove('hidden');
  }
  if (calendar) setTimeout(() => calendar.render(), 100);
  safeRenderIcons();
}

// Auth Session Handling
function checkAuthSession() {
  const savedUser = localStorage.getItem('sofia_user');
  if (savedUser) {
    currentUser = JSON.parse(savedUser);
    updateUIForAuth();
    if (currentUser.role === 'admin') {
      switchTab('penyewa-list');
    } else {
      switchTab('dashboard');
    }
  } else {
    updateUIForAuth();
    switchTab('login-menu');
  }
}

function updateUIForAuth() {
  const userInfoBar = document.getElementById('user-info-bar');
  const authButtons = document.getElementById('auth-buttons');
  const tabLoginMenu = document.getElementById('tab-login-menu');
  const tabPenyewaList = document.getElementById('tab-penyewa-list');
  const tabUsersList = document.getElementById('tab-users-list');
  const tabMyBookings = document.getElementById('tab-my-bookings');
  const statsOverview = document.getElementById('stats-overview-container');

  if (currentUser) {
    if (userInfoBar) userInfoBar.classList.remove('hidden');
    if (authButtons) authButtons.classList.add('hidden');
    if (tabLoginMenu) tabLoginMenu.classList.add('hidden');

    const nameEl = document.getElementById('current-user-name');
    const roleEl = document.getElementById('current-user-role');
    if (nameEl) nameEl.innerText = currentUser.name;
    if (roleEl) roleEl.innerText = currentUser.role;

    if (currentUser.role === 'admin') {
      if (tabPenyewaList) tabPenyewaList.classList.remove('hidden');
      if (tabUsersList) tabUsersList.classList.remove('hidden');
      if (tabMyBookings) tabMyBookings.classList.add('hidden');
      if (statsOverview) statsOverview.classList.remove('hidden');
    } else {
      if (tabPenyewaList) tabPenyewaList.classList.add('hidden');
      if (tabUsersList) tabUsersList.classList.add('hidden');
      if (tabMyBookings) tabMyBookings.classList.remove('hidden');
      if (statsOverview) statsOverview.classList.add('hidden');
    }
  } else {
    if (userInfoBar) userInfoBar.classList.add('hidden');
    if (authButtons) authButtons.classList.remove('hidden');
    if (tabLoginMenu) tabLoginMenu.classList.remove('hidden');
    if (tabPenyewaList) tabPenyewaList.classList.add('hidden');
    if (tabUsersList) tabUsersList.classList.add('hidden');
    if (tabMyBookings) tabMyBookings.classList.add('hidden');
    if (statsOverview) statsOverview.classList.add('hidden');
  }

  updateCalendarEvents();
  renderMyBookings();
  renderUsersTable();
  safeRenderIcons();
}

function logout() {
  localStorage.removeItem('sofia_user');
  currentUser = null;
  updateUIForAuth();
  switchTab('login-menu');
  alert('Anda telah keluar dari sistem.');
}

function clearAuthFormFields() {
  const elId = document.getElementById('single-login-id');
  const elPwd = document.getElementById('single-login-password');
  const elRegName = document.getElementById('single-reg-name');
  const elRegPhone = document.getElementById('single-reg-phone');
  const elRegIc = document.getElementById('single-reg-ic');
  const elRegAddr = document.getElementById('single-reg-address');
  const elRegPwd = document.getElementById('single-reg-password');

  if (elId) elId.value = '';
  if (elPwd) elPwd.value = '';
  if (elRegName) elRegName.value = '';
  if (elRegPhone) elRegPhone.value = '';
  if (elRegIc) elRegIc.value = '';
  if (elRegAddr) elRegAddr.value = '';
  if (elRegPwd) elRegPwd.value = '';
}

function showLoginMenu() {
  clearAuthFormFields();
  switchTab('login-menu');
  toggleSingleAuthMode('login');
}

// Single Unified Login Menu Handlers
function toggleSingleAuthMode(mode) {
  const loginForm = document.getElementById('single-form-login');
  const regForm = document.getElementById('single-form-reg');
  const btnLogin = document.getElementById('single-auth-btn-login');
  const btnReg = document.getElementById('single-auth-btn-reg');

  if (!loginForm || !regForm) return;

  if (mode === 'login') {
    loginForm.classList.remove('hidden');
    regForm.classList.add('hidden');
    btnLogin.classList.add('bg-white', 'text-navy-900', 'shadow');
    btnLogin.classList.remove('hover:text-navy-900');
    btnReg.classList.remove('bg-white', 'text-navy-900', 'shadow');
  } else {
    loginForm.classList.add('hidden');
    regForm.classList.remove('hidden');
    btnReg.classList.add('bg-white', 'text-navy-900', 'shadow');
    btnLogin.classList.remove('bg-white', 'text-navy-900', 'shadow');
  }
  safeRenderIcons();
}

async function handleSingleLoginSubmit(e) {
  e.preventDefault();
  const id = document.getElementById('single-login-id').value.trim();
  const password = document.getElementById('single-login-password').value.trim();
  const cleanId = id.replace(/\D/g, '');

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: id, phone: id, password })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        localStorage.setItem('sofia_user', JSON.stringify(currentUser));
        updateUIForAuth();
        alert(`Selamat Datang, ${currentUser.name}! (${currentUser.role === 'admin' ? 'Pengurusan Admin' : 'Penyewa'})`);
        if (currentUser.role === 'admin') switchTab('penyewa-list');
        else switchTab('dashboard');
        return;
      }
    }
  } catch (err) {}

  await fetchUsers();

  let localUsers = usersData;
  if (!localUsers || localUsers.length === 0) {
    localUsers = [...DEFAULT_USERS];
  } else {
    DEFAULT_USERS.forEach(defU => {
      if (!localUsers.some(u => u.id === defU.id || u.phone === defU.phone)) {
        localUsers.push(defU);
      }
    });
  }

  const foundUser = localUsers.find(u => {
    const uPhone = (u.phone || '').replace(/\D/g, '');
    const uUser = (u.username || '').toLowerCase();
    const uId = (u.id || '').toLowerCase();
    const uIc = (u.ic || '').replace(/\D/g, '');
    const matchesId = (cleanId.length >= 6 && uPhone === cleanId) || 
                      (cleanId.length >= 6 && uIc === cleanId) || 
                      uUser === id.toLowerCase() || 
                      uId === id.toLowerCase();
    return matchesId && u.password === password;
  });

  if (foundUser) {
    currentUser = foundUser;
    localStorage.setItem('sofia_user', JSON.stringify(currentUser));
    updateUIForAuth();
    alert(`Selamat Datang, ${currentUser.name}! (${currentUser.role === 'admin' ? 'Pengurusan Admin' : 'Penyewa'})`);
    if (currentUser.role === 'admin') switchTab('penyewa-list');
    else switchTab('dashboard');
  } else {
    alert('Log masuk gagal! Sila semak No. Telefon / ID dan kata laluan anda.');
  }
}

async function handleSingleRegisterSubmit(e) {
  e.preventDefault();
  const name = document.getElementById('single-reg-name').value.trim();
  const phone = document.getElementById('single-reg-phone').value.trim();
  const ic = document.getElementById('single-reg-ic').value.trim();
  const address = document.getElementById('single-reg-address').value.trim();
  const password = document.getElementById('single-reg-password').value.trim();

  try {
    const res = await fetch(`${API_BASE}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, ic, address, password })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        localStorage.setItem('sofia_user', JSON.stringify(currentUser));
        updateUIForAuth();
        await fetchUsers();
        alert('Pendaftaran Berjaya! Akaun anda telah didaftarkan.');
        switchTab('dashboard');
        return;
      }
    }
  } catch (err) {
    console.log('API unavailable, falling back to LocalStorage Register...');
  }

  let localUsers = JSON.parse(localStorage.getItem('sofia_users') || 'null');
  if (!localUsers) localUsers = DEFAULT_USERS;

  const newUser = {
    id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
    name,
    phone,
    ic,
    address,
    password,
    role: 'penyewa',
    createdAt: new Date().toISOString()
  };

  localUsers.push(newUser);
  localStorage.setItem('sofia_users', JSON.stringify(localUsers));

  currentUser = newUser;
  localStorage.setItem('sofia_user', JSON.stringify(currentUser));
  updateUIForAuth();
  fetchUsers();
  alert('Pendaftaran Berjaya! Akaun anda telah didaftarkan.');
  switchTab('dashboard');
}

// Modal Handlers
function openModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove('hidden');
}
function closeModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add('hidden');
}

// User Profile Edit & Change Password Modal
function openUserProfileModal() {
  if (!currentUser) return;
  document.getElementById('edit-profile-name').value = currentUser.name || '';
  document.getElementById('edit-profile-phone').value = currentUser.phone || '';
  document.getElementById('edit-profile-ic').value = currentUser.ic || '';
  document.getElementById('edit-profile-address').value = currentUser.address || '';
  document.getElementById('edit-profile-password').value = '';
  openModal('modal-user-profile');
}

async function handleProfileUpdateSubmit(e) {
  e.preventDefault();
  if (!currentUser) return;

  const name = document.getElementById('edit-profile-name').value.trim();
  const phone = document.getElementById('edit-profile-phone').value.trim();
  const ic = document.getElementById('edit-profile-ic').value.trim();
  const address = document.getElementById('edit-profile-address').value.trim();
  const newPassword = document.getElementById('edit-profile-password').value.trim();

  const payload = { name, phone, ic, address };
  if (newPassword) payload.password = newPassword;

  try {
    const res = await fetch(`${API_BASE}/api/users/${currentUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        currentUser = data.user;
        localStorage.setItem('sofia_user', JSON.stringify(currentUser));
        updateUIForAuth();
        closeModal('modal-user-profile');
        alert('🎉 Profil & kata laluan anda berjaya dikemaskini!');
        return;
      }
    }
  } catch (err) {
    console.log('API unavailable, updating profile in LocalStorage...');
  }

  // LocalStorage Fallback Profile Update
  currentUser.name = name;
  currentUser.phone = phone;
  currentUser.ic = ic;
  currentUser.address = address;
  if (newPassword) currentUser.password = newPassword;

  localStorage.setItem('sofia_user', JSON.stringify(currentUser));

  let localUsers = JSON.parse(localStorage.getItem('sofia_users') || 'null');
  if (localUsers) {
    const idx = localUsers.findIndex(u => u.id === currentUser.id);
    if (idx !== -1) {
      localUsers[idx] = currentUser;
      localStorage.setItem('sofia_users', JSON.stringify(localUsers));
    }
  }

  updateUIForAuth();
  closeModal('modal-user-profile');
  alert('🎉 Profil & kata laluan anda berjaya dikemaskini!');
}

// Admin Reset Password Modal
function openAdminResetPasswordModal(userId) {
  const user = usersData.find(u => u.id === userId);
  if (!user) return;

  document.getElementById('reset-target-user-id').value = user.id;
  document.getElementById('reset-user-display-name').innerText = `${user.name} (${user.phone})`;
  document.getElementById('reset-new-password').value = '';
  openModal('modal-admin-reset-pwd');
}

async function handleAdminResetPasswordSubmit(e) {
  e.preventDefault();
  const userId = document.getElementById('reset-target-user-id').value;
  const newPassword = document.getElementById('reset-new-password').value.trim();

  if (!newPassword) {
    alert('Sila masukkan kata laluan baharu!');
    return;
  }

  try {
    const res = await fetch(`${API_BASE}/api/users/${userId}/reset-password`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ newPassword })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        closeModal('modal-admin-reset-pwd');
        alert(`🔑 ${data.message}`);
        await fetchUsers();
        return;
      }
    }
  } catch (err) {
    console.log('API unavailable, resetting password in LocalStorage...');
  }

  // LocalStorage Reset Password Fallback
  let localUsers = JSON.parse(localStorage.getItem('sofia_users') || 'null');
  if (localUsers) {
    const target = localUsers.find(u => u.id === userId);
    if (target) {
      target.password = newPassword;
      localStorage.setItem('sofia_users', JSON.stringify(localUsers));
    }
  }
  closeModal('modal-admin-reset-pwd');
  alert(`🔑 Kata laluan berjaya di-reset kepada: ${newPassword}`);
  fetchUsers();
}

async function deleteUser(userId) {
  const target = usersData.find(u => u.id === userId);
  if (!target) return;

  if (target.role === 'admin') {
    alert('⚠️ Akaun Admin Utama tidak boleh dipadam!');
    return;
  }

  if (!confirm(`Adakah anda pasti mahu MEMADAM akaun pengguna ${target.name} (${target.phone})?`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/users/${userId}`, { method: 'DELETE' });
    if (res.ok) {
      alert(`🎉 Akaun pengguna ${target.name} telah dipadam!`);
      await fetchUsers();
      return;
    }
  } catch (err) {
    console.log('API unavailable, deleting user in LocalStorage...');
  }

  let localUsers = JSON.parse(localStorage.getItem('sofia_users') || 'null');
  if (localUsers) {
    localUsers = localUsers.filter(u => u.id !== userId);
    localStorage.setItem('sofia_users', JSON.stringify(localUsers));
  }
  alert(`🎉 Akaun pengguna ${target.name} telah dipadam!`);
  fetchUsers();
}

// Navigation Tabs Switcher
function switchTab(tabId) {
  const viewLoginMenu = document.getElementById('view-login-menu');
  const viewDash = document.getElementById('view-dashboard');
  const viewPenyewa = document.getElementById('view-penyewa-list');
  const viewUsers = document.getElementById('view-users-list');
  const viewMyBookings = document.getElementById('view-my-bookings');

  const btnLoginMenu = document.getElementById('tab-login-menu');
  const btnDash = document.getElementById('tab-dashboard');
  const btnPenyewa = document.getElementById('tab-penyewa-list');
  const btnUsers = document.getElementById('tab-users-list');
  const btnMyBookings = document.getElementById('tab-my-bookings');

  [viewLoginMenu, viewDash, viewPenyewa, viewUsers, viewMyBookings].forEach(v => {
    if (v) v.classList.add('hidden');
  });

  [btnLoginMenu, btnDash, btnPenyewa, btnUsers, btnMyBookings].forEach(b => {
    if (b) {
      b.classList.remove('bg-navy-900', 'text-gold-500', 'shadow', 'font-bold');
      b.classList.add('text-slate-600', 'hover:bg-slate-100', 'font-medium');
    }
  });

  if (tabId === 'login-menu') {
    if (viewLoginMenu) viewLoginMenu.classList.remove('hidden');
    if (btnLoginMenu) {
      btnLoginMenu.classList.add('bg-navy-900', 'text-gold-500', 'shadow', 'font-bold');
      btnLoginMenu.classList.remove('text-slate-600', 'hover:bg-slate-100', 'font-medium');
    }
  } else if (tabId === 'dashboard') {
    if (viewDash) viewDash.classList.remove('hidden');
    if (btnDash) {
      btnDash.classList.add('bg-navy-900', 'text-gold-500', 'shadow', 'font-bold');
      btnDash.classList.remove('text-slate-600', 'hover:bg-slate-100', 'font-medium');
    }
    updateCalendarEvents();
    if (calendar) setTimeout(() => calendar.render(), 100);
  } else if (tabId === 'penyewa-list') {
    if (viewPenyewa) viewPenyewa.classList.remove('hidden');
    if (btnPenyewa) {
      btnPenyewa.classList.add('bg-navy-900', 'text-gold-500', 'shadow', 'font-bold');
      btnPenyewa.classList.remove('text-slate-600', 'hover:bg-slate-100', 'font-medium');
    }
    renderBookingsTable();
  } else if (tabId === 'users-list') {
    if (viewUsers) viewUsers.classList.remove('hidden');
    if (btnUsers) {
      btnUsers.classList.add('bg-navy-900', 'text-gold-500', 'shadow', 'font-bold');
      btnUsers.classList.remove('text-slate-600', 'hover:bg-slate-100', 'font-medium');
    }
    renderUsersTable();
  } else if (tabId === 'my-bookings') {
    if (viewMyBookings) viewMyBookings.classList.remove('hidden');
    if (btnMyBookings) {
      btnMyBookings.classList.add('bg-navy-900', 'text-gold-500', 'shadow', 'font-bold');
      btnMyBookings.classList.remove('text-slate-600', 'hover:bg-slate-100', 'font-medium');
    }
    renderMyBookings();
  }
  safeRenderIcons();
}

// Fetch Users List
async function fetchUsers() {
  try {
    const res = await fetch(`${API_BASE}/api/users`);
    if (res.ok) {
      usersData = await res.json();
    }
  } catch (err) {}

  if (!usersData || usersData.length === 0) {
    try {
      const staticRes = await fetch('./data/users.json');
      if (staticRes.ok) {
        usersData = await staticRes.json();
      }
    } catch (err) {}
  }

  if (!usersData) usersData = [];

  let localUsers = JSON.parse(localStorage.getItem('sofia_users') || 'null');
  if (localUsers && Array.isArray(localUsers)) {
    localUsers.forEach(lu => {
      const idx = usersData.findIndex(u => u.id === lu.id || (u.phone && u.phone === lu.phone));
      if (idx !== -1) {
        usersData[idx] = lu;
      } else {
        usersData.push(lu);
      }
    });
  }

  DEFAULT_USERS.forEach(defU => {
    if (!usersData.some(u => u.id === defU.id || u.phone === defU.phone)) {
      usersData.push(defU);
    }
  });

  localStorage.setItem('sofia_users', JSON.stringify(usersData));
  renderUsersTable();
}

// Render Admin Users Table
function renderUsersTable() {
  const tbody = document.getElementById('users-table-body');
  if (!tbody) return;

  const searchVal = (document.getElementById('search-user-input')?.value || '').toLowerCase();

  const filtered = usersData.filter(u => {
    return (u.name || '').toLowerCase().includes(searchVal) ||
           (u.phone || '').toLowerCase().includes(searchVal) ||
           (u.ic || '').toLowerCase().includes(searchVal) ||
           (u.id || '').toLowerCase().includes(searchVal);
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-6 text-slate-400">Tiada pengguna dijumpai.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(u => {
    const isAdmin = u.role === 'admin';
    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="p-3">
          <div class="font-bold text-navy-900">${u.name}</div>
          <div class="text-xs text-slate-400">ID: ${u.id} ${u.username ? `(${u.username})` : ''}</div>
        </td>
        <td class="p-3 text-xs">
          <div>📞 <strong>${u.phone}</strong></div>
          <div class="text-slate-500">🪪 IC: ${u.ic || '-'}</div>
        </td>
        <td class="p-3 text-xs text-slate-600">
          ${u.address || '-'}
        </td>
        <td class="p-3">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold ${isAdmin ? 'bg-purple-100 text-purple-800 border border-purple-300' : 'bg-blue-100 text-blue-800 border border-blue-300'}">${u.role.toUpperCase()}</span>
        </td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-2">
            <button onclick="openAdminResetPasswordModal('${u.id}')" title="Reset Kata Laluan User" class="px-2.5 py-1 bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-300 rounded-lg text-xs font-bold flex items-center gap-1">
              <i data-lucide="key-round" class="w-3.5 h-3.5"></i> Reset Pwd
            </button>
            ${!isAdmin ? `
              <button onclick="deleteUser('${u.id}')" title="Padam Akaun Pengguna" class="p-1.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-lg">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');

  safeRenderIcons();
}

// Fetch & Update Bookings Data
async function fetchBookings() {
  try {
    const res = await fetch(`${API_BASE}/api/bookings`);
    if (res.ok) {
      const apiBookings = await res.json();
      if (apiBookings && apiBookings.length > 0) {
        bookingsData = apiBookings;
      }
    }
  } catch (err) {}

  if (!bookingsData || bookingsData.length === 0) {
    try {
      const staticRes = await fetch('./data/bookings.json');
      if (staticRes.ok) {
        bookingsData = await staticRes.json();
      }
    } catch (err) {}
  }

  if (!bookingsData) bookingsData = [];

  // Guarantee pre-seeded bookings are always present
  DEFAULT_BOOKINGS.forEach(defB => {
    if (!bookingsData.some(b => b.id === defB.id)) {
      bookingsData.push(defB);
    }
  });

  // Merge from localStorage — preserve local fields like proofImage that cloud doesn't carry
  let localBookings = JSON.parse(localStorage.getItem('sofia_bookings') || 'null');
  if (localBookings && Array.isArray(localBookings)) {
    localBookings.forEach(lb => {
      const idx = bookingsData.findIndex(b => b.id === lb.id);
      if (idx !== -1) {
        // Preserve important local-only fields that cloud sync doesn't carry
        const merged = { ...bookingsData[idx], ...lb };
        // If local has proofImage and cloud version doesn't, keep local's
        if (lb.proofImage && !bookingsData[idx].proofImage) {
          merged.proofImage = lb.proofImage;
        }
        bookingsData[idx] = merged;
      } else {
        bookingsData.push(lb);
      }
    });
  }

  // Poll cloud sync events
  await fetchCloudSyncEvents();

  bookingsData.forEach(b => {
    if (!b.approvedByAdmin && b.status !== 'BATAL' && b.status !== 'DITOLAK') {
      b.status = 'MENUNGGU PENGESAHAN';
    }
    if (b.ratePerNight === undefined || b.ratePerNight === null) {
      b.ratePerNight = currentSettings.ratePerNight || 350;
    }
    if (b.securityDeposit === undefined || b.securityDeposit === null) {
      b.securityDeposit = currentSettings.securityDeposit !== undefined ? currentSettings.securityDeposit : 100;
    }
    b.accommodationTotal = b.nights * b.ratePerNight;
    const disc = b.discountAmount ? parseFloat(b.discountAmount) : 0;
    b.grandTotal = Math.max(0, (b.accommodationTotal + b.securityDeposit) - disc);
    if (b.paidAmount === undefined || b.paidAmount === null) {
      b.paidAmount = b.depositReceived ? (b.fullPaymentReceived ? b.grandTotal : b.securityDeposit) : 0;
    }
    b.balancePayment = Math.max(0, b.grandTotal - b.paidAmount);
  });

  localStorage.setItem('sofia_bookings', JSON.stringify(bookingsData));
  updateStatsOverview();
  updateCalendarEvents();
  renderBookingsTable();
  renderMyBookings();
}

function updateStatsOverview() {
  const total = bookingsData.length;
  const confirmed = bookingsData.filter(b => b.status === 'DISAHKAN').length;
  const pending = bookingsData.filter(b => b.status === 'MENUNGGU PENGESAHAN').length;
  const revenue = bookingsData.reduce((acc, b) => b.status === 'DISAHKAN' ? acc + (b.paidAmount || b.grandTotal || 0) : acc, 0);

  const elTotal = document.getElementById('stat-total');
  const elConfirmed = document.getElementById('stat-confirmed');
  const elPending = document.getElementById('stat-pending');
  const elRevenue = document.getElementById('stat-revenue');

  if (elTotal) elTotal.innerText = total;
  if (elConfirmed) elConfirmed.innerText = confirmed;
  if (elPending) elPending.innerText = pending;
  if (elRevenue) elRevenue.innerText = `RM ${revenue.toLocaleString()}`;
}

// FullCalendar Setup
function initCalendar() {
  const calendarEl = document.getElementById('calendar-el');
  if (!calendarEl || typeof FullCalendar === 'undefined') return;

  calendar = new FullCalendar.Calendar(calendarEl, {
    initialView: 'dayGridMonth',
    headerToolbar: {
      left: 'prev,next today',
      center: 'title',
      right: 'dayGridMonth,listMonth'
    },
    buttonText: {
      today: 'Hari Ini',
      month: 'Bulan',
      list: 'Senarai'
    },
    locale: 'ms',
    selectable: true,
    select: function(info) {
      handleDateSelect(info.startStr, info.endStr);
    },
    eventClick: function(info) {
      const bId = info.event.id;
      const booking = bookingsData.find(b => b.id === bId);
      if (booking) {
        const isAdmin = currentUser && currentUser.role === 'admin';
        const isMyBooking = isBookingOwnedByUser(booking, currentUser);

        if (isAdmin) {
          openWhatsAppModal(bId);
        } else if (isMyBooking) {
          alert(`🏠 Tempahan Saya (${booking.id}): ${formatMalayDate(booking.checkInDate)} hingga ${formatMalayDate(booking.checkOutDate)} - Status: ${booking.status}`);
        } else {
          alert(`🔴 Tarikh ini telah ditempah (${formatMalayDate(booking.checkInDate)} hingga ${formatMalayDate(booking.checkOutDate)}). Sila pilih tarikh lain.`);
        }
      }
    }
  });
  calendar.render();
}

function updateCalendarEvents() {
  if (!calendar) return;
  calendar.removeAllEvents();

  const isAdmin = currentUser && currentUser.role === 'admin';

  bookingsData.forEach(b => {
    if (b.status === 'BATAL' || b.status === 'DITOLAK') return;
    const isConfirmed = b.status === 'DISAHKAN';
    const isMyBooking = isBookingOwnedByUser(b, currentUser);

    const endDate = new Date(b.checkOutDate);
    endDate.setDate(endDate.getDate() + 1);

    let eventTitle = '';
    if (isAdmin) {
      eventTitle = `${isConfirmed ? '🏠 [DISAHKAN]' : '⏳ [MENUNGGU]'} ${b.guestName}`;
    } else if (isMyBooking) {
      eventTitle = `${isConfirmed ? '🏠 Tempahan Saya (Disahkan)' : '⏳ Tempahan Saya (Menunggu Pengesahan)'}`;
    } else {
      eventTitle = `${isConfirmed ? '🔴 Telah Ditempah (Disahkan)' : '⏳ Telah Ditempah (Menunggu)'}`;
    }

    calendar.addEvent({
      id: b.id,
      title: eventTitle,
      start: b.checkInDate,
      end: endDate.toISOString().split('T')[0],
      className: isConfirmed ? 'fc-event-confirmed' : 'fc-event-pending',
      allDay: true
    });
  });
}

function handleDateSelect(startStr, endStr) {
  const actualCheckIn = startStr;
  const actualCheckOut = endStr;
  const isAdmin = currentUser && currentUser.role === 'admin';

  const conflict = bookingsData.find(b => {
    if (b.status === 'BATAL' || b.status === 'DITOLAK') return false;
    const s1 = new Date(actualCheckIn);
    const e1 = new Date(actualCheckOut);
    const s2 = new Date(b.checkInDate);
    const e2 = new Date(b.checkOutDate);
    return s1 <= e2 && e1 >= s2;
  });

  if (conflict) {
    const guestLabel = isAdmin ? ` (${conflict.guestName})` : '';
    alert(`⚠️ Maaf, tarikh dari ${formatMalayDate(conflict.checkInDate)} hingga ${formatMalayDate(conflict.checkOutDate)} telah pun ditempah${guestLabel}! Sila pilih tarikh lain.`);
    return;
  }

  handleNewBookingClick(actualCheckIn, actualCheckOut);
}

// Booking Form Logic
function handleNewBookingClick(startDate = '', endDate = '') {
  if (!currentUser) {
    alert('Sila log masuk atau daftar akaun penyewa terlebih dahulu untuk membuat tempahan.');
    showLoginMenu();
    return;
  }
  openBookingModal(startDate, endDate);
}

function openBookingModal(startDate = '', endDate = '') {
  activeAppliedDiscount = null;
  const elDiscInput = document.getElementById('book-discount-code');
  const elDiscBox = document.getElementById('discount-feedback-box');
  if (elDiscInput) elDiscInput.value = '';
  if (elDiscBox) elDiscBox.classList.add('hidden');

  const elCheckin = document.getElementById('book-checkin');
  const elCheckout = document.getElementById('book-checkout');
  const elGuests = document.getElementById('book-guests');
  const elVehicles = document.getElementById('book-vehicles');
  const elPurpose = document.getElementById('book-purpose');

  if (elCheckin) elCheckin.value = startDate || '';
  if (elCheckout) elCheckout.value = endDate || '';
  if (elGuests) elGuests.value = '2';
  if (elVehicles) elVehicles.value = '';
  if (elPurpose) elPurpose.value = '';

  openModal('modal-booking');

  if (currentUser) {
    const elName = document.getElementById('book-name');
    const elPhone = document.getElementById('book-phone');
    const elAddr = document.getElementById('book-address');
    if (elName) elName.value = currentUser.name || '';
    if (elPhone) elPhone.value = currentUser.phone || '';
    if (elAddr) elAddr.value = currentUser.address || '';
  }

  calculateBookingPrice();
  updatePaymentNotice();
}

function updatePaymentNotice() {
  const methodSelect = document.getElementById('book-payment-method');
  const noticeBox = document.getElementById('payment-notice-box');
  if (!methodSelect || !noticeBox) return;

  const val = methodSelect.value;
  if (val === 'Tunai') {
    noticeBox.innerHTML = `💵 <strong>Tunai (Bayar Semasa Check-in):</strong> Tempahan anda akan terus disahkan dan dipaparkan dalam senarai tempahan anda tanpa muat naik resit.`;
    noticeBox.className = 'text-[11px] text-emerald-800 font-semibold bg-emerald-50 p-2.5 rounded-lg border border-emerald-300 mt-1';
  } else if (val === 'Online Transfer') {
    noticeBox.innerHTML = `💳 <strong>Online Transfer:</strong> Memaparkan No. Akaun Bank Islam. WAJIB muat naik bukti pembayaran pada langkah seterusnya untuk dipaparkan dalam senarai tempahan.`;
    noticeBox.className = 'text-[11px] text-blue-800 font-semibold bg-blue-50 p-2.5 rounded-lg border border-blue-300 mt-1';
  } else {
    noticeBox.innerHTML = `📱 <strong>QR DuitNow:</strong> Memaparkan Imbasan QR DuitNow Bank Islam. WAJIB muat naik bukti pembayaran pada langkah seterusnya untuk dipaparkan dalam senarai tempahan.`;
    noticeBox.className = 'text-[11px] text-pink-800 font-semibold bg-pink-50 p-2.5 rounded-lg border border-pink-300 mt-1';
  }
}

// Calculate Booking Price: Accommodation (Nights * 350) + Deposit 100 = JUMLAH KESELURAHAN
function calculateBookingPrice() {
  const checkinVal = document.getElementById('book-checkin')?.value;
  const checkoutVal = document.getElementById('book-checkout')?.value;
  const submitBtn = document.getElementById('btn-submit-booking');
  const isAdmin = currentUser && currentUser.role === 'admin';

  if (!checkinVal || !checkoutVal) {
    const elNights = document.getElementById('calc-nights');
    const elAcc = document.getElementById('calc-accommodation');
    const elGrandTotal = document.getElementById('calc-total-grand');
    if (elNights) elNights.innerText = '0';
    if (elAcc) elAcc.innerText = 'RM 0.00';
    if (elGrandTotal) elGrandTotal.innerText = 'RM 0.00';
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
    return;
  }

  const dIn = new Date(checkinVal);
  const dOut = new Date(checkoutVal);

  if (dOut <= dIn) {
    alert('Tarikh Check-out mesti selepas tarikh Check-in!');
    document.getElementById('book-checkout').value = '';
    return;
  }

  const conflict = bookingsData.find(b => {
    if (b.status === 'BATAL' || b.status === 'DITOLAK') return false;
    const s1 = dIn;
    const e1 = dOut;
    const s2 = new Date(b.checkInDate);
    const e2 = new Date(b.checkOutDate);
    return s1 <= e2 && e1 >= s2;
  });

  if (conflict) {
    const guestLabel = isAdmin ? ` (${conflict.guestName})` : '';
    alert(`⚠️ Maaf, tarikh dari ${formatMalayDate(conflict.checkInDate)} hingga ${formatMalayDate(conflict.checkOutDate)} telah pun ditempah${guestLabel}! Sila pilih tarikh lain.`);
    document.getElementById('book-checkout').value = '';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.classList.add('opacity-50', 'cursor-not-allowed');
    }
    return;
  } else {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove('opacity-50', 'cursor-not-allowed');
    }
  }

  const diffTime = Math.abs(dOut - dIn);
  const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  const rate = currentSettings.ratePerNight || 350;
  const deposit = currentSettings.securityDeposit !== undefined ? currentSettings.securityDeposit : 100;
  const accommodationTotal = nights * rate;

  const discountAmt = activeAppliedDiscount ? activeAppliedDiscount.amount : 0;
  const grandTotal = Math.max(0, (accommodationTotal + deposit) - discountAmt);

  const elNights = document.getElementById('calc-nights');
  const elAcc = document.getElementById('calc-accommodation');
  const elDeposit = document.getElementById('calc-deposit');
  const elGrandTotal = document.getElementById('calc-total-grand');
  const elDiscountRow = document.getElementById('calc-discount-row');
  const elDiscountCodeName = document.getElementById('calc-discount-code-name');
  const elDiscountAmount = document.getElementById('calc-discount-amount');

  if (elNights) elNights.innerText = nights;
  if (elAcc) elAcc.innerText = `RM ${accommodationTotal.toFixed(2)}`;
  if (elDeposit) elDeposit.innerText = `RM ${deposit.toFixed(2)}`;

  if (activeAppliedDiscount && discountAmt > 0) {
    if (elDiscountRow) elDiscountRow.classList.remove('hidden');
    if (elDiscountCodeName) elDiscountCodeName.innerText = activeAppliedDiscount.code;
    if (elDiscountAmount) elDiscountAmount.innerText = `-RM ${discountAmt.toFixed(2)}`;
  } else {
    if (elDiscountRow) elDiscountRow.classList.add('hidden');
  }

  if (elGrandTotal) elGrandTotal.innerText = `RM ${grandTotal.toFixed(2)}`;
}

async function handleBookingSubmit(e) {
  e.preventDefault();
  const guestName = document.getElementById('book-name').value.trim();
  const guestPhone = document.getElementById('book-phone').value.trim();
  const guestAddress = document.getElementById('book-address').value.trim();
  const checkInDate = document.getElementById('book-checkin').value;
  const checkOutDate = document.getElementById('book-checkout').value;
  const guestCountRaw = document.getElementById('book-guests').value.trim();
  const vehicleNumbers = document.getElementById('book-vehicles').value.trim();
  const purpose = document.getElementById('book-purpose').value.trim();
  const isAdmin = currentUser && currentUser.role === 'admin';

  const guestCountNum = parseInt(guestCountRaw, 10);
  if (!guestCountRaw || isNaN(guestCountNum) || guestCountNum <= 0) {
    alert('Sila masukkan nombor sahaja (Cth: 4) untuk Bilangan Tetamu!');
    return;
  }

  const methodEl = document.getElementById('book-payment-method');
  const selectedPaymentMethod = methodEl ? methodEl.value : 'Online Transfer';

  if (!checkInDate || !checkOutDate) {
    alert('Sila pilih Tarikh Check-in dan Tarikh Check-out!');
    return;
  }

  const dIn = new Date(checkInDate);
  const dOut = new Date(checkOutDate);
  const conflict = bookingsData.find(b => {
    if (b.status === 'BATAL' || b.status === 'DITOLAK') return false;
    const s1 = dIn;
    const e1 = dOut;
    const s2 = new Date(b.checkInDate);
    const e2 = new Date(b.checkOutDate);
    return s1 <= e2 && e1 >= s2;
  });

  if (conflict) {
    const guestLabel = isAdmin ? ` (${conflict.guestName})` : '';
    alert(`⚠️ Maaf, tarikh dari ${formatMalayDate(conflict.checkInDate)} hingga ${formatMalayDate(conflict.checkOutDate)} telah pun ditempah${guestLabel}! Sila pilih tarikh lain.`);
    return;
  }

  const nights = Math.ceil(Math.abs(dOut - dIn) / (1000 * 60 * 60 * 24)) || 1;
  const ratePerNight = currentSettings.ratePerNight || 350;
  const securityDeposit = currentSettings.securityDeposit !== undefined ? currentSettings.securityDeposit : 100;
  const discountCode = activeAppliedDiscount ? activeAppliedDiscount.code : '';
  const discountAmount = activeAppliedDiscount ? activeAppliedDiscount.amount : 0;
  const accommodationTotal = nights * ratePerNight;
  const grandTotal = Math.max(0, (accommodationTotal + securityDeposit) - discountAmount);

  try {
    const res = await fetch(`${API_BASE}/api/bookings`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser ? currentUser.id : 'USR-GUEST',
        guestName,
        guestPhone,
        guestAddress,
        checkInDate,
        checkOutDate,
        guestCount: String(guestCountNum),
        vehicleNumbers,
        purpose,
        paymentMethod: selectedPaymentMethod,
        nights,
        ratePerNight,
        accommodationTotal,
        securityDeposit,
        discountCode,
        discountAmount,
        grandTotal,
        paidAmount: selectedPaymentMethod === 'Tunai' ? grandTotal : 0
      })
    });

    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        closeModal('modal-booking');
        await broadcastSyncEvent({ type: 'NEW_BOOKING', booking: data.booking });
        await fetchBookings();

        if (selectedPaymentMethod === 'Tunai') {
          alert('🎉 Tempahan Bayaran Tunai Berjaya! Rekod tempahan anda kini dipaparkan di senarai tempahan.');
          switchTab('my-bookings');
        } else {
          activePendingUploadBookingId = data.booking.id;
          openPaymentModal(data.booking.id, selectedPaymentMethod);
          alert('⚠️ Tempahan anda berjaya didaftarkan! Sila masukkan jumlah bayaran yang di-transfer dan muat naik resit.');
        }
        return;
      }
    }
  } catch (err) {
    console.log('API unavailable, falling back to LocalStorage Booking submission...');
  }

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const newBookingId = `SRH${randomNum}`;
  const seqNo = String(bookingsData.length + 1).padStart(4, '0');
  const isCash = selectedPaymentMethod === 'Tunai';

  const newBooking = {
    id: newBookingId,
    receiptNo: `SRH-${seqNo}`,
    invoiceNo: `INV-${seqNo}`,
    userId: currentUser ? currentUser.id : 'USR-GUEST',
    guestName,
    guestPhone,
    guestAddress: guestAddress || '',
    homestayName: 'SofiaRizqi Homestay',
    checkInDate,
    checkInTime: '2 petang',
    checkOutDate,
    checkOutTime: '12.00 Tengahari',
    guestCount: String(guestCountNum),
    vehicleNumbers: vehicleNumbers || '-',
    purpose: purpose || 'Penginapan Homestay',
    nights,
    ratePerNight,
    accommodationTotal,
    securityDeposit,
    discountCode,
    discountAmount,
    grandTotal,
    paidAmount: isCash ? grandTotal : 0,
    balancePayment: isCash ? 0 : grandTotal,
    paymentMethod: selectedPaymentMethod,
    status: 'MENUNGGU PENGESAHAN',
    depositReceived: isCash,
    fullPaymentReceived: false,
    paymentDate: new Date().toISOString().split('T')[0],
    receivedBy: 'Pengurusan SofiaRizqi',
    proofImage: '',
    createdAt: new Date().toISOString()
  };

  bookingsData.push(newBooking);
  localStorage.setItem('sofia_bookings', JSON.stringify(bookingsData));
  closeModal('modal-booking');

  updateStatsOverview();
  updateCalendarEvents();
  renderBookingsTable();
  renderMyBookings();

  await broadcastSyncEvent({ type: 'NEW_BOOKING', booking: newBooking });

  if (selectedPaymentMethod === 'Tunai') {
    alert('🎉 Tempahan Bayaran Tunai Berjaya! Rekod tempahan anda kini dipaparkan di senarai tempahan.');
    switchTab('my-bookings');
  } else {
    activePendingUploadBookingId = newBooking.id;
    openPaymentModal(newBooking.id, selectedPaymentMethod);
    alert('⚠️ Tempahan anda berjaya didaftarkan! Sila masukkan jumlah bayaran yang di-transfer dan muat naik resit.');
  }
}

// Payment & Upload Proof
function openPaymentModal(bookingId, paymentMethod = 'Online Transfer') {
  document.getElementById('upload-booking-id').value = bookingId;
  activePendingUploadBookingId = bookingId;
  
  const secQr = document.getElementById('payment-sec-qr');
  const secBank = document.getElementById('payment-sec-bank');
  const bankRefId = document.getElementById('bank-ref-id');
  const titleEl = document.getElementById('payment-modal-title');
  const proofAmountInput = document.getElementById('proof-amount-paid');

  if (bankRefId) bankRefId.innerText = bookingId;

  const booking = bookingsData.find(b => b.id === bookingId);
  if (proofAmountInput) {
    if (booking && booking.paidAmount > 0) {
      proofAmountInput.value = booking.paidAmount;
    } else if (booking) {
      proofAmountInput.value = '100.00';
    }
  }

  if (paymentMethod === 'Online Transfer') {
    if (secQr) secQr.classList.add('hidden');
    if (secBank) secBank.classList.remove('hidden');
    if (titleEl) titleEl.innerHTML = `<i data-lucide="building-2" class="w-4 h-4 text-gold-500"></i> Pembayaran Online Transfer`;
  } else {
    if (secQr) secQr.classList.remove('hidden');
    if (secBank) secBank.classList.add('hidden');
    if (titleEl) titleEl.innerHTML = `<i data-lucide="qr-code" class="w-4 h-4 text-gold-500"></i> Pembayaran QR DuitNow`;
  }

  safeRenderIcons();
  openModal('modal-payment');
}

function attemptClosePaymentModal() {
  const bookingId = document.getElementById('upload-booking-id').value;
  const booking = bookingsData.find(b => b.id === bookingId);

  if (booking && !booking.proofImage && booking.paymentMethod !== 'Tunai') {
    if (confirm('⚠️ Tempahan ini belum mempunyai bukti pembayaran. Adakah anda mahu MEMADAM tempahan ini dan mengosongkan tarikh tersebut?')) {
      deleteBooking(bookingId);
      closeModal('modal-payment');
      return;
    }
  }
  closeModal('modal-payment');
}

function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result);
    reader.onerror = (e) => reject(e);
    reader.readAsDataURL(file);
  });
}

async function handleUploadProofSubmit(e) {
  e.preventDefault();
  const bookingId = document.getElementById('upload-booking-id').value;
  const fileInput = document.getElementById('proof-file');
  const paidAmountRaw = document.getElementById('proof-amount-paid')?.value.trim();

  const userPaidAmount = parseFloat(paidAmountRaw);
  if (isNaN(userPaidAmount) || userPaidAmount <= 0) {
    alert('Sila masukkan jumlah bayaran yang sah (RM) yang telah anda transfer!');
    return;
  }

  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Sila pilih fail bukti bayaran.');
    return;
  }

  let imageDataUrl = '';
  try {
    imageDataUrl = await readFileAsDataURL(fileInput.files[0]);
  } catch (err) {
    console.error('Error reading image file:', err);
  }

  const formData = new FormData();
  formData.append('proofImage', fileInput.files[0]);
  formData.append('paidAmount', userPaidAmount);

  try {
    const res = await fetch(`${API_BASE}/api/bookings/${bookingId}/upload-proof`, {
      method: 'POST',
      body: formData
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        const booking = bookingsData.find(b => b.id === bookingId);
        if (booking) {
          booking.proofImage = data.proofImage || imageDataUrl;
          booking.paidAmount = userPaidAmount;
        }
        activePendingUploadBookingId = null;
        closeModal('modal-payment');
        alert('🎉 Bukti pembayaran berjaya dimuat naik! Perkiraan resit telah dikemaskini.');
        await fetchBookings();
        switchTab('my-bookings');
        return;
      }
    }
  } catch (err) {
    console.log('API unavailable, uploading image to cloud...');
  }

  // --- CLOUD IMAGE UPLOAD (Telegraph - no API key needed) ---
  let cloudImageUrl = '';
  try {
    const uploadFormData = new FormData();
    uploadFormData.append('file', fileInput.files[0], fileInput.files[0].name);
    const tgRes = await fetch('https://telegra.ph/upload', {
      method: 'POST',
      body: uploadFormData
    });
    if (tgRes.ok) {
      const tgData = await tgRes.json();
      if (Array.isArray(tgData) && tgData[0] && tgData[0].src) {
        cloudImageUrl = `https://telegra.ph${tgData[0].src}`;
        console.log('✅ Gambar resit berjaya dimuat naik ke cloud:', cloudImageUrl);
      }
    }
  } catch (err) {
    console.log('Telegraph upload failed, using local only:', err);
  }

  const finalProofUrl = cloudImageUrl || imageDataUrl;

  const booking = bookingsData.find(b => b.id === bookingId);
  if (booking) {
    booking.proofImage = finalProofUrl;
    booking.paidAmount = userPaidAmount;
    booking.accommodationTotal = booking.nights * (booking.ratePerNight || 350);
    booking.securityDeposit = currentSettings.securityDeposit || 100;
    const discAmt = parseFloat(booking.discountAmount) || 0;
    booking.grandTotal = Math.max(0, booking.accommodationTotal + booking.securityDeposit - discAmt);
    booking.balancePayment = Math.max(0, booking.grandTotal - userPaidAmount);
    booking.depositReceived = userPaidAmount >= booking.securityDeposit;
    booking.fullPaymentReceived = booking.balancePayment <= 0;
    localStorage.setItem('sofia_bookings', JSON.stringify(bookingsData));

    // Broadcast to ntfy.sh so Admin sees the image cross-device
    await broadcastSyncEvent({
      type: 'PROOF_UPLOADED',
      bookingId: bookingId,
      proofImage: cloudImageUrl || '',
      paidAmount: userPaidAmount,
      depositReceived: booking.depositReceived,
      fullPaymentReceived: booking.fullPaymentReceived,
      balancePayment: booking.balancePayment
    });
  }

  activePendingUploadBookingId = null;
  closeModal('modal-payment');
  const uploadMsg = cloudImageUrl
    ? '🎉 Bukti pembayaran berjaya dimuat naik! Admin dapat lihat gambar resit anda.'
    : '✅ Jumlah bayaran (RM ' + userPaidAmount.toFixed(2) + ') dikemaskini. (Gambar hanya tersedia di peranti ini)';
  alert(uploadMsg);
  fetchBookings();
  switchTab('my-bookings');
}

// Render Admin Data Table
function renderBookingsTable() {
  const tbody = document.getElementById('bookings-table-body');
  if (!tbody) return;

  const searchVal = (document.getElementById('search-input')?.value || '').toLowerCase();
  const statusFilter = document.getElementById('status-filter')?.value || 'ALL';

  const filtered = bookingsData.filter(b => {
    const matchesSearch = (b.guestName || '').toLowerCase().includes(searchVal) ||
                          (b.guestPhone || '').toLowerCase().includes(searchVal) ||
                          (b.id || '').toLowerCase().includes(searchVal);
    const matchesStatus = statusFilter === 'ALL' || b.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (filtered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-6 text-slate-400">Tiada rekod tempahan dijumpai.</td></tr>`;
    return;
  }

  tbody.innerHTML = filtered.map(b => {
    let statusClass = 'bg-amber-100 text-amber-800 border-amber-300';
    if (b.status === 'DISAHKAN') statusClass = 'bg-emerald-100 text-emerald-800 border-emerald-300';
    if (b.status === 'BATAL') statusClass = 'bg-red-100 text-red-800 border-red-300';

    const accTotal = b.nights * 350;
    const grandTotal = accTotal + 100;
    const paid = b.paidAmount !== undefined ? b.paidAmount : (b.depositReceived ? 100 : 0);
    const balance = Math.max(0, grandTotal - paid);

    const showReceiptBtn = b.proofImage || b.status === 'DISAHKAN' || b.paymentMethod === 'Tunai';

    return `
      <tr class="hover:bg-slate-50 transition border-b border-slate-100">
        <td class="p-3 font-bold text-navy-900">
          <div>${b.id}</div>
          <div class="text-[11px] font-normal text-slate-400">${b.receiptNo}</div>
          <div class="text-[10px] font-semibold text-slate-500">💳 ${b.paymentMethod || 'Online Transfer'}</div>
        </td>
        <td class="p-3">
          <div class="font-semibold text-slate-800">${b.guestName}</div>
          <div class="text-xs text-slate-500 flex items-center gap-1"><i data-lucide="phone" class="w-3 h-3 text-gold-500"></i> ${b.guestPhone}</div>
        </td>
        <td class="p-3 text-xs">
          <div><strong class="text-emerald-700">In:</strong> ${formatMalayDate(b.checkInDate)} (2 PM)</div>
          <div><strong class="text-navy-900">Out:</strong> ${formatMalayDate(b.checkOutDate)} (12 PM)</div>
          <div class="text-[11px] text-slate-400 font-semibold">${b.nights} Malam</div>
        </td>
        <td class="p-3 text-xs">
          <div>👨👩👧👦 ${b.guestCount}</div>
          <div class="text-slate-500">🚗 ${b.vehicleNumbers || '-'}</div>
        </td>
        <td class="p-3 text-xs">
          <div>Jumlah: <strong>RM ${grandTotal.toFixed(2)}</strong></div>
          <div class="text-emerald-600">Dibayar: RM ${paid.toFixed(2)}</div>
          <div class="text-navy-900 font-semibold">Baki: RM ${balance.toFixed(2)}</div>
        </td>
        <td class="p-3">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${statusClass}">${b.status}</span>
        </td>
        <td class="p-3 text-center">
          <div class="flex flex-col sm:flex-row items-center justify-center gap-1.5">
            <button onclick="viewProofModal('${b.id}')" title="Lihat Maklumat Tempahan & Bukti" class="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition">
              <i data-lucide="eye" class="w-3.5 h-3.5"></i> Maklumat
            </button>
            ${b.status === 'MENUNGGU PENGESAHAN' ? `
              <button onclick="quickApproveBooking('${b.id}')" title="Sahkan Tempahan Ini" class="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm transition">
                <i data-lucide="check-circle" class="w-3.5 h-3.5"></i> Sahkan
              </button>
            ` : ''}
            <div class="flex items-center gap-1">
              <button onclick="openWhatsAppModal('${b.id}')" title="Jana WhatsApp" class="p-1.5 bg-emerald-50 text-emerald-600 border border-emerald-200 rounded-lg hover:bg-emerald-100">
                <i data-lucide="message-square" class="w-4 h-4"></i>
              </button>
              <button onclick="printReceiptDoc('${b.id}')" title="Cetak Resit" class="p-1.5 bg-navy-900 text-gold-500 rounded-lg hover:bg-navy-800">
                <i data-lucide="receipt" class="w-4 h-4"></i>
              </button>
              <button onclick="printInvoiceDoc('${b.id}')" title="Cetak Invois" class="p-1.5 bg-slate-100 text-slate-700 border border-slate-200 rounded-lg hover:bg-slate-200">
                <i data-lucide="file-text" class="w-4 h-4"></i>
              </button>
              <button onclick="deleteBooking('${b.id}')" title="Padam Tempahan" class="p-1.5 bg-red-50 text-red-600 border border-red-200 rounded-lg hover:bg-red-100">
                <i data-lucide="trash-2" class="w-4 h-4"></i>
              </button>
            </div>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  safeRenderIcons();
}

// Render Penyewa My Bookings List
function renderMyBookings() {
  const container = document.getElementById('my-bookings-container');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `<div class="col-span-2 text-center py-8 text-slate-400">Sila log masuk untuk melihat rekod tempahan anda.</div>`;
    return;
  }

  const userBookings = bookingsData.filter(b => isBookingOwnedByUser(b, currentUser));

  const validBookings = userBookings.filter(b => b.proofImage || b.paymentMethod === 'Tunai' || b.status === 'DISAHKAN');
  const pendingUploadBookings = userBookings.filter(b => !b.proofImage && b.paymentMethod !== 'Tunai' && b.status !== 'DISAHKAN');

  if (validBookings.length === 0 && pendingUploadBookings.length === 0) {
    container.innerHTML = `
      <div class="col-span-2 text-center py-10 bg-slate-50 rounded-xl border border-dashed border-slate-300">
        <i data-lucide="calendar-x" class="w-10 h-10 text-slate-300 mx-auto mb-2"></i>
        <p class="text-sm font-semibold text-slate-600">Anda belum membuat sebarang tempahan lagi.</p>
        <button onclick="openBookingModal()" class="mt-3 bg-gold-500 hover:bg-gold-600 text-navy-900 font-bold px-4 py-2 rounded-xl text-xs inline-flex items-center gap-1 shadow">
          <i data-lucide="plus" class="w-4 h-4"></i> Buat Tempahan Sekarang
        </button>
      </div>
    `;
    safeRenderIcons();
    return;
  }

  let html = '';

  if (pendingUploadBookings.length > 0) {
    html += `
      <div class="col-span-2 bg-red-50 border-2 border-red-300 p-4 rounded-2xl space-y-3 text-red-900">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs font-bold text-red-700 uppercase tracking-wider">
            <i data-lucide="alert-triangle" class="w-5 h-5 text-red-600 shrink-0"></i>
            <span>Tempahan Belum Selesai (Memerlukan Bukti Bayaran):</span>
          </div>
          <span class="text-[11px] text-red-600 font-semibold">Masukkan jumlah transfer & muat naik resit</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${pendingUploadBookings.map(b => `
            <div class="bg-white p-3.5 rounded-xl border border-red-200 shadow-sm text-xs text-slate-800 space-y-2">
              <div class="flex justify-between items-center border-b border-slate-100 pb-1.5">
                <span class="font-bold text-navy-900">${b.id} (${b.paymentMethod || 'Online Transfer'})</span>
                <span class="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded text-[10px]">Belum Naik Resit</span>
              </div>
              <p>📅 <strong>Tarikh:</strong> ${formatMalayDate(b.checkInDate)} - ${formatMalayDate(b.checkOutDate)}</p>
              <p>💰 <strong>Jumlah Perlu Dijelaskan:</strong> RM ${( b.grandTotal !== undefined ? b.grandTotal : (b.nights * (b.ratePerNight || 350)) + (b.securityDeposit || 100) - (parseFloat(b.discountAmount) || 0) ).toFixed(2)}${b.discountAmount > 0 ? ` <span style="color:#059669;font-size:10px">(Diskaun -RM${parseFloat(b.discountAmount).toFixed(2)} digunapakai)</span>` : ''}</p>
              <div class="flex gap-2 pt-1">
                <button onclick="openPaymentModal('${b.id}', '${b.paymentMethod}')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 shadow">
                  <i data-lucide="upload" class="w-3.5 h-3.5"></i> Muat Naik Resit
                </button>
                <button onclick="deleteBooking('${b.id}')" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2 rounded-lg text-xs flex items-center justify-center gap-1 shadow">
                  <i data-lucide="trash-2" class="w-3.5 h-3.5"></i> Padam Tempahan
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </div>
    `;
  }

  html += validBookings.map(b => {
    let statusBadge = `<span class="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-bold">⏳ Menunggu Pengesahan</span>`;
    if (b.status === 'DISAHKAN') {
      statusBadge = `<span class="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold">🎉 DISAHKAN</span>`;
    }

    const disc = parseFloat(b.discountAmount) || 0;
    const accTotal = b.nights * (b.ratePerNight || 350);
    const secDep = b.securityDeposit || 100;
    const grandTotal = b.grandTotal !== undefined ? b.grandTotal : Math.max(0, accTotal + secDep - disc);
    const paid = b.paidAmount !== undefined ? b.paidAmount : (b.depositReceived ? secDep : 0);
    const balance = b.balancePayment !== undefined ? b.balancePayment : Math.max(0, grandTotal - paid);

    return `
      <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3 relative hover-card">
        <div class="flex justify-between items-start">
          <div>
            <span class="text-xs font-bold text-slate-400">ID TEMPAHAN (${b.paymentMethod || 'Online Transfer'})</span>
            <h4 class="text-lg font-bold text-navy-900">${b.id}</h4>
          </div>
          ${statusBadge}
        </div>

        <div class="text-xs text-slate-600 space-y-1 bg-slate-50 p-3 rounded-xl">
          <p>📅 <strong>Check-in:</strong> ${formatMalayDate(b.checkInDate)} (2 PM)</p>
          <p>📅 <strong>Check-out:</strong> ${formatMalayDate(b.checkOutDate)} (12 PM)</p>
          <p>👨👩👧👦 <strong>Tetamu:</strong> ${b.guestCount}</p>
          ${disc > 0 ? `<p>🏷️ <strong>Diskaun:</strong> <span style="color:#059669">-RM ${disc.toFixed(2)} (${b.discountCode || 'Kod Promo'})</span></p>` : ''}
          <p>💰 <strong>Jumlah Keseluruhan:</strong> RM ${grandTotal.toFixed(2)} | Dibayar: RM ${paid.toFixed(2)} | <strong>Baki: RM ${balance.toFixed(2)}</strong></p>
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-100">
          <span class="text-xs text-emerald-600 font-semibold flex items-center gap-1">
            <i data-lucide="check-circle" class="w-4 h-4"></i> ${b.paymentMethod === 'Tunai' ? 'Bayaran Tunai' : 'Bukti Dimuat Naik'}
          </span>
          
          <button onclick="printReceiptDoc('${b.id}')" class="bg-navy-900 hover:bg-navy-800 text-gold-500 font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1 shadow">
            <i data-lucide="receipt" class="w-4 h-4"></i> Lihat Resit
          </button>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = html;
  safeRenderIcons();
}

// Proof & Full Booking Details View Modal (Admin)
function viewProofModal(bookingId) {
  activeProofBookingId = bookingId;
  const booking = bookingsData.find(b => b.id === bookingId);
  if (!booking) return;

  const ratePerNight = booking.ratePerNight !== undefined ? parseFloat(booking.ratePerNight) : (currentSettings.ratePerNight || 350);
  const depositAmount = booking.securityDeposit !== undefined ? parseFloat(booking.securityDeposit) : (currentSettings.securityDeposit !== undefined ? currentSettings.securityDeposit : 100);
  const accTotal = booking.nights * ratePerNight;
  const grandTotal = accTotal + depositAmount;
  const paid = booking.paidAmount !== undefined ? booking.paidAmount : (booking.depositReceived ? 100 : 0);
  const balance = Math.max(0, grandTotal - paid);

  const statusBanner = document.getElementById('pv-status-banner');
  if (statusBanner) {
    if (booking.status === 'DISAHKAN') {
      statusBanner.className = 'p-3 rounded-xl text-center text-xs font-bold bg-emerald-50 text-emerald-800 border border-emerald-300';
      statusBanner.innerHTML = 'Status Tempahan: 🎉 DISAHKAN OLEH ADMIN';
    } else if (booking.status === 'BATAL') {
      statusBanner.className = 'p-3 rounded-xl text-center text-xs font-bold bg-red-50 text-red-800 border border-red-300';
      statusBanner.innerHTML = 'Status Tempahan: ❌ DITOLAK / DIBATALKAN';
    } else {
      statusBanner.className = 'p-3 rounded-xl text-center text-xs font-bold bg-amber-50 text-amber-800 border border-amber-300';
      statusBanner.innerHTML = 'Status Tempahan: ⏳ MENUNGGU PENGESAHAN ADMIN';
    }
  }

  const elId = document.getElementById('pv-id');
  const elName = document.getElementById('pv-guest-name');
  const elPhone = document.getElementById('pv-phone');
  const elAddr = document.getElementById('pv-address');
  const elIn = document.getElementById('pv-checkin');
  const elOut = document.getElementById('pv-checkout');
  const elGV = document.getElementById('pv-guests-vehicles');
  const elAcc = document.getElementById('pv-acc-total');
  const elDep = document.getElementById('pv-deposit');
  const elGrand = document.getElementById('pv-grand-total');
  const elPaid = document.getElementById('pv-paid-amount');
  const elBal = document.getElementById('pv-balance');
  const elMethod = document.getElementById('pv-payment-method');

  if (elId) elId.innerText = booking.id;
  if (elName) elName.innerText = booking.guestName;
  if (elPhone) elPhone.innerText = booking.guestPhone;
  if (elAddr) elAddr.innerText = booking.guestAddress || '-';
  if (elIn) elIn.innerText = `${formatMalayDate(booking.checkInDate)} (${booking.nights} Malam)`;
  if (elOut) elOut.innerText = formatMalayDate(booking.checkOutDate);
  if (elGV) elGV.innerText = `${booking.guestCount} Tetamu | Kereta: ${booking.vehicleNumbers || '-'}`;
  if (elAcc) elAcc.innerText = `RM ${accTotal.toFixed(2)}`;
  if (elDep) elDep.innerText = `RM ${depositAmount.toFixed(2)}`;
  if (elGrand) elGrand.innerText = `RM ${grandTotal.toFixed(2)}`;
  if (elPaid) elPaid.innerText = `RM ${paid.toFixed(2)}`;
  if (elBal) elBal.innerText = `RM ${balance.toFixed(2)}`;
  if (elMethod) elMethod.innerText = booking.paymentMethod || 'Online Transfer';

  const imgContainer = document.getElementById('proof-image-container');
  if (imgContainer) {
    if (booking.proofImage && !booking.proofImage.includes('ui-avatars.com')) {
      const proofImgUrl = booking.proofImage.startsWith('http') || booking.proofImage.startsWith('data:') 
        ? booking.proofImage 
        : `${API_BASE}${booking.proofImage}`;

      imgContainer.innerHTML = `
        <div class="space-y-2 text-center w-full">
          <img src="${proofImgUrl}" alt="Bukti Bayaran" class="max-h-80 object-contain mx-auto rounded-lg shadow-sm border border-slate-200 cursor-pointer" onclick="window.open('${proofImgUrl}', '_blank')">
          <p class="text-[10px] text-slate-400">🔍 Klik gambar di atas untuk lihat saiz penuh</p>
        </div>
      `;
    } else {
      imgContainer.innerHTML = `<p class="text-xs text-slate-500 py-6">💵 Kaedah Bayaran: <strong>${booking.paymentMethod || 'Tunai'}</strong> (Tiada fail resit dimuat naik).</p>`;
    }
  }

  const actionBtnContainer = document.getElementById('pv-action-buttons');
  if (actionBtnContainer) {
    if (booking.status === 'DISAHKAN') {
      actionBtnContainer.innerHTML = `
        <div class="w-full bg-emerald-50 border border-emerald-300 text-emerald-800 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2">
          <i data-lucide="check-circle" class="w-4 h-4 text-emerald-600"></i> Tempahan Ini Telah Disahkan Oleh Admin
        </div>
        <button onclick="closeModal('modal-proof-view')" class="w-full bg-navy-900 hover:bg-navy-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow">
          Tutup
        </button>
      `;
    } else if (booking.status === 'BATAL') {
      actionBtnContainer.innerHTML = `
        <div class="w-full bg-red-50 border border-red-300 text-red-800 text-xs font-bold py-2.5 px-3 rounded-xl flex items-center justify-center gap-2">
          <i data-lucide="x-circle" class="w-4 h-4 text-red-600"></i> Tempahan Ini Telah Ditolak / Dibatalkan
        </div>
        <button onclick="closeModal('modal-proof-view')" class="w-full bg-navy-900 hover:bg-navy-800 text-white font-bold py-2 rounded-xl text-xs flex items-center justify-center gap-1 shadow">
          Tutup
        </button>
      `;
    } else {
      actionBtnContainer.innerHTML = `
        <button onclick="approveBookingStatus('DISAHKAN')" class="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow">
          <i data-lucide="check-circle" class="w-4 h-4"></i> Sahkan Tempahan (Approve)
        </button>
        <button onclick="approveBookingStatus('BATAL')" class="flex-1 bg-red-600 hover:bg-red-700 text-white font-bold py-2.5 rounded-xl text-xs flex items-center justify-center gap-1.5 shadow">
          <i data-lucide="x-circle" class="w-4 h-4"></i> Tolak / Batal
        </button>
      `;
    }
  }

  safeRenderIcons();
  openModal('modal-proof-view');
}

async function quickApproveBooking(bookingId) {
  const b = bookingsData.find(x => x.id === bookingId);
  if (!b) return;

  if (!confirm(`Adakah anda pasti mahu MENGSAHKAN tempahan ${b.id} untuk ${b.guestName}?`)) return;

  activeProofBookingId = bookingId;
  await approveBookingStatus('DISAHKAN');
}

async function approveBookingStatus(newStatus) {
  if (!activeProofBookingId) return;

  try {
    const res = await fetch(`${API_BASE}/api/bookings/${activeProofBookingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        approvedByAdmin: newStatus === 'DISAHKAN',
        depositReceived: newStatus === 'DISAHKAN',
        fullPaymentReceived: newStatus === 'DISAHKAN',
        paymentDate: new Date().toISOString().split('T')[0]
      })
    });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        closeModal('modal-proof-view');
        alert(`Status tempahan berjaya dikemaskini kepada: ${newStatus}`);
        await fetchBookings();
        return;
      }
    }
  } catch (err) {
    console.log('API unavailable, updating status in LocalStorage...');
  }

  const booking = bookingsData.find(b => b.id === activeProofBookingId);
  if (booking) {
    booking.status = newStatus;
    booking.approvedByAdmin = newStatus === 'DISAHKAN';
    booking.depositReceived = newStatus === 'DISAHKAN';
    booking.fullPaymentReceived = newStatus === 'DISAHKAN';
    booking.paymentDate = new Date().toISOString().split('T')[0];
    localStorage.setItem('sofia_bookings', JSON.stringify(bookingsData));
  }
  closeModal('modal-proof-view');
  alert(`Status tempahan berjaya dikemaskini kepada: ${newStatus}`);
  updateStatsOverview();
  updateCalendarEvents();
  renderBookingsTable();
  renderMyBookings();
  await broadcastSyncEvent({ type: 'UPDATE_STATUS', bookingId: activeProofBookingId, status: newStatus });
}

// WhatsApp Generator Modal
function openWhatsAppModal(bookingId) {
  const b = bookingsData.find(x => x.id === bookingId);
  if (!b) return;

  const formattedIn = formatMalayDate(b.checkInDate);
  const formattedOut = formatMalayDate(b.checkOutDate);

  const accTotal = b.nights * 350;
  const depositPay = 100;
  const grandTotal = accTotal + depositPay;
  const paid = b.paidAmount !== undefined ? b.paidAmount : (b.depositReceived ? 100 : 0);
  const balancePay = Math.max(0, grandTotal - paid);

  const message = `Assalamualaikum / Salam Sejahtera 😊

Terima kasih kerana memilih SofiaRizqi Homestay.

🎉 Tempahan anda telah DISAHKAN dengan maklumat berikut:

👤 Nama dan no. tel Tetamu: 
${b.guestName}
${b.guestPhone}
🆔 No. Tempahan: ${b.id}
🏡 Homestay: SofiaRizqi Homestay
📅 Check-in: ${formattedIn}
🕒 Masa Check-in: 2 petang
📅 Check-out: ${formattedOut}
🕛 Masa Check-out: 12.00 Tengahari
👨👩👧👦 Bilangan Tetamu: 
${b.guestCount}
🚗 No. Pendaftaran Kenderaan: 
${b.vehicleNumbers || '-'}

💰 Jumlah Keseluruhan Perlu Dijelaskan: RM ${grandTotal.toFixed(2)} 
✅ Jumlah Telah Dibayar / Di-transfer: RM ${paid.toFixed(2)}
💵 Baki Bayaran Perlu Dijelaskan: RM ${balancePay.toFixed(2)}

📌 Nota Deposit: Bayaran deposit sekuriti (RM 100.00) akan dipulangkan selepas check-out sekiranya tiada sebarang kerosakan.

📍 Lokasi homestay, panduan check-in dan maklumat pengambilan kunci akan dihantar sehari sebelum tarikh penginapan.

Terima kasih kerana memilih SofiaRizqi Homestay! 😊`;

  document.getElementById('whatsapp-text-content').value = message;

  const cleanPhone = b.guestPhone.replace(/\D/g, '');
  const waPhone = cleanPhone.startsWith('0') ? `6${cleanPhone}` : cleanPhone;
  const encodedText = encodeURIComponent(message);
  document.getElementById('whatsapp-send-link').href = `https://wa.me/${waPhone}?text=${encodedText}`;

  openModal('modal-whatsapp');
}

function copyWhatsAppText() {
  const textarea = document.getElementById('whatsapp-text-content');
  textarea.select();
  document.execCommand('copy');
  alert('Mesej WhatsApp berjaya disalin ke papan keratan (clipboard)!');
}

// Delete Booking and Clear Date
async function deleteBooking(bookingId) {
  if (!confirm(`Adakah anda pasti mahu MEMADAM tempahan ${bookingId} dan MENGOSONGKAN tarikh tersebut?`)) return;

  try {
    const res = await fetch(`${API_BASE}/api/bookings/${bookingId}`, { method: 'DELETE' });
    if (res.ok) {
      const data = await res.json();
      if (data.success) {
        alert(`🎉 Tempahan ${bookingId} telah dipadam dan tarikh telah dikosongkan!`);
        await fetchBookings();
        return;
      }
    }
  } catch (err) {
    console.log('API unavailable, deleting booking in LocalStorage...');
  }

  bookingsData = bookingsData.filter(b => b.id !== bookingId);
  localStorage.setItem('sofia_bookings', JSON.stringify(bookingsData));
  alert(`🎉 Tempahan ${bookingId} telah dipadam dan tarikh telah dikosongkan!`);
  updateStatsOverview();
  updateCalendarEvents();
  renderBookingsTable();
  renderMyBookings();
}

// Printable Document Generators (Receipt & Invoice)
function printReceiptDoc(bookingId) {
  const b = bookingsData.find(x => x.id === bookingId);
  if (!b) return;

  activeReceiptBookingId = bookingId;
  activeReceiptType = 'RESIT PEMBAYARAN';

  const selectEl = document.getElementById('receipt-payment-method-select');
  if (selectEl) {
    const currentM = (b.paymentMethod || 'Online Transfer').trim();
    if (currentM.toLowerCase().includes('online')) selectEl.value = 'Online Transfer';
    else if (currentM.toLowerCase().includes('tunai')) selectEl.value = 'Tunai';
    else selectEl.value = 'QR DuitNow';
  }

  const html = renderOfficialDocHTML('RESIT PEMBAYARAN', b);
  document.getElementById('print-container').innerHTML = html;
  document.getElementById('print-modal-title').innerText = `Resit Pembayaran - ${b.receiptNo}`;
  openModal('modal-print-view');
}

function printInvoiceDoc(bookingId) {
  const b = bookingsData.find(x => x.id === bookingId);
  if (!b) return;

  activeReceiptBookingId = bookingId;
  activeReceiptType = 'INVOIS PEMBAYARAN';

  const selectEl = document.getElementById('receipt-payment-method-select');
  if (selectEl) {
    const currentM = (b.paymentMethod || 'Online Transfer').trim();
    if (currentM.toLowerCase().includes('online')) selectEl.value = 'Online Transfer';
    else if (currentM.toLowerCase().includes('tunai')) selectEl.value = 'Tunai';
    else selectEl.value = 'QR DuitNow';
  }

  const html = renderOfficialDocHTML('INVOIS PEMBAYARAN', b);
  document.getElementById('print-container').innerHTML = html;
  document.getElementById('print-modal-title').innerText = `Invois Pembayaran - ${b.invoiceNo}`;
  openModal('modal-print-view');
}

async function changeReceiptPaymentMethod(newMethod) {
  if (!activeReceiptBookingId) return;

  const booking = bookingsData.find(b => b.id === activeReceiptBookingId);
  if (!booking) return;

  booking.paymentMethod = newMethod;

  try {
    await fetch(`${API_BASE}/api/bookings/${activeReceiptBookingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ paymentMethod: newMethod })
    });
  } catch (e) {
    console.error('Error updating payment method on server:', e);
  }

  localStorage.setItem('sofia_bookings', JSON.stringify(bookingsData));

  const html = renderOfficialDocHTML(activeReceiptType, booking);
  document.getElementById('print-container').innerHTML = html;
  renderBookingsTable();
  renderMyBookings();
}

function triggerPrintDoc() {
  window.print();
}

// Full-size Official Document Renderer matching initial format (Nights*350 + Deposit 100 = Grand Total, minus Paid = Balance)
function renderOfficialDocHTML(docTitle, b) {
  const docNo = docTitle.includes('INVOIS') ? b.invoiceNo : b.receiptNo;
  const dateFormatted = b.paymentDate ? formatShortDate(b.paymentDate) : formatShortDate(new Date());

  const ratePerNight = b.ratePerNight !== undefined ? parseFloat(b.ratePerNight) : (currentSettings.ratePerNight || 350);
  const depositAmount = b.securityDeposit !== undefined ? parseFloat(b.securityDeposit) : (currentSettings.securityDeposit !== undefined ? currentSettings.securityDeposit : 100);
  const accommodationTotal = b.nights * ratePerNight;
  const discountAmount = b.discountAmount ? parseFloat(b.discountAmount) : 0;
  const grandTotal = Math.max(0, (accommodationTotal + depositAmount) - discountAmount);

  const paidAmount = b.paidAmount !== undefined && b.paidAmount !== null 
    ? parseFloat(b.paidAmount) 
    : (b.depositReceived ? (b.fullPaymentReceived ? grandTotal : 100) : 0);

  const balanceAmount = Math.max(0, grandTotal - paidAmount);

  const rawMethod = (b.paymentMethod || 'Online Transfer').trim();
  const lowerMethod = rawMethod.toLowerCase();

  const isOnline = lowerMethod.includes('online') || lowerMethod.includes('transfer');
  const isTunai = lowerMethod.includes('tunai') || lowerMethod.includes('cash');
  const isQR = lowerMethod.includes('qr') || lowerMethod.includes('duitnow');
  const isOther = !isOnline && !isTunai && !isQR;

  let displayMethodName = 'Online Transfer';
  if (isQR) displayMethodName = 'QR DuitNow';
  if (isTunai) displayMethodName = 'Tunai';
  if (isOther) displayMethodName = rawMethod || 'Lain-lain';

  return `
    <div id="print-area" class="receipt-box text-slate-800 font-sans" style="line-height: 1.45;">
      <!-- HEADER -->
      <table class="receipt-header-table mb-2">
        <tr>
          <td style="width: 95px; vertical-align: middle;">
            <div style="width: 80px; height: 80px; border-radius: 50%; border: 3px solid #daa520; background: #0f2444; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 2px;">
              <span style="font-size: 11px; font-weight: bold; color: #daa520;">SofiaRizqi</span>
              <span style="font-size: 7px; letter-spacing: 1px;">HOMESTAY</span>
              <span style="font-size: 5px; color: #cbd5e1; margin-top: 1px;">SELESA • BERSIH • MESRA</span>
            </div>
          </td>
          <td style="vertical-align: middle; padding-left: 6px;">
            <h2 style="font-size: 18px; font-weight: bold; color: #0f2444; margin: 0; font-family: Georgia, serif; text-transform: uppercase;">${docTitle}</h2>
            <h3 style="font-size: 13px; font-weight: bold; color: #daa520; margin: 1px 0 4px 0; font-family: Georgia, serif;">SOFIA RIZQI HOMESTAY</h3>
            <div style="font-size: 10.5px; color: #334155; line-height: 1.3;">
              📍 No. 14, Jalan Desa Seroja 3, Taman Desa Seroja, 09100 Baling, Kedah.<br>
              📞 019-229 8176
            </div>
          </td>
          <td style="width: 170px; vertical-align: top;">
            <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
              <tr>
                <td class="receipt-navy-bar" style="text-align: center; padding: 2px 6px;">${docTitle.includes('INVOIS') ? 'NO. INVOIS' : 'NO. RESIT'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #0f2444; text-align: center; padding: 2px; font-weight: bold; background: #f8fafc;">${docNo}</td>
              </tr>
              <tr>
                <td class="receipt-navy-bar" style="text-align: center; padding: 2px 6px; margin-top: 2px;">TARIKH</td>
              </tr>
              <tr>
                <td style="border: 1px solid #0f2444; text-align: center; padding: 2px; background: #f8fafc;">${dateFormatted}</td>
              </tr>
              <tr>
                <td class="receipt-navy-bar" style="text-align: center; padding: 2px 6px; margin-top: 2px;">KAEDAH PEMBAYARAN</td>
              </tr>
              <tr>
                <td style="border: 1px solid #0f2444; text-align: center; padding: 2px; background: #f8fafc; font-weight: bold; color: #0f2444;">${displayMethodName}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- MAKLUMAT PELANGGAN & TEMPAHAN -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10.5px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 5px;">
            <div class="receipt-navy-bar mb-1" style="padding: 2px 6px;">MAKLUMAT PELANGGAN</div>
            <table style="width: 100%; border-collapse: collapse; line-height: 1.5;">
              <tr><td style="width: 80px; font-weight: bold;">Nama</td><td>: ${b.guestName}</td></tr>
              <tr><td style="font-weight: bold;">No. Telefon</td><td>: ${b.guestPhone}</td></tr>
              <tr><td style="font-weight: bold; vertical-align: top;">Alamat</td><td>: ${b.guestAddress || '-'}</td></tr>
            </table>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 5px;">
            <div class="receipt-navy-bar mb-1" style="padding: 2px 6px;">MAKLUMAT TEMPAHAN</div>
            <table style="width: 100%; border-collapse: collapse; line-height: 1.5;">
              <tr><td style="width: 105px; font-weight: bold;">Tarikh Check-in</td><td>: ${formatMalayDate(b.checkInDate)}</td></tr>
              <tr><td style="font-weight: bold;">Tarikh Check-out</td><td>: ${formatMalayDate(b.checkOutDate)}</td></tr>
              <tr><td style="font-weight: bold;">Bilangan Tetamu</td><td>: ${b.guestCount}</td></tr>
              <tr><td style="font-weight: bold;">Tujuan Penginapan</td><td>: ${b.purpose || 'Percutian'}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- TABLE PERINCIAN (HAK KADAR + DEPOSIT = JUMLAH KESELURAHAN, MINUS PAID = BAKI) -->
      <table class="receipt-table mb-2" style="font-size: 10.5px;">
        <thead>
          <tr>
            <th style="width: 70%; padding: 4px 6px;">PERINCIAN</th>
            <th style="width: 30%; padding: 4px 6px;">JUMLAH (RM)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 4px 6px;">1. Kadar Penginapan (${b.nights} Malam × RM ${ratePerNight.toFixed(2)})</td>
            <td style="text-align: right; font-weight: bold; padding: 4px 6px;">RM ${accommodationTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 6px;">2. Deposit Sekuriti (Dipulangkan selepas check-out)</td>
            <td style="text-align: right; font-weight: bold; color: #166534; padding: 4px 6px;">RM ${depositAmount.toFixed(2)}</td>
          </tr>
          ${discountAmount > 0 ? `
          <tr>
            <td style="padding: 4px 6px; color: #047857; font-weight: bold;">3. Diskaun Promosi (${b.discountCode || 'DISKAUN'})</td>
            <td style="text-align: right; font-weight: bold; color: #047857; padding: 4px 6px;">-RM ${discountAmount.toFixed(2)}</td>
          </tr>
          ` : ''}
          <tr class="receipt-total-row" style="font-size: 11px; background: #fff8e7;">
            <td style="text-align: right; text-transform: uppercase; padding: 5px 6px; font-weight: bold; color: #0f2444;">JUMLAH KESELURUHAN PERLU DIJELASKAN</td>
            <td style="text-align: right; font-size: 12px; color: #0f2444; padding: 5px 6px; font-weight: bold;">RM ${grandTotal.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 4px 6px; color: #15803d; font-weight: bold;">3. Jumlah Telah Dibayar / Di-transfer</td>
            <td style="text-align: right; font-weight: bold; color: #15803d; padding: 4px 6px;">RM ${paidAmount.toFixed(2)}</td>
          </tr>
          <tr style="font-size: 11.5px; background: #f8fafc;">
            <td style="text-align: right; text-transform: uppercase; padding: 5px 6px; font-weight: bold; color: #dc2626;">BAKI PERLU DIJELASKAN</td>
            <td style="text-align: right; font-size: 12px; color: #dc2626; padding: 5px 6px; font-weight: bold;">RM ${balanceAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <!-- NOTA PENTING DIPULANGKAN DEPOSIT -->
      <div style="margin-bottom: 6px; padding: 5px 8px; background: #eff6ff; border: 1px solid #93c5fd; border-radius: 4px; font-size: 9.5px; color: #1e40af; line-height: 1.3;">
        📌 <strong>NOTA PENTING DEPOSIT:</strong> Bayaran deposit sekuriti (RM ${depositAmount.toFixed(2)}) akan dipulangkan sepenuhnya kepada penyewa selepas check-out sekiranya tiada sebarang kerosakan atau kehilangan pada homestay.
      </div>

      <!-- STATUS & SUMBANGAN -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 8px; font-size: 10.5px;">
        <tr>
          <td style="width: 48%; vertical-align: top; padding-right: 5px;">
            <div class="receipt-navy-bar mb-1" style="padding: 2px 6px;">STATUS PEMBAYARAN</div>
            <div style="border: 1px solid #0f2444; padding: 6px; border-radius: 4px; background: #f8fafc; line-height: 1.5;">
              <div>[ ${paidAmount >= 100 ? '✓' : ' '} ] Deposit Sekuriti Diterima</div>
              <div>[ ${balanceAmount <= 0 ? '✓' : ' '} ] Bayaran Penuh Diterima</div>
              <div style="margin-top: 3px;">Tarikh Terima Bayaran : <strong>${dateFormatted}</strong></div>
              <div>Diterima Oleh : <strong>${b.receivedBy || 'Pengurusan SofiaRizqi'}</strong></div>
            </div>
          </td>
          <td style="width: 52%; vertical-align: top; padding-left: 5px;">
            <div class="receipt-navy-bar mb-1" style="padding: 2px 6px;">SUMBANGAN TERIMA KASIH</div>
            <div style="border: 1px solid #0f2444; padding: 6px; border-radius: 4px; background: #fffdf5; text-align: center; line-height: 1.3;">
              Terima kasih kerana memilih Sofia Rizqi Homestay.<br>
              Kami amat menghargai kepercayaan anda.<br>
              <div style="font-family: Georgia, serif; font-size: 11px; color: #daa520; font-weight: bold; margin-top: 3px;">
                Selamat Datang & Terima Kasih! 💕
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- KAEDAH & TANDATANGAN -->
      <table style="width: 100%; border-collapse: collapse; font-size: 10.5px;">
        <tr>
          <td style="width: 48%; vertical-align: top; padding-right: 5px;">
            <div class="receipt-navy-bar mb-1" style="padding: 2px 6px;">KAEDAH PEMBAYARAN</div>
            <div style="border: 1px solid #0f2444; padding: 5px; border-radius: 4px; line-height: 1.5; font-weight: bold;">
              <div style="${isOnline ? 'color: #0f2444; font-weight: bold;' : 'color: #64748b; font-weight: normal;'}">( ${isOnline ? '●' : '○'} ) Online Transfer</div>
              <div style="${isTunai ? 'color: #0f2444; font-weight: bold;' : 'color: #64748b; font-weight: normal;'}">( ${isTunai ? '●' : '○'} ) Tunai</div>
              <div style="${isQR ? 'color: #0f2444; font-weight: bold;' : 'color: #64748b; font-weight: normal;'}">( ${isQR ? '●' : '○'} ) QR DuitNow</div>
              <div style="${isOther ? 'color: #0f2444; font-weight: bold;' : 'color: #64748b; font-weight: normal;'}">( ${isOther ? '●' : '○'} ) Lain-lain</div>
            </div>
          </td>
          <td style="width: 52%; vertical-align: top; padding-left: 5px;">
            <div class="receipt-navy-bar mb-1" style="padding: 2px 6px;">TANDATANGAN / COP</div>
            <div style="border: 1px solid #0f2444; padding: 5px; border-radius: 4px; text-align: center; height: 52px; display: flex; flex-direction: column; justify-content: space-between;">
              <div style="font-family: 'Brush Script MT', cursive, Georgia; font-size: 15px; color: #0f2444;">Sofia Rizqi</div>
              <div style="border-top: 1px dashed #94a3b8; font-size: 8.5px; padding-top: 1px; color: #475569;">Sofia Rizqi Homestay</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- FOOTER BANNER -->
      <div style="margin-top: 8px; background: #0f2444; color: white; padding: 5px 8px; display: flex; justify-between; align-items: center; font-size: 9px; border-radius: 4px;">
        <div><strong>SELESA</strong> • Penginapan selesa</div>
        <div><strong>BERSIH</strong> • Kebersihan diutamakan</div>
        <div><strong>MESRA</strong> • Layanan mesra pelanggan</div>
        <div style="color: #daa520; font-weight: bold;">Keselesaan Seisi Keluarga 💕</div>
      </div>
    </div>
  `;
}

// Utility Helpers
function formatMalayDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  const months = ['Jan', 'Feb', 'Mac', 'Apr', 'Mei', 'Jun', 'Jul', 'Ogos', 'Sep', 'Okt', 'Nov', 'Dis'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function formatShortDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return `${d.getDate()}/${d.getMonth() + 1}/${d.getFullYear()}`;
}
