const express = require('express');
const fs = require('fs');
const path = require('path');
const multer = require('multer');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from root and public directories
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.static(__dirname));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// File paths
const DATA_DIR = path.join(__dirname, 'data');
const BOOKINGS_FILE = path.join(DATA_DIR, 'bookings.json');
const USERS_FILE = path.join(DATA_DIR, 'users.json');
const UPLOADS_DIR = path.join(__dirname, 'uploads');

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// Multer storage configuration for proof of payment
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `proof_${req.params.id || Date.now()}_${Date.now()}${ext}`);
  }
});
const upload = multer({ storage });

// Helper functions for reading/writing JSON
function readJSON(filePath) {
  try {
    if (!fs.existsSync(filePath)) return [];
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data || '[]');
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return [];
  }
}

function writeJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

// Check date overlap function (Inclusive check to block same-day check-in/check-out overlap)
function isDateOverlapping(start1, end1, start2, end2) {
  const dStart1 = new Date(start1);
  const dEnd1 = new Date(end1);
  const dStart2 = new Date(start2);
  const dEnd2 = new Date(end2);
  return dStart1 <= dEnd2 && dEnd1 >= dStart2;
}

// API Routes

// --- Auth Routes ---
app.post('/api/auth/login', (req, res) => {
  const { username, phone, password } = req.body;
  const users = readJSON(USERS_FILE);

  // Admin login check
  if (username === 'admin' || phone === 'admin') {
    const admin = users.find(u => u.role === 'admin' && (u.username === username || u.phone === phone));
    if (admin && admin.password === password) {
      return res.json({ success: true, user: admin });
    }
    return res.status(401).json({ success: false, message: 'ID Admin atau Kata Laluan Salah!' });
  }

  // Penyewa login check
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const user = users.find(u => {
    const p = (u.phone || '').replace(/\D/g, '');
    return (p === cleanPhone || u.phone === phone || u.username === username) && u.password === password;
  });

  if (user) {
    return res.json({ success: true, user });
  }
  return res.status(401).json({ success: false, message: 'No. Telefon / ID atau Kata Laluan Salah! Jika anda pengguna baharu, sila daftar dahulu.' });
});

app.post('/api/auth/register', (req, res) => {
  const { name, phone, ic, email, address, password } = req.body;
  if (!name || !phone || !password) {
    return res.status(400).json({ success: false, message: 'Sila lengkapkan Nama, No. Telefon dan Kata Laluan!' });
  }

  const users = readJSON(USERS_FILE);
  const cleanPhone = phone.replace(/\D/g, '');
  const existing = users.find(u => (u.phone || '').replace(/\D/g, '') === cleanPhone);

  if (existing) {
    return res.status(400).json({ success: false, message: 'No. Telefon ini telah pun berdaftar. Sila log masuk!' });
  }

  const newUser = {
    id: `USR-${Date.now().toString().slice(-4)}`,
    role: 'penyewa',
    name,
    phone,
    ic: ic || '',
    email: email || '',
    address: address || '',
    password
  };

  users.push(newUser);
  writeJSON(USERS_FILE, users);
  res.json({ success: true, user: newUser, message: 'Pendaftaran Berjaya!' });
});

// --- User Management Routes ---
app.get('/api/users', (req, res) => {
  const users = readJSON(USERS_FILE);
  res.json(users);
});

