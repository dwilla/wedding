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

const FOLDER_ID = '1QQJXzzKFuJIWkmKRR75g5Th-cMojwJlv';

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
 * Handles GET requests — serves paginated photo listing from the Drive folder.
 *
 * Uses the Drive Advanced Service (Drive API v3) for fast server-side
 * filtering, sorting, and pagination. Only fetches the batch of files
 * needed for each page instead of iterating the entire folder.
 *
 * PREREQUISITE: Enable the Drive Advanced Service in the Apps Script editor:
 *   Services (+ button) > Drive API > Add
 *
 * Query parameters:
 *   action    — must be "getPhotos"
 *   pageSize  — photos per page (default 10, max 50)
 *   pageToken — cursor for the next page (returned as nextPageToken)
 *   callback  — (optional) JSONP callback function name
 *
 * Returns JSON (or JSONP if callback is provided):
 *   { status, photos: [...], nextPageToken, hasMore }
 *
 * IMPORTANT: The Google Drive folder (FOLDER_ID) must be shared as
 * "Anyone with the link can view" for the image URLs to work.
 */
function doGet(e) {
  try {
    var params = e && e.parameter ? e.parameter : {};
    var action = params.action || '';
    var callback = params.callback || '';

    if (action !== 'getPhotos') {
      return sendResponse({ status: 'ok', message: 'Photo upload endpoint is live.' }, callback);
    }

    var pageSize = Math.min(50, Math.max(1, parseInt(params.pageSize, 10) || 10));
    var pageToken = params.pageToken || null;

    // Use Drive Advanced Service for server-side query, sort, and pagination
    var query = "'" + FOLDER_ID + "' in parents"
              + " and mimeType contains 'image/'"
              + " and trashed = false";

    var options = {
      q: query,
      pageSize: pageSize,
      orderBy: 'createdTime desc',
      fields: 'nextPageToken, files(id, name, createdTime)',
      supportsAllDrives: true,
      includeItemsFromAllDrives: true
    };

    if (pageToken) {
      options.pageToken = pageToken;
    }

    var result = Drive.Files.list(options);
    var files = result.files || [];
    var nextToken = result.nextPageToken || null;

    var photos = files.map(function(f) {
      return {
        id: f.id,
        name: f.name,
        url: 'https://lh3.googleusercontent.com/d/' + f.id,
        thumbnailUrl: 'https://lh3.googleusercontent.com/d/' + f.id + '=w800',
        date: new Date(f.createdTime).getTime()
      };
    });

    return sendResponse({
      status: 'ok',
      photos: photos,
      nextPageToken: nextToken,
      hasMore: !!nextToken
    }, callback);

  } catch (err) {
    var cb = (e && e.parameter && e.parameter.callback) || '';
    return sendResponse({ status: 'error', message: err.toString() }, cb);
  }
}

/**
 * Wraps response as JSONP if a callback name is provided, otherwise returns plain JSON.
 */
function sendResponse(data, callback) {
  var json = JSON.stringify(data);
  if (callback) {
    return ContentService
      .createTextOutput(callback + '(' + json + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }
  return ContentService
    .createTextOutput(json)
    .setMimeType(ContentService.MimeType.JSON);
}
