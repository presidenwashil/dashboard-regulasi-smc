var SCHEMA = {
  Users: ['Timestamp', 'Nama', 'Profesi', 'Bidang', 'Unit', 'NRP', 'PasswordHash', 'Salt', 'Status', 'Role', 'UnitID'],
  MasterBidang: ['Bidang', 'BidangID'],
  MasterUnit: ['UnitID', 'Unit', 'BidangID'],
  Sosialisasi: ['Timestamp', 'NRP', 'Nama', 'DocRowIndex', 'JudulDokumen'],
  Database_Regulasi: ['Timestamp', 'Judul', 'Nomor', 'Jenis', 'Pemilik', 'Unit', 'Bidang', 'Status', 'Revisi', 'Tanggal', 'PDF', 'Word', 'Akreditasi', 'Keterangan', 'StatusBerlaku', 'UploaderNRP', 'UploaderBidang', 'BidangTargetIDs', 'UploaderBidangID']
};
