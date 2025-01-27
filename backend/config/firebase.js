const admin = require("firebase-admin");
const serviceAccount = Buffer.from(
  process.env.GOOGLE_APPLICATION_CREDENTIALS,
  "base64"
).toString("utf-8");

const parsedServiceAccount = JSON.parse(serviceAccount);
admin.initializeApp({
  credential: admin.credential.cert(parsedServiceAccount),
  storageBucket: "pharmcie-de-la-pointe-a10d5.appspot.com",
});
const bucket = admin.storage().bucket();
const uploadFile = async (fileBuffer, fileName) => {
  try {
    const file = bucket.file(`uploads/${fileName}`);
    await file.save(fileBuffer);
    return file;
  } catch (error) {
    console.error("Error uploading file to Firebase:", error);
    throw new Error("Failed to upload file to Firebase Storage");
  }
};

// Download a file from Firebase Storage
const downloadFile = async (file) => {
  try {
    const [fileBuffer] = await file.download();
    return fileBuffer;
  } catch (error) {
    console.error("Error downloading file from Firebase:", error);
    throw new Error("Failed to download file from Firebase Storage");
  }
};

// Delete a file from Firebase Storage
const deleteFile = async (file) => {
  try {
    await file.delete();
    console.log("File deleted successfully from Firebase Storage");
  } catch (error) {
    console.error("Error deleting file from Firebase:", error);
    throw new Error("Failed to delete file from Firebase Storage");
  }
};

module.exports = { bucket, uploadFile, downloadFile, deleteFile };
