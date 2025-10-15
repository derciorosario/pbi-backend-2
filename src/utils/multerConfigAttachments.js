const multer = require('multer');
const AWS = require('aws-sdk');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Configure AWS
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION
});

const s3 = new AWS.S3();

// Ensure uploads directory exists for local storage
const uploadsDir = path.join(__dirname, '../../uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configure local storage
const localStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadsDir);
  },
  filename: function (req, file, cb) {
    // Create a unique filename with original extension
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext).replace(/\s+/g, '_'); // Replace spaces with underscores
    const filename = 'attachment-' + uniqueSuffix + '-' + basename + ext;
    cb(null, filename);
  }
});

// Custom dual storage engine - saves locally AND to S3
const dualStorage = {
  _handleFile: function (req, file, cb) {
    // First, save locally using multer's disk storage
    localStorage._handleFile(req, file, (error, fileInfo) => {
      if (error) {
        return cb(error);
      }

      // Create S3 filename (same as local but with folder structure)
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const ext = path.extname(file.originalname);
      const basename = path.basename(file.originalname, ext).replace(/\s+/g, '_');
      const s3Filename = `attachments/attachment-${uniqueSuffix}-${basename}${ext}`;

      // Read the locally saved file
      const localFilePath = path.join(uploadsDir, fileInfo.filename);
      const fileBuffer = fs.readFileSync(localFilePath);

      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Filename,
        Body: fileBuffer,
        Metadata: {
          fieldName: file.fieldname,
          originalName: file.originalname
        }
      };

      // Upload to S3
      s3.upload(params, (err, data) => {
        if (err) {
          console.error('S3 upload error:', err);
          // Don't fail the upload if S3 fails, just log it
        }

        // Use S3 URL for the saved file URL (if S3 upload succeeded)
        if (data && data.Location) {
          req.savedFileUrl = data.Location;
        } else {
          // Fallback to local URL if S3 upload failed
          req.savedFileUrl = `${process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`}/api/uploads/${fileInfo.filename}`;
        }

        cb(null, {
          filename: fileInfo.filename,
          path: req.savedFileUrl,
          size: fileInfo.size,
          mimetype: file.mimetype,
          url: req.savedFileUrl
        });
      });
    });
  },
  _removeFile: function (req, file, cb) {
    // Remove local file if it exists
    if (file.filename) {
      const localFilePath = path.join(uploadsDir, file.filename);
      fs.unlink(localFilePath, (err) => {
        if (err) console.error('Error removing local file:', err);
        cb(null);
      });
    } else {
      cb(null);
    }
  }
};

// File filter to allow images and documents
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    // Documents
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'text/csv'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not allowed. Only images and documents are permitted.'), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: dualStorage,
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB limit
  },
  fileFilter: fileFilter
});

module.exports = upload;

