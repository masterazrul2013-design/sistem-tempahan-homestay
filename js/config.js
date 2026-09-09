// ==========================================================================
// FAIL TETAPAN HOMESTAY PAK ALI (CONFIG.JS)
// ==========================================================================

const HOMESTAY_CONFIG = {
  // 1. Maklumat Homestay Pak Ali
  id: "ali",                                              // ID unik Pak Ali (jangan guna 'sofia')
  name: "Homestay Impian Pak Ali",                        // Nama Homestay Pak Ali
  tagline: "Selesa & Damai",
  address: "Lot 123, Kampung Simpang Tiga, 09100 Baling, Kedah.",

  // 2. Maklumat Admin Pak Ali
  adminName: "Pak Ali",
  adminPhone: "0139876543",                                // No WhatsApp Pak Ali

  // 3. Maklumat Bank & Bayaran Pak Ali
  bankName: "Maybank",                                    // Bank Pak Ali
  accountNumber: "152012345678",                          // No Akaun Pak Ali
  accountHolder: "Ali bin Hassan",
  qrCodeUrl: "https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=HomestayImpianPakAliMaybank",

  // 4. Kadar Harga Pak Ali
  defaultRatePerNight: 280,                                // Harga semalam Pak Ali (cth: RM 280)
  defaultSecurityDeposit: 100,                             // Deposit Pak Ali

  // 5. Saluran Sync Unik (PENTING: Pastikan berbeza daripada SofiaRizqi!)
  syncChannel: "pakali_homestay_sync_9912",               // Kod unik Pak Ali
  receiptsChannel: "pakali_homestay_receipts_9912"
};

if (typeof window !== 'undefined') {
  window.HOMESTAY_CONFIG = HOMESTAY_CONFIG;
}
