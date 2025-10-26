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
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    let ext = path.extname(file.originalname);
    if (!ext) {
      // Infer extension from MIME type if original name lacks one
      const mimeToExt = {
        'application/pdf': '.pdf',
        'application/msword': '.doc',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
        'application/vnd.ms-powerpoint': '.ppt',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
        'application/vnd.ms-excel': '.xls',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
        'text/plain': '.txt',
        'text/csv': '.csv',
        'application/rtf': '.rtf',
        'image/jpeg': '.jpg',
        'image/jpg': '.jpg',
        'image/png': '.png',
        'image/gif': '.gif',
        'image/webp': '.webp',
        'image/bmp': '.bmp',
        'image/svg+xml': '.svg',
        'video/mp4': '.mp4',
        'video/mpeg': '.mpeg',
        'video/ogg': '.ogg',
        'video/webm': '.webm',
        'video/quicktime': '.mov',
        'video/x-msvideo': '.avi',
        'video/x-flv': '.flv',
        'video/3gpp': '.3gp',
        'video/3gpp2': '.3g2',
        'video/mp2t': '.ts',
        'video/x-ms-wmv': '.wmv'
      };
      ext = mimeToExt[file.mimetype] || '';
    }
    //leave it here: const basename = path.basename(file.originalname, ext).replace(/\s+/g, '_');
    //leave it here: const filename = 'media-' + uniqueSuffix + '-' + basename + ext;
    const filename = 'media-' + uniqueSuffix + ext;
    cb(null, filename);
  }
});

// Custom dual storage engine
const dualStorage = {
  _handleFile: function (req, file, cb) {
    localStorage._handleFile(req, file, (error, fileInfo) => {
      if (error) {
        return cb(error);
      }

      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      let ext = path.extname(file.originalname);
      if (!ext) {
        // Infer extension from MIME type if original name lacks one
        const mimeToExt = {
          'application/pdf': '.pdf',
          'application/msword': '.doc',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
          'application/vnd.ms-powerpoint': '.ppt',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
          'application/vnd.ms-excel': '.xls',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
          'text/plain': '.txt',
          'text/csv': '.csv',
          'application/rtf': '.rtf',
          'image/jpeg': '.jpg',
          'image/jpg': '.jpg',
          'image/png': '.png',
          'image/gif': '.gif',
          'image/webp': '.webp',
          'image/bmp': '.bmp',
          'image/svg+xml': '.svg',
          'video/mp4': '.mp4',
          'video/mpeg': '.mpeg',
          'video/ogg': '.ogg',
          'video/webm': '.webm',
          'video/quicktime': '.mov',
          'video/x-msvideo': '.avi',
          'video/x-flv': '.flv',
          'video/3gpp': '.3gp',
          'video/3gpp2': '.3g2',
          'video/mp2t': '.ts',
          'video/x-ms-wmv': '.wmv'
        };
        ext = mimeToExt[file.mimetype] || '';
      }
      //const basename = path.basename(file.originalname, ext).replace(/\s+/g, '_');
      const s3Filename = `media/attachment-${uniqueSuffix}${ext}`;

      const localFilePath = path.join(uploadsDir, fileInfo.filename);
      const fileBuffer = fs.readFileSync(localFilePath);

      const params = {
        Bucket: process.env.S3_BUCKET_NAME,
        Key: s3Filename,
        Body: fileBuffer,
        ContentType: file.mimetype,
        Metadata: {
          fieldName: file.fieldname,
          originalName: file.originalname
        }
      };

      s3.upload(params, (err, data) => {
        if (err) {
          console.error('S3 upload error:', err);
        }

        if (data && data.Location) {
          req.savedFileUrl = data.Location;
        } else {
          req.savedFileUrl = `${process.env.BACKEND_URL || `http://localhost:${process.env.PORT || 5000}`}/api/uploads/${fileInfo.filename}`;
        }

        cb(null, {
          name: fileInfo.filename,
          filename: req.savedFileUrl,
          size: fileInfo.size,
          mimetype: file.mimetype,
          url: req.savedFileUrl
        });
        
      });
    });
  },
  _removeFile: function (req, file, cb) {
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

// File filter
const fileFilter = (req, file, cb) => {
  const allowedMimes = [
    // Images
    'image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml',
    // Videos
    'video/mp4', 'video/mpeg', 'video/ogg', 'video/webm', 'video/quicktime', 'video/x-msvideo',
    'video/x-flv', 'video/3gpp', 'video/3gpp2', 'video/mp2t', 'video/x-ms-wmv',
    // Documents
    'application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain', 'text/csv', 'application/rtf'
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error(`File type '${file.mimetype}' not allowed. Only images, videos, and documents are permitted.`), false);
  }
};

// Create multer upload instance
const upload = multer({
  storage: dualStorage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB
  },
  fileFilter: fileFilter
});

// Export different upload configurations for flexibility
module.exports = {
  upload,
  single: (fieldName) => upload.single(fieldName),
  array: (fieldName, maxCount) => upload.array(fieldName, maxCount),
  fields: (fields) => upload.fields(fields)
};