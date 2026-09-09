// ==========================================================================
// FAIL TETAPAN UTAMA HOMESTAY (CONFIG.JS)
// ==========================================================================
const HOMESTAY_CONFIG = {
  id: "sofia",
  name: "SofiaRizqi Homestay",
  tagline: "Selesa, Bersih & Mesra",
  address: "No. 14, Jalan Desa Seroja 3, Taman Desa Seroja, 09100 Baling, Kedah.",
  adminName: "Pengurusan SofiaRizqi",
  adminPhone: "0192298176",
  bankName: "Bank Islam Malaysia Berhad",
  accountNumber: "02021010041234",
  accountHolder: "Sofia Rizqi Homestay",
  qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=SofiaRizqiHomestayBankIslam",
  defaultRatePerNight: 350,
  defaultSecurityDeposit: 100,
  syncChannel: "sofia_homestay_sync_v1",
  receiptsChannel: "sofia_homestay_receipts_v1"
};

if (typeof window !== 'undefined') {
  window.HOMESTAY_CONFIG = HOMESTAY_CONFIG;
}
