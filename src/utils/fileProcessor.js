const fs = require("fs");
const path = require("path");
const { v4: uuidv4 } = require("uuid");

// You can set this in your .env
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

// Ensure uploads folder exists
const uploadsDir = path.join(__dirname, "../../uploads");
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

/**
 * Convert base64 to file and return URL.
 * If already URL, returns as-is.
 * @param {string} base64OrUrl
 * @param {string} folder optional subfolder under uploads
 * @returns {Promise<string>} file URL
 */
async function saveFile(base64OrUrl, folder = "") {
  try {
    if (!base64OrUrl) return null;

    // Already URL
    if (base64OrUrl.startsWith("http://") || base64OrUrl.startsWith("https://")) {
      return base64OrUrl;
    }

    // Detect base64
    const matches = base64OrUrl.match(/^data:(.+);base64,(.*)$/);
    if (!matches) {
      // Not base64, not URL, ignore
      return null;
    }

    const ext = matches[1].split("/")[1] || "png"; // default to png
    const data = matches[2];
    const buffer = Buffer.from(data, "base64");

    // Create subfolder if needed
    const targetDir = folder ? path.join(uploadsDir, folder) : uploadsDir;
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });

    const filename = `${uuidv4()}.${ext}`;
    const filePath = path.join(targetDir, filename);

    await fs.promises.writeFile(filePath, buffer);

    return `${BACKEND_URL}/api/uploads/${folder ? folder + "/" : ""}${filename}`;
  } catch (err) {
    console.error("Error saving file:", err);
    return null;
  }
}

/**
 * Process array of files (base64 or URLs) from models
 * @param {Array} items - array of strings or objects
 * @param {string} key - if items are objects, key is where the base64/url is stored
 * @param {string} folder - subfolder in uploads
 */
async function processFilesArray(items, key = null, folder = "") {
  if (!Array.isArray(items)) return [];

  const results = [];
  for (const item of items) {
    if (typeof item === "string") {
      const url = await saveFile(item, folder);
      if (url) results.push(url);
    } else if (typeof item === "object" && key && item[key]) {
      const url = await saveFile(item[key], folder);
      results.push({ ...item, [key]: url });
    } else {
      results.push(item); // leave as-is
    }
  }
  return results;
}

/**
 * Example usage for your models
*/

async function processModelFiles(model) {
  switch (model.type) {
    case "user":
      model.avatarUrl = await saveFile(model.avatarUrl, "users");
      break;

    case "profile":
      model.cvBase64 = await saveFile(model.cvBase64, "profiles");
      break;

    case "workSample":
      model.attachments = await processFilesArray(model.workSample, "base64url", "work_samples");
      break;

    case "job":
      model.coverImageBase64 = await saveFile(model.coverImageBase64, "jobs");
      break;

    case "event":
      model.coverImageUrl = await saveFile(model.coverImageUrl, "events");
      break;

    case "product":
      model.images = await processFilesArray(model.images, null, "products");
      break;

    case "service":
      model.attachments = await processFilesArray(model.attachments, null, "services");
      break;

    case "tourism":
      model.images = await processFilesArray(model.images, null, "tourisms");
      break;

    case "funding":
      model.images = await processFilesArray(model.images, null, "fundings");
      break;

    case "moment":
      model.images = await processFilesArray(model.images, "base64url", "moments");
      model.attachments = await processFilesArray(model.attachments, "base64url", "moments");
      break;

    case "need":
      model.attachments = await processFilesArray(model.attachments, "base64url", "needs");
      break;

    default:
      break;
  }

  return model;
}

module.exports = { saveFile, processFilesArray, processModelFiles };
