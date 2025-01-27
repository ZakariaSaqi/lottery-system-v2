const asyncHandler = require("express-async-handler");
const cheerio = require("cheerio");
const AdmZip = require("adm-zip");
const moment = require("moment");
const multer = require("multer");
const path = require("path");
const cloudinary = require("../config/cloudinary"); // Import Cloudinary configuration
const fetch = require("node-fetch"); // Ensure node-fetch is installed

// Configure multer for in-memory file uploads
const upload = multer({ storage: multer.memoryStorage() }).single("file");

// Function to recursively process ZIP entries
const processFolderRecursively = (zipEntries, allPersons) => {
  for (const entry of zipEntries) {
    if (entry.entryName.endsWith(".html") || entry.entryName.endsWith(".htm")) {
      const fileContent = entry.getData().toString("utf-8");
      const $ = cheerio.load(fileContent);

      if (entry.entryName.includes("Electronic Diversity Visa Program")) {
        const diversityVisaData = extractDiversityVisaInfo($);
        allPersons.push({ ...diversityVisaData, folder: entry.entryName });
      } else {
        const entrantInfo = extractEntrantInfo($);
        allPersons.push({ ...entrantInfo, folder: entry.entryName });
      }
    }
  }
};

// Function to extract entrant info from HTML content
const extractEntrantInfo = ($) => {
  const entrantName =
    $("body")
      .text()
      .match(/Entrant Name:\s*([^\n]+)/)?.[1]
      ?.trim() || "Manque";

  const confirmationNumber =
    $("body")
      .text()
      .match(/Confirmation Number:\s*([^\n]+)/)?.[1]
      ?.trim() || "Manque";

  const yearOfBirth =
    $("body")
      .text()
      .match(/Year of Birth:\s*(\d{4})/)?.[1]
      ?.trim() || "Manque";

  return {
    entrantName,
    confirmationNumber,
    yearOfBirth,
  };
};

// Function to extract diversity visa info from HTML content
const extractDiversityVisaInfo = ($) => {
  const extractField = (headerText) => {
    const card = $(`div.card-header:contains("${headerText}")`).parent();
    const body = card.find("div.card-body").text().trim();
    return body || "Manque";
  };

  const extractFieldFirstName = (selector, labelRegex = null) => {
    const element = $(selector);
    if (!element.length) return "Manque";

    const text = element.text().trim();
    return labelRegex ? text.match(labelRegex)?.[1]?.trim() || "Manque" : text;
  };

  const firstName = extractFieldFirstName(
    'div.card-body:contains("b. First Name")',
    /b\. First Name\s*([\w\s'-]+)(?=c\. Middle Name)/
  );

  const gender = extractField("2. Gender");
  const country = extractField("5. Country Where You Were Born");
  const phoneNumber = extractField("10. Phone Number");

  const emailCard = $(
    'div.card-header:contains("11. E-mail Address")'
  ).parent();
  const email =
    emailCard.find("div.card-body").text().trim().split("\n")[0].trim() ||
    "Manque";

  const maritalStatusCard = $(
    'div.card-header:contains("13. What is your current marital status?")'
  ).parent();
  const maritalStatusText = maritalStatusCard
    .find("div.card-body")
    .text()
    .trim()
    .split("\n")[0]
    .trim();
  const status = maritalStatusText.split(" ")[0] || "Manque";

  const numberOfChildrenCard = $(
    'div.card-header:contains("14. Number of Children")'
  ).parent();
  const numberOfChildren =
    numberOfChildrenCard
      .find("div.card-body")
      .text()
      .trim()
      .split("\n")[0]
      .trim() || "Manque";

  return {
    firstName,
    gender,
    country,
    phoneNumber,
    email,
    status,
    numberOfChildren,
  };
};

const processFolder = asyncHandler(async (req, res) => {
  try {
    upload(req, res, async (err) => {
      if (err) {
        console.error("Multer error:", err);
        return res.status(500).json({ message: "Error uploading file" });
      }

      if (!req.file) {
        return res.status(400).json({ message: "No file uploaded" });
      }

      // Validate the uploaded file is a ZIP file
      if (path.extname(req.file.originalname).toLowerCase() !== ".zip") {
        return res
          .status(400)
          .json({ message: "Uploaded file is not a ZIP file" });
      }

      const { date, folderType } = req.body;
      if (!date || !folderType) {
        return res
          .status(400)
          .json({ message: "Date and folderType are required" });
      }

      const formattedDate = moment(date).format("YYYY-MM-DD");
      const excelFileName = `${formattedDate}_${folderType}.xlsx`;

      try {
        // Upload the file to Cloudinary
        const uploadResult = await cloudinary.uploader.upload(
          `data:application/zip;base64,${req.file.buffer.toString("base64")}`,
          {
            resource_type: "raw",
            public_id: `uploads/${req.file.originalname}`,
          }
        );

        console.log("File uploaded to Cloudinary:", uploadResult.secure_url);

        // Download the file from Cloudinary
        const fileUrl = uploadResult.secure_url;
        const response = await fetch(fileUrl);
        if (!response.ok) {
          throw new Error(
            `Failed to fetch file from Cloudinary: ${response.statusText}`
          );
        }
        const downloadedBuffer = await response.buffer();

        // Process the ZIP file
        const zip = new AdmZip(downloadedBuffer);
        const zipEntries = zip.getEntries();
        const persons = [];
        processFolderRecursively(zipEntries, persons);

        // Delete the file from Cloudinary after processing
        await cloudinary.uploader.destroy(uploadResult.public_id, {
          resource_type: "raw",
        });

        console.log("File deleted from Cloudinary");

        // Return the processed data
        return res.status(200).json({
          message: "Data extracted successfully",
          data: persons,
          excelFileName,
        });
      } catch (error) {
        console.error("Error during Cloudinary operations:", error);
        return res.status(500).json({ message: "Error processing file" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in processFolder:", error);
    return res.status(500).json({ message: "Internal server error" });
  }
});

module.exports = { processFolder };
