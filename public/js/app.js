// Main Client JS Application for SofiaRizqi Homestay

const API_BASE = window.location.protocol.startsWith('http') ? '' : 'http://localhost:3000';

let currentUser = null;
let bookingsData = [];
let calendar = null;
let activeProofBookingId = null;
let activePendingUploadBookingId = null;
let activeReceiptBookingId = null;
let activeReceiptType = 'RESIT PEMBAYARAN';

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

  // 1. Strict Match on User ID (non-empty & not USR-GUEST)
  if (curUserId !== '' && bookUserId !== '' && bookUserId !== 'USR-GUEST' && curUserId === bookUserId) {
    return true;
  }

  // 2. Strict Match on Cleaned Phone Number (at least 6 digits)
  if (curPhone.length >= 6 && bookPhone.length >= 6 && curPhone === bookPhone) {
    return true;
  }

  return false;
}

// Initialize App
document.addEventListener('DOMContentLoaded', () => {
  safeRenderIcons();
  checkAuthSession();
  initCalendar();
  fetchBookings();
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
      switchTab('dashboard'); // Penyewa sees Calendar FIRST
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
  const tabMyBookings = document.getElementById('tab-my-bookings');
  const statsOverview = document.getElementById('stats-overview-container');

  if (currentUser) {
    if (userInfoBar) userInfoBar.classList.remove('hidden');
    if (authButtons) authButtons.classList.add('hidden');
    if (tabLoginMenu) tabLoginMenu.classList.add('hidden'); // Hide Menu Log Masuk tab when logged in

    const nameEl = document.getElementById('current-user-name');
    const roleEl = document.getElementById('current-user-role');
    if (nameEl) nameEl.innerText = currentUser.name;
    if (roleEl) roleEl.innerText = currentUser.role;

    if (currentUser.role === 'admin') {
      if (tabPenyewaList) tabPenyewaList.classList.remove('hidden');
      if (tabMyBookings) tabMyBookings.classList.add('hidden');
      if (statsOverview) statsOverview.classList.remove('hidden'); // SHOW stats ONLY for Admin
    } else {
      if (tabPenyewaList) tabPenyewaList.classList.add('hidden');
      if (tabMyBookings) tabMyBookings.classList.remove('hidden');
      if (statsOverview) statsOverview.classList.add('hidden'); // HIDE stats for Penyewa
    }
  } else {
    if (userInfoBar) userInfoBar.classList.add('hidden');
    if (authButtons) authButtons.classList.remove('hidden');
    if (tabLoginMenu) tabLoginMenu.classList.remove('hidden'); // Show Menu Log Masuk tab when logged out
    if (tabPenyewaList) tabPenyewaList.classList.add('hidden');
    if (tabMyBookings) tabMyBookings.classList.add('hidden');
    if (statsOverview) statsOverview.classList.add('hidden'); // HIDE stats when not logged in
  }

  // Refresh calendar and bookings lists for the current logged-in user state
  updateCalendarEvents();
  renderMyBookings();
  safeRenderIcons();
}

function logout() {
  localStorage.removeItem('sofia_user');
  currentUser = null;
  updateUIForAuth();
  switchTab('login-menu');
  alert('Anda telah keluar dari sistem.');
}

function showLoginMenu() {
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

  try {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: id, phone: id, password })
    });
    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('sofia_user', JSON.stringify(currentUser));
      updateUIForAuth();
      alert(`Selamat Datang, ${currentUser.name}! (${currentUser.role === 'admin' ? 'Pengurusan Admin' : 'Penyewa'})`);
      if (currentUser.role === 'admin') {
        switchTab('penyewa-list');
      } else {
        switchTab('dashboard'); // Penyewa lands on Calendar FIRST
      }
    } else {
      alert(data.message || 'Log masuk gagal! Sila semak ID dan kata laluan anda.');
    }
  } catch (err) {
    console.error(err);
    alert('Ralat pelayan semasa log masuk.');
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
    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('sofia_user', JSON.stringify(currentUser));
      updateUIForAuth();
      alert('Pendaftaran Berjaya! Akaun anda telah didaftarkan.');
      switchTab('dashboard'); // Penyewa lands on Calendar FIRST (No booking modal auto pop-up)
    } else {
      alert(data.message || 'Pendaftaran gagal!');
    }
  } catch (err) {
    console.error(err);
    alert('Ralat pelayan semasa pendaftaran.');
  }
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

