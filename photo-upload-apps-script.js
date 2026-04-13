// ============================================================
// Google Apps Script — Photo Upload to Google Drive
// ============================================================
// SETUP INSTRUCTIONS:
// 1. Go to https://script.google.com and create a new project
// 2. Paste this entire file into the Code.gs editor
// 3. Replace FOLDER_ID below with your Google Drive folder ID
//    (create a folder called "Wedding Photos" in Drive, open it,
//     and copy the ID from the URL: drive.google.com/drive/folders/FOLDER_ID)
// 4. Click Deploy > New deployment
//    - Type: Web app
//    - Execute as: Me (your Google account)
//    - Who has access: Anyone
// 5. Copy the deployment URL and paste it into index.html where
//    indicated (PHOTO_SCRIPT_URL constant)
// 6. IMPORTANT: Every time you edit this script, you must create
//    a NEW deployment version for changes to take effect.
// ============================================================

const FOLDER_ID = 'YOUR_GOOGLE_DRIVE_FOLDER_ID_HERE';

/**
 * Handles POST requests — receives base64-encoded photos and saves to Drive.
 * Expects JSON body: { uploaderName: string, files: [{ data: string, name: string, type: string }] }
 */
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const folder = DriveApp.getFolderById(FOLDER_ID);
    const uploaderName = (body.uploaderName || 'Anonymous').replace(/[^a-zA-Z0-9_\- ]/g, '');
    const timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd_HH-mm-ss');
    const results = [];

    const files = body.files || [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const base64Data = file.data.split(',').pop(); // strip data URL prefix if present
      const decoded = Utilities.base64Decode(base64Data);
      const blob = Utilities.newBlob(decoded, file.type || 'image/jpeg');

      // Name: timestamp_uploaderName_001.ext
      const ext = (file.name || 'photo.jpg').split('.').pop();
      const safeName = timestamp + '_' + uploaderName + '_' + String(i + 1).padStart(3, '0') + '.' + ext;
      blob.setName(safeName);

      const created = folder.createFile(blob);
      results.push({ name: safeName, id: created.getId() });
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 'ok', count: results.length, files: results }))
      .setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 'error', message: err.toString() }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Handles GET requests — not used for now, but could serve photo URLs later.
 */
function doGet(e) {
  return ContentService
    .createTextOutput(JSON.stringify({ status: 'ok', message: 'Photo upload endpoint is live.' }))
    .setMimeType(ContentService.MimeType.JSON);
}
