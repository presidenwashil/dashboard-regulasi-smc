var CONFIG = {
  SHEET_DOCS: 'Database_Regulasi',
  SHEET_USERS: 'Users',
  SHEET_SOSIALISASI: 'Sosialisasi',
  SHEET_MASTER_BIDANG: 'MasterBidang',
  SESSION_SECONDS: 21600
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Dashboard Regulasi RS SMC')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}