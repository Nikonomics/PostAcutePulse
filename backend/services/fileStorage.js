/**
 * Local File Storage Service
 * Handles saving and retrieving uploaded documents
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// Base upload directory - use Render disk mount path in production, local path in development
// Priority: 1) UPLOAD_DIR env var, 2) Render persistent disk, 3) Local development path
const getUploadDir = () => {
  if (process.env.UPLOAD_DIR) {
    return process.env.UPLOAD_DIR;
  }
  // Check for Render persistent disk
  if (fs.existsSync('/var/data/uploads')) {
    console.log('[FileStorage] Using Render persistent disk: /var/data/uploads');
    return '/var/data/uploads';
  }
  // Local development fallback
  return path.join(__dirname, '..', 'uploads');
};
const UPLOAD_DIR = getUploadDir();
console.log('[FileStorage] UPLOAD_DIR:', UPLOAD_DIR);

// Ensure upload directory exists
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

/**
 * Generate a unique filename
 */
function generateUniqueFilename(originalName) {
  const ext = path.extname(originalName);
  const baseName = path.basename(originalName, ext);
  const timestamp = Date.now();
  const randomStr = crypto.randomBytes(8).toString('hex');
  // Sanitize the base name
  const safeName = baseName.replace(/[^a-zA-Z0-9-_]/g, '_').substring(0, 50);
  return `${safeName}_${timestamp}_${randomStr}${ext}`;
}

/**
 * Save a file to local storage
 * @param {Buffer} fileBuffer - The file data
 * @param {string} originalName - Original filename
 * @param {string} dealId - Optional deal ID to organize files
 * @returns {Object} - File info including path and URL
 */
async function saveFile(fileBuffer, originalName, dealId = null) {
  try {
    // Create deal-specific subdirectory if dealId provided
    let targetDir = UPLOAD_DIR;
    if (dealId) {
      targetDir = path.join(UPLOAD_DIR, `deal_${dealId}`);
      if (!fs.existsSync(targetDir)) {
        fs.mkdirSync(targetDir, { recursive: true });
      }
    }

    const uniqueFilename = generateUniqueFilename(originalName);
    const filePath = path.join(targetDir, uniqueFilename);

    // Write file
    fs.writeFileSync(filePath, fileBuffer);

    // Generate relative path for URL
    const relativePath = dealId
      ? `deal_${dealId}/${uniqueFilename}`
      : uniqueFilename;

    return {
      success: true,
      filename: uniqueFilename,
      originalName: originalName,
      relativePath: relativePath,
      absolutePath: filePath,
      url: `/api/v1/files/${relativePath}`,
      size: fileBuffer.length
    };
  } catch (error) {
    console.error('File save error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Save multiple files
 */
async function saveFiles(files, dealId = null) {
  const results = [];
  for (const file of files) {
    const result = await saveFile(file.data, file.name, dealId);
    results.push({
      ...result,
      mimeType: file.mimetype
    });
  }
  return results;
}

/**
 * Get file by relative path
 */
function getFile(relativePath) {
  const filePath = path.join(UPLOAD_DIR, relativePath);

  if (!fs.existsSync(filePath)) {
    return null;
  }

  return {
    path: filePath,
    buffer: fs.readFileSync(filePath)
  };
}

/**
 * Delete a file
 */
function deleteFile(relativePath) {
  try {
    const filePath = path.join(UPLOAD_DIR, relativePath);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error('File delete error:', error);
    return false;
  }
}

/**
 * Get all files for a deal
 */
function getDealFiles(dealId) {
  const dealDir = path.join(UPLOAD_DIR, `deal_${dealId}`);

  if (!fs.existsSync(dealDir)) {
    return [];
  }

  const files = fs.readdirSync(dealDir);
  return files.map(filename => ({
    filename,
    relativePath: `deal_${dealId}/${filename}`,
    url: `/api/v1/files/deal_${dealId}/${filename}`
  }));
}

module.exports = {
  saveFile,
  saveFiles,
  getFile,
  deleteFile,
  getDealFiles,
  UPLOAD_DIR
};