// Navigation Tabs Switcher
function switchTab(tabId) {
  const viewLoginMenu = document.getElementById('view-login-menu');
  const viewDash = document.getElementById('view-dashboard');
  const viewPenyewa = document.getElementById('view-penyewa-list');
  const viewMyBookings = document.getElementById('view-my-bookings');

  const btnLoginMenu = document.getElementById('tab-login-menu');
  const btnDash = document.getElementById('tab-dashboard');
  const btnPenyewa = document.getElementById('tab-penyewa-list');
  const btnMyBookings = document.getElementById('tab-my-bookings');

  [viewLoginMenu, viewDash, viewPenyewa, viewMyBookings].forEach(v => {
    if (v) v.classList.add('hidden');
  });

  [btnLoginMenu, btnDash, btnPenyewa, btnMyBookings].forEach(b => {
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
    updateCalendarEvents(); // Ensure fresh events state on switching to calendar
    if (calendar) setTimeout(() => calendar.render(), 100);
  } else if (tabId === 'penyewa-list') {
    if (viewPenyewa) viewPenyewa.classList.remove('hidden');
    if (btnPenyewa) {
      btnPenyewa.classList.add('bg-navy-900', 'text-gold-500', 'shadow', 'font-bold');
      btnPenyewa.classList.remove('text-slate-600', 'hover:bg-slate-100', 'font-medium');
    }
    renderBookingsTable();
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

// Fetch & Update Bookings Data
async function fetchBookings() {
  try {
    const res = await fetch(`${API_BASE}/api/bookings`);
    bookingsData = await res.json();
    
    // Ensure strict calculation logic for all bookings
    bookingsData.forEach(b => {
      b.ratePerNight = 350;
      b.totalPayment = b.nights * 350;
      b.securityDeposit = 100;
      b.balancePayment = b.totalPayment - 100;
    });

    updateStatsOverview();
    updateCalendarEvents();
    renderBookingsTable();
    renderMyBookings();
  } catch (err) {
    console.error('Error fetching bookings:', err);
  }
}

function updateStatsOverview() {
  const total = bookingsData.length;
  const confirmed = bookingsData.filter(b => b.status === 'DISAHKAN').length;
  const pending = bookingsData.filter(b => b.status === 'MENUNGGU PENGESAHAN').length;
  const revenue = bookingsData.reduce((acc, b) => b.status === 'DISAHKAN' ? acc + (b.totalPayment || 0) : acc, 0);

  const elTotal = document.getElementById('stat-total');
  const elConfirmed = document.getElementById('stat-confirmed');
  const elPending = document.getElementById('stat-pending');
  const elRevenue = document.getElementById('stat-revenue');

  if (elTotal) elTotal.innerText = total;
  if (elConfirmed) elConfirmed.innerText = confirmed;
  if (elPending) elPending.innerText = pending;
  if (elRevenue) elRevenue.innerText = `RM ${revenue.toLocaleString()}`;
}

// FullCalendar Setup (Displays "🏠 Tempahan Saya" ONLY for current user's bookings, and "🔴 Telah Ditempah" for others)
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

    // Add end date + 1 for fullcalendar inclusive visual end date
    const endDate = new Date(b.checkOutDate);
    endDate.setDate(endDate.getDate() + 1);

    let eventTitle = '';
    if (isAdmin) {
      eventTitle = `${isConfirmed ? '🏠 [DISAHKAN]' : '⏳ [MENUNGGU]'} ${b.guestName}`;
    } else if (isMyBooking) {
      eventTitle = `🏠 Tempahan Saya (${isConfirmed ? 'Disahkan' : 'Menunggu'})`;
    } else {
      eventTitle = `🔴 Telah Ditempah`;
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

  // Strict inclusive conflict check against existing bookings
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
  // Always clear previous booking form inputs to prevent stale date conflict triggers
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

function calculateBookingPrice() {
  const checkinVal = document.getElementById('book-checkin')?.value;
  const checkoutVal = document.getElementById('book-checkout')?.value;
  const submitBtn = document.getElementById('btn-submit-booking');
  const isAdmin = currentUser && currentUser.role === 'admin';

  if (!checkinVal || !checkoutVal) {
    const elNights = document.getElementById('calc-nights');
    const elTotal = document.getElementById('calc-total');
    const elBalance = document.getElementById('calc-balance');
    if (elNights) elNights.innerText = '0';
    if (elTotal) elTotal.innerText = 'RM 0.00';
    if (elBalance) elBalance.innerText = 'RM 0.00';
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

  // Strict inclusive conflict check against existing non-cancelled bookings
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
  const rate = 350;
  const deposit = 100;
  const total = nights * rate;
  const balance = total - deposit;

  const elNights = document.getElementById('calc-nights');
  const elTotal = document.getElementById('calc-total');
  const elBalance = document.getElementById('calc-balance');

  if (elNights) elNights.innerText = nights;
  if (elTotal) elTotal.innerText = `RM ${total.toFixed(2)}`;
  if (elBalance) elBalance.innerText = `RM ${balance.toFixed(2)}`;
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

  // Strict numeric validation for guest count
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

  // Pre-check for date conflict before calling API
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
        paymentMethod: selectedPaymentMethod
      })
    });

    const data = await res.json();
    if (data.success) {
      closeModal('modal-booking');
      await fetchBookings();

      if (selectedPaymentMethod === 'Tunai') {
        alert('🎉 Tempahan Bayaran Tunai Berjaya! Rekod tempahan anda kini dipaparkan di senarai tempahan.');
        switchTab('my-bookings');
      } else {
        activePendingUploadBookingId = data.booking.id;
        openPaymentModal(data.booking.id, selectedPaymentMethod);
        alert('⚠️ Tempahan anda berjaya didaftarkan! Sila muat naik bukti pembayaran anda sekarang untuk melengkapkan tempahan.');
      }
    } else {
      alert(data.message || 'Tempahan gagal dibuat.');
    }
  } catch (err) {
    console.error(err);
    alert('Ralat pelayan semasa membuat tempahan.');
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

  if (bankRefId) bankRefId.innerText = bookingId;

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

async function handleUploadProofSubmit(e) {
  e.preventDefault();
  const bookingId = document.getElementById('upload-booking-id').value;
  const fileInput = document.getElementById('proof-file');

  if (!fileInput.files || fileInput.files.length === 0) {
    alert('Sila pilih fail bukti bayaran.');
    return;
  }

  const formData = new FormData();
  formData.append('proofImage', fileInput.files[0]);

  try {
    const res = await fetch(`${API_BASE}/api/bookings/${bookingId}/upload-proof`, {
      method: 'POST',
      body: formData
    });
    const data = await res.json();

    if (data.success) {
      activePendingUploadBookingId = null;
      closeModal('modal-payment');
      alert('🎉 Bukti pembayaran berjaya dimuat naik! Tempahan anda kini dipaparkan di senarai tempahan.');
      await fetchBookings();
      switchTab('my-bookings');
    } else {
      alert(data.message || 'Muat naik gagal.');
    }
  } catch (err) {
    console.error(err);
    alert('Ralat pelayan semasa memuat naik resit.');
  }
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

    const totalPay = b.nights * 350;
    const balancePay = totalPay - 100;

    // Show receipt button only if proof image exists OR status is confirmed OR method is cash
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
          <div>Jumlah: <strong>RM ${totalPay}</strong></div>
          <div class="text-emerald-600">Deposit: RM 100</div>
          <div class="text-navy-900 font-semibold">Baki: RM ${balancePay}</div>
        </td>
        <td class="p-3">
          <span class="px-2.5 py-1 rounded-full text-xs font-bold border ${statusClass}">${b.status}</span>
        </td>
        <td class="p-3 text-center">
          <div class="flex items-center justify-center gap-1.5">
            ${b.proofImage ? `
              <button onclick="viewProofModal('${b.id}')" title="Semak Bukti Bayaran" class="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100">
                <i data-lucide="image" class="w-4 h-4"></i>
              </button>
            ` : ''}
            <button onclick="openWhatsAppModal('${b.id}')" title="Jana WhatsApp" class="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg hover:bg-emerald-100">
              <i data-lucide="message-square" class="w-4 h-4"></i>
            </button>
            ${showReceiptBtn ? `
              <button onclick="printReceiptDoc('${b.id}')" title="Cetak Resit" class="p-1.5 bg-navy-900 text-gold-500 rounded-lg hover:bg-navy-800">
                <i data-lucide="receipt" class="w-4 h-4"></i>
              </button>
              <button onclick="printInvoiceDoc('${b.id}')" title="Cetak Invois" class="p-1.5 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200">
                <i data-lucide="file-text" class="w-4 h-4"></i>
              </button>
            ` : ''}
            <button onclick="deleteBooking('${b.id}')" title="Padam Tempahan" class="p-1.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-100">
              <i data-lucide="trash-2" class="w-4 h-4"></i>
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  safeRenderIcons();
}

// Render Penyewa My Bookings List (NO delete button on completed bookings)
function renderMyBookings() {
  const container = document.getElementById('my-bookings-container');
  if (!container) return;

  if (!currentUser) {
    container.innerHTML = `<div class="col-span-2 text-center py-8 text-slate-400">Sila log masuk untuk melihat rekod tempahan anda.</div>`;
    return;
  }

  // Filter user bookings strictly using helper
  const userBookings = bookingsData.filter(b => isBookingOwnedByUser(b, currentUser));

  // Separate valid/visible bookings (has proof OR is Cash OR is confirmed)
  const validBookings = userBookings.filter(b => b.proofImage || b.paymentMethod === 'Tunai' || b.status === 'DISAHKAN');

  // Pending upload bookings (QR/Online Transfer without proof)
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

  // Render Pending Upload Section with BOTH Upload and Delete buttons
  if (pendingUploadBookings.length > 0) {
    html += `
      <div class="col-span-2 bg-red-50 border-2 border-red-300 p-4 rounded-2xl space-y-3 text-red-900">
        <div class="flex items-center justify-between">
          <div class="flex items-center gap-2 text-xs font-bold text-red-700 uppercase tracking-wider">
            <i data-lucide="alert-triangle" class="w-5 h-5 text-red-600 shrink-0"></i>
            <span>Tempahan Belum Selesai (Memerlukan Bukti Bayaran):</span>
          </div>
          <span class="text-[11px] text-red-600 font-semibold">Boleh muat naik resit atau padam untuk kosongkan tarikh</span>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          ${pendingUploadBookings.map(b => `
            <div class="bg-white p-3.5 rounded-xl border border-red-200 shadow-sm text-xs text-slate-800 space-y-2">
              <div class="flex justify-between items-center border-b border-slate-100 pb-1.5">
                <span class="font-bold text-navy-900">${b.id} (${b.paymentMethod || 'Online Transfer'})</span>
                <span class="bg-red-100 text-red-700 font-bold px-2 py-0.5 rounded text-[10px]">Belum Naik Resit</span>
              </div>
              <p>📅 <strong>Tarikh:</strong> ${formatMalayDate(b.checkInDate)} - ${formatMalayDate(b.checkOutDate)}</p>
              <p>💰 <strong>Jumlah:</strong> RM ${b.nights * 350}</p>
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

  // Render valid/submitted bookings WITHOUT delete button for Penyewa
  html += validBookings.map(b => {
    let statusBadge = `<span class="bg-amber-100 text-amber-800 px-2.5 py-1 rounded-full text-xs font-bold">⏳ Menunggu Pengesahan</span>`;
    if (b.status === 'DISAHKAN') {
      statusBadge = `<span class="bg-emerald-100 text-emerald-800 px-2.5 py-1 rounded-full text-xs font-bold">🎉 DISAHKAN</span>`;
    }

    const totalPay = b.nights * 350;
    const balancePay = totalPay - 100;

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
          <p>💰 <strong>Jumlah:</strong> RM ${totalPay} | Deposit: RM 100 | <strong>Baki: RM ${balancePay}</strong></p>
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

// Proof View Modal (Admin)
function viewProofModal(bookingId) {
  activeProofBookingId = bookingId;
  const booking = bookingsData.find(b => b.id === bookingId);
  if (!booking) return;

  const totalPay = booking.nights * 350;

  document.getElementById('pv-guest-name').innerText = booking.guestName;
  document.getElementById('pv-amount').innerText = totalPay;
  document.getElementById('pv-phone').innerText = booking.guestPhone;

  const imgContainer = document.getElementById('proof-image-container');
  if (booking.proofImage) {
    const proofImgUrl = booking.proofImage.startsWith('http') ? booking.proofImage : `${API_BASE}${booking.proofImage}`;
    imgContainer.innerHTML = `<img src="${proofImgUrl}" alt="Bukti Bayaran" class="max-h-64 object-contain mx-auto rounded-lg">`;
  } else {
    imgContainer.innerHTML = `<p class="text-xs text-slate-400 py-10">Tiada fail bukti dimuat naik.</p>`;
  }

  openModal('modal-proof-view');
}

async function approveBookingStatus(newStatus) {
  if (!activeProofBookingId) return;
  try {
    const res = await fetch(`${API_BASE}/api/bookings/${activeProofBookingId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        status: newStatus,
        depositReceived: newStatus === 'DISAHKAN',
        fullPaymentReceived: newStatus === 'DISAHKAN',
        paymentDate: new Date().toISOString().split('T')[0]
      })
    });
    const data = await res.json();
    if (data.success) {
      closeModal('modal-proof-view');
      alert(`Status tempahan berjaya dikemaskini kepada: ${newStatus}`);
      await fetchBookings();
    }
  } catch (err) {
    console.error(err);
  }
}

// WhatsApp Generator Modal
function openWhatsAppModal(bookingId) {
  const b = bookingsData.find(x => x.id === bookingId);
  if (!b) return;

  const formattedIn = formatMalayDate(b.checkInDate);
  const formattedOut = formatMalayDate(b.checkOutDate);

  const totalPay = b.nights * 350;
  const depositPay = 100;
  const balancePay = totalPay - depositPay;

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

💰 Jumlah Bayaran: RM ${totalPay} 
✅ Deposit Sekuriti Diterima: RM ${depositPay}
💵 Baki Bayaran: RM ${balancePay}

📍 Lokasi homestay, panduan check-in dan maklumat pengambilan kunci akan dihantar sehari sebelum tarikh penginapan.

Peraturan Ringkas Homestay
* Dilarang merokok di dalam rumah.
* Tidak dibenarkan mengadakan parti atau membuat bising yang mengganggu jiran.
* Sila jaga kebersihan serta semua kemudahan yang disediakan.
* Sebarang kerosakan hendaklah dimaklumkan kepada pihak pengurusan.

Jika terdapat sebarang pertanyaan atau perubahan tempahan, sila hubungi kami di [0192298176].

Terima kasih kerana memilih SofiaRizqi Homestay. Kami mengalu-alukan kedatangan anda dan berharap anda mendapat pengalaman penginapan yang selesa. 😊`;

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
    const data = await res.json();
    if (data.success) {
      alert(`🎉 Tempahan ${bookingId} telah dipadam dan tarikh telah dikosongkan!`);
      await fetchBookings();
    }
  } catch (err) {
    console.error(err);
  }
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

  // Live update receipt preview instantly!
  const html = renderOfficialDocHTML(activeReceiptType, booking);
  document.getElementById('print-container').innerHTML = html;
  renderBookingsTable();
  renderMyBookings();
}

function triggerPrintDoc() {
  window.print();
}

// Full-size Official Document Renderer matching initial format while fitting 100% inside 1 A4 page
function renderOfficialDocHTML(docTitle, b) {
  const docNo = docTitle.includes('INVOIS') ? b.invoiceNo : b.receiptNo;
  const dateFormatted = b.paymentDate ? formatShortDate(b.paymentDate) : formatShortDate(new Date());

  const totalAmount = b.nights * 350;
  const depositAmount = 100;
  const balanceAmount = totalAmount - depositAmount;

  // Flexible Case-Insensitive payment method detection
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
    <div id="print-area" class="receipt-box text-slate-800 font-sans" style="line-height: 1.5;">
      <!-- HEADER -->
      <table class="receipt-header-table mb-3">
        <tr>
          <td style="width: 100px; vertical-align: middle;">
            <div style="width: 85px; height: 85px; border-radius: 50%; border: 3px solid #daa520; background: #0f2444; color: white; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; padding: 3px;">
              <span style="font-size: 11px; font-weight: bold; color: #daa520;">SofiaRizqi</span>
              <span style="font-size: 7px; letter-spacing: 1px;">HOMESTAY</span>
              <span style="font-size: 5px; color: #cbd5e1; margin-top: 1px;">SELESA • BERSIH • MESRA</span>
            </div>
          </td>
          <td style="vertical-align: middle; padding-left: 8px;">
            <h2 style="font-size: 19px; font-weight: bold; color: #0f2444; margin: 0; font-family: Georgia, serif; text-transform: uppercase;">${docTitle}</h2>
            <h3 style="font-size: 13px; font-weight: bold; color: #daa520; margin: 1px 0 6px 0; font-family: Georgia, serif;">SOFIA RIZQI HOMESTAY</h3>
            <div style="font-size: 11px; color: #334155; line-height: 1.4;">
              📍 No. 14, Jalan Desa Seroja 3, Taman Desa Seroja, 09100 Baling, Kedah.<br>
              📞 019-229 8176
            </div>
          </td>
          <td style="width: 170px; vertical-align: top;">
            <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
              <tr>
                <td class="receipt-navy-bar" style="text-align: center; padding: 3px 6px;">${docTitle.includes('INVOIS') ? 'NO. INVOIS' : 'NO. RESIT'}</td>
              </tr>
              <tr>
                <td style="border: 1px solid #0f2444; text-align: center; padding: 3px; font-weight: bold; background: #f8fafc;">${docNo}</td>
              </tr>
              <tr>
                <td class="receipt-navy-bar" style="text-align: center; padding: 3px 6px; margin-top: 3px;">TARIKH</td>
              </tr>
              <tr>
                <td style="border: 1px solid #0f2444; text-align: center; padding: 3px; background: #f8fafc;">${dateFormatted}</td>
              </tr>
              <tr>
                <td class="receipt-navy-bar" style="text-align: center; padding: 3px 6px; margin-top: 3px;">KAEDAH PEMBAYARAN</td>
              </tr>
              <tr>
                <td style="border: 1px solid #0f2444; text-align: center; padding: 3px; background: #f8fafc; font-weight: bold; color: #0f2444;">${displayMethodName}</td>
              </tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- MAKLUMAT PELANGGAN & TEMPAHAN -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px;">
        <tr>
          <td style="width: 50%; vertical-align: top; padding-right: 6px;">
            <div class="receipt-navy-bar mb-1" style="padding: 3px 8px;">MAKLUMAT PELANGGAN</div>
            <table style="width: 100%; border-collapse: collapse; line-height: 1.6;">
              <tr><td style="width: 80px; font-weight: bold;">Nama</td><td>: ${b.guestName}</td></tr>
              <tr><td style="font-weight: bold;">No. Telefon</td><td>: ${b.guestPhone}</td></tr>
              <tr><td style="font-weight: bold; vertical-align: top;">Alamat</td><td>: ${b.guestAddress || '-'}</td></tr>
            </table>
          </td>
          <td style="width: 50%; vertical-align: top; padding-left: 6px;">
            <div class="receipt-navy-bar mb-1" style="padding: 3px 8px;">MAKLUMAT TEMPAHAN</div>
            <table style="width: 100%; border-collapse: collapse; line-height: 1.6;">
              <tr><td style="width: 105px; font-weight: bold;">Tarikh Check-in</td><td>: ${formatMalayDate(b.checkInDate)}</td></tr>
              <tr><td style="font-weight: bold;">Tarikh Check-out</td><td>: ${formatMalayDate(b.checkOutDate)}</td></tr>
              <tr><td style="font-weight: bold;">Bilangan Tetamu</td><td>: ${b.guestCount}</td></tr>
              <tr><td style="font-weight: bold;">Tujuan Penginapan</td><td>: ${b.purpose || 'Percutian'}</td></tr>
            </table>
          </td>
        </tr>
      </table>

      <!-- TABLE PERINCIAN -->
      <table class="receipt-table mb-3" style="font-size: 11px;">
        <thead>
          <tr>
            <th style="width: 70%; padding: 5px 8px;">PERINCIAN</th>
            <th style="width: 30%; padding: 5px 8px;">JUMLAH (RM)</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td style="padding: 5px 8px;">1. Jumlah Penginapan (${b.nights} Malam × RM 350.00)</td>
            <td style="text-align: right; font-weight: bold; padding: 5px 8px;">RM ${totalAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 8px;">2. Deposit Diterima</td>
            <td style="text-align: right; font-weight: bold; color: #166534; padding: 5px 8px;">RM ${depositAmount.toFixed(2)}</td>
          </tr>
          <tr>
            <td style="padding: 5px 8px;">3. Baki Bayaran</td>
            <td style="text-align: right; font-weight: bold; padding: 5px 8px;">RM ${balanceAmount.toFixed(2)}</td>
          </tr>
          <tr class="receipt-total-row" style="font-size: 12px;">
            <td style="text-align: right; text-transform: uppercase; padding: 6px 8px;">JUMLAH PERLU DIJELASKAN</td>
            <td style="text-align: right; font-size: 13px; color: #0f2444; padding: 6px 8px;">RM ${balanceAmount.toFixed(2)}</td>
          </tr>
        </tbody>
      </table>

      <!-- STATUS & SUMBANGAN -->
      <table style="width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: 11px;">
        <tr>
          <td style="width: 48%; vertical-align: top; padding-right: 6px;">
            <div class="receipt-navy-bar mb-1" style="padding: 3px 8px;">STATUS PEMBAYARAN</div>
            <div style="border: 1px solid #0f2444; padding: 8px; border-radius: 4px; background: #f8fafc; line-height: 1.6;">
              <div>[ ${b.depositReceived ? '✓' : ' '} ] Deposit Diterima</div>
              <div>[ ${b.fullPaymentReceived ? '✓' : ' '} ] Bayaran Penuh Diterima</div>
              <div style="margin-top: 4px;">Tarikh Terima Bayaran : <strong>${dateFormatted}</strong></div>
              <div>Diterima Oleh : <strong>${b.receivedBy || 'RAHMAN'}</strong></div>
            </div>
          </td>
          <td style="width: 52%; vertical-align: top; padding-left: 6px;">
            <div class="receipt-navy-bar mb-1" style="padding: 3px 8px;">SUMBANGAN TERIMA KASIH</div>
            <div style="border: 1px solid #0f2444; padding: 8px; border-radius: 4px; background: #fffdf5; text-align: center; line-height: 1.4;">
              Terima kasih kerana memilih Sofia Rizqi Homestay.<br>
              Kami amat menghargai kepercayaan anda. Semoga penginapan anda selesa dan bermakna bersama kami.<br>
              <div style="font-family: Georgia, serif; font-size: 12px; color: #daa520; font-weight: bold; margin-top: 4px;">
                Selamat Datang & Terima Kasih! 💕
              </div>
            </div>
          </td>
        </tr>
      </table>

      <!-- KAEDAH & TANDATANGAN -->
      <table style="width: 100%; border-collapse: collapse; font-size: 11px;">
        <tr>
          <td style="width: 48%; vertical-align: top; padding-right: 6px;">
            <div class="receipt-navy-bar mb-1" style="padding: 3px 8px;">KAEDAH PEMBAYARAN</div>
            <div style="border: 1px solid #0f2444; padding: 6px; border-radius: 4px; line-height: 1.6; font-weight: bold;">
              <div style="${isOnline ? 'color: #0f2444; font-weight: bold;' : 'color: #64748b; font-weight: normal;'}">( ${isOnline ? '●' : '○'} ) Online Transfer</div>
              <div style="${isTunai ? 'color: #0f2444; font-weight: bold;' : 'color: #64748b; font-weight: normal;'}">( ${isTunai ? '●' : '○'} ) Tunai</div>
              <div style="${isQR ? 'color: #0f2444; font-weight: bold;' : 'color: #64748b; font-weight: normal;'}">( ${isQR ? '●' : '○'} ) QR DuitNow</div>
              <div style="${isOther ? 'color: #0f2444; font-weight: bold;' : 'color: #64748b; font-weight: normal;'}">( ${isOther ? '●' : '○'} ) Lain-lain</div>
            </div>
          </td>
          <td style="width: 52%; vertical-align: top; padding-left: 6px;">
            <div class="receipt-navy-bar mb-1" style="padding: 3px 8px;">TANDATANGAN / COP</div>
            <div style="border: 1px solid #0f2444; padding: 6px; border-radius: 4px; text-align: center; height: 58px; display: flex; flex-direction: column; justify-content: space-between;">
              <div style="font-family: 'Brush Script MT', cursive, Georgia; font-size: 16px; color: #0f2444;">Sofia Rizqi</div>
              <div style="border-top: 1px dashed #94a3b8; font-size: 9px; padding-top: 1px; color: #475569;">Sofia Rizqi Homestay</div>
            </div>
          </td>
        </tr>
      </table>

      <!-- FOOTER BANNER -->
      <div style="margin-top: 12px; background: #0f2444; color: white; padding: 6px 10px; display: flex; justify-between; align-items: center; font-size: 9.5px; border-radius: 4px;">
        <div><strong>SELESA</strong> • Penginapan selesa seperti di rumah sendiri</div>
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