app.put('/api/users/:id', (req, res) => {
  const users = readJSON(USERS_FILE);
  const index = users.findIndex(u => u.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Pengguna tidak dijumpai!' });

  const updatedUser = { ...users[index], ...req.body };
  users[index] = updatedUser;
  writeJSON(USERS_FILE, users);

  res.json({ success: true, user: updatedUser, message: 'Maklumat pengguna berjaya dikemaskini!' });
});

app.put('/api/users/:id/reset-password', (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return res.status(400).json({ success: false, message: 'Sila masukkan kata laluan baharu!' });

  const users = readJSON(USERS_FILE);
  const user = users.find(u => u.id === req.params.id);
  if (!user) return res.status(404).json({ success: false, message: 'Pengguna tidak dijumpai!' });

  user.password = newPassword;
  writeJSON(USERS_FILE, users);

  res.json({ success: true, user, message: `Kata laluan untuk ${user.name} berjaya di-reset!` });
});

app.delete('/api/users/:id', (req, res) => {
  let users = readJSON(USERS_FILE);
  const filtered = users.filter(u => u.id !== req.params.id);
  writeJSON(USERS_FILE, filtered);
  res.json({ success: true, message: 'Pengguna berjaya dipadam!' });
});

// --- Booking Routes ---
app.get('/api/bookings', (req, res) => {
  const { userId } = req.query;
  let bookings = readJSON(BOOKINGS_FILE);
  if (userId) {
    bookings = bookings.filter(b => b.userId === userId);
  }
  res.json(bookings);
});

app.get('/api/bookings/:id', (req, res) => {
  const bookings = readJSON(BOOKINGS_FILE);
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Tempahan tidak dijumpai!' });
  res.json(booking);
});

// Create new booking with conflict check
app.post('/api/bookings', (req, res) => {
  const {
    userId, guestName, guestPhone, guestAddress,
    checkInDate, checkOutDate, guestCount, vehicleNumbers, purpose, paymentMethod
  } = req.body;

  if (!guestName || !guestPhone || !checkInDate || !checkOutDate) {
    return res.status(400).json({ success: false, message: 'Sila lengkapkan semua maklumat tempahan!' });
  }

  const bookings = readJSON(BOOKINGS_FILE);

  // Check date collision against all active/pending/confirmed bookings
  const conflict = bookings.find(b => {
    if (b.status === 'BATAL' || b.status === 'DITOLAK') return false;
    return isDateOverlapping(checkInDate, checkOutDate, b.checkInDate, b.checkOutDate);
  });

  if (conflict) {
    return res.status(400).json({
      success: false,
      message: `Maaf, tarikh dari ${checkInDate} hingga ${checkOutDate} telah pun ditempah! Sila pilih tarikh lain.`
    });
  }

  // Calculate nights & exact amounts
  const dIn = new Date(checkInDate);
  const dOut = new Date(checkOutDate);
  const diffTime = Math.abs(dOut - dIn);
  const nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) || 1;

  const ratePerNight = 350;
  const securityDeposit = 100;
  const accommodationTotal = nights * ratePerNight;
  const grandTotal = accommodationTotal + securityDeposit;

  const randomNum = Math.floor(1000 + Math.random() * 9000);
  const newBookingId = `SRH${randomNum}`;
  const seqNo = String(bookings.length + 1).padStart(4, '0');

  const selectedPaymentMethod = paymentMethod || 'QR DuitNow';
  const isCash = selectedPaymentMethod === 'Tunai';

  const userPaid = req.body.paidAmount ? parseFloat(req.body.paidAmount) : (isCash ? grandTotal : 0);
  const balancePayment = Math.max(0, grandTotal - userPaid);

  const newBooking = {
    id: newBookingId,
    receiptNo: `SRH-${seqNo}`,
    invoiceNo: `INV-${seqNo}`,
    userId: userId || `USR-GUEST`,
    guestName,
    guestPhone,
    guestAddress: guestAddress || '',
    homestayName: 'SofiaRizqi Homestay',
    checkInDate,
    checkInTime: '2 petang',
    checkOutDate,
    checkOutTime: '12.00 Tengahari',
    guestCount: guestCount || '1 dewasa',
    vehicleNumbers: vehicleNumbers || '-',
    purpose: purpose || 'Penginapan Homestay',
    nights,
    ratePerNight,
    accommodationTotal,
    securityDeposit,
    grandTotal,
    paidAmount: userPaid,
    totalPayment: grandTotal,
    balancePayment,
    paymentMethod: selectedPaymentMethod,
    status: isCash ? 'DISAHKAN' : 'MENUNGGU PENGESAHAN',
    depositReceived: isCash || userPaid >= 100,
    fullPaymentReceived: isCash || balancePayment <= 0,
    paymentDate: new Date().toISOString().split('T')[0],
    receivedBy: 'Pengurusan SofiaRizqi',
    proofImage: '',
    createdAt: new Date().toISOString()
  };

  bookings.push(newBooking);
  writeJSON(BOOKINGS_FILE, bookings);

  res.json({ success: true, booking: newBooking, message: isCash ? 'Tempahan Tunai Berjaya Disahkan!' : 'Tempahan berjaya dibuat! Sila teruskan pembayaran.' });
});

// Update booking
app.put('/api/bookings/:id', (req, res) => {
  const bookings = readJSON(BOOKINGS_FILE);
  const index = bookings.findIndex(b => b.id === req.params.id);
  if (index === -1) return res.status(404).json({ success: false, message: 'Tempahan tidak dijumpai!' });

  const updatedBooking = { ...bookings[index], ...req.body };
  bookings[index] = updatedBooking;
  writeJSON(BOOKINGS_FILE, bookings);

  res.json({ success: true, booking: updatedBooking, message: 'Maklumat tempahan berjaya dikemaskini!' });
});

// Delete booking
app.delete('/api/bookings/:id', (req, res) => {
  let bookings = readJSON(BOOKINGS_FILE);
  const filtered = bookings.filter(b => b.id !== req.params.id);
  if (bookings.length === filtered.length) {
    return res.status(404).json({ success: false, message: 'Tempahan tidak dijumpai!' });
  }
  writeJSON(BOOKINGS_FILE, filtered);
  res.json({ success: true, message: 'Tempahan berjaya dipadam!' });
});

// Upload proof of payment
app.post('/api/bookings/:id/upload-proof', upload.single('proofImage'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Sila pilih fail imej bukti pembayaran!' });
  }
  const bookings = readJSON(BOOKINGS_FILE);
  const booking = bookings.find(b => b.id === req.params.id);
  if (!booking) return res.status(404).json({ success: false, message: 'Tempahan tidak dijumpai!' });

  booking.proofImage = `/uploads/${req.file.filename}`;
  if (req.body.paidAmount) {
    booking.paidAmount = parseFloat(req.body.paidAmount);
  }
  booking.accommodationTotal = booking.nights * 350;
  booking.securityDeposit = 100;
  booking.grandTotal = booking.accommodationTotal + 100;
  if (booking.paidAmount === undefined || booking.paidAmount === null) {
    booking.paidAmount = 100;
  }
  booking.balancePayment = Math.max(0, booking.grandTotal - booking.paidAmount);
  booking.depositReceived = booking.paidAmount >= 100;
  booking.fullPaymentReceived = booking.balancePayment <= 0;
  booking.status = 'MENUNGGU PENGESAHAN';

  writeJSON(BOOKINGS_FILE, bookings);

  res.json({ success: true, proofImage: booking.proofImage, booking, message: 'Bukti pembayaran berjaya dimuat naik!' });
});

// Fallback route to serve index.html
app.get('*', (req, res) => {
  if (fs.existsSync(path.join(__dirname, 'index.html'))) {
    res.sendFile(path.join(__dirname, 'index.html'));
  } else {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`====================================================`);
  console.log(`  SISTEM TEMPAHAN SOFIARIZQI HOMESTAY BERJAYA DILANCARKAN`);
  console.log(`  URL: http://localhost:${PORT}`);
  console.log(`====================================================`);
});
