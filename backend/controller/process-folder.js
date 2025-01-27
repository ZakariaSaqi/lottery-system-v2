const asyncHandler = require("express-async-handler");
const path = require("path");
const fs = require("fs").promises; // Use fs.promises for async operations
const cheerio = require("cheerio");
const multer = require("multer");
const AdmZip = require("adm-zip");  
const moment = require("moment");

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "tmp/uploads/"); // Save uploaded files to the "uploads" folder
  },
  filename: (req, file, cb) => {
    cb(null, file.originalname); // Use the original file name
  },
});

const upload = multer({ storage }).single("file"); // Expect a file with the field name "file"

// Function to recursively process folders and extract HTML files
const processFolderRecursively = async (folderPath, allPersons) => {
  try {
    const items = await fs.readdir(folderPath, { withFileTypes: true });
    console.log(`Processing folder: ${folderPath}`); // Debug log
    console.log(
      "Items in folder:",
      items.map((item) => item.name)
    ); // Debug log

    // Initialize an array to store data for the current folder
    let folderData = [];

    // Process all HTML files in the folder
    for (const item of items) {
      if (
        item.isFile() &&
        (item.name.endsWith(".html") || item.name.endsWith(".htm"))
      ) {
        const filePath = path.join(folderPath, item.name);
        console.log(`Processing HTML file: ${filePath}`); // Debug log

        // Determine if the file is for diversity visa or entrant info
        if (item.name.includes("Electronic Diversity Visa Program")) {
          const diversityVisaData = await extractDiversityVisaInfo(filePath);
          if (diversityVisaData) {
            console.log("Extracted diversity visa data:", diversityVisaData); // Debug log
            folderData.push({
              ...diversityVisaData,
              folder: path.basename(folderPath),
            });
          }
        } else {
          const entrantInfo = await extractEntrantInfo(filePath);
          if (entrantInfo) {
            console.log("Extracted entrant info:", entrantInfo); // Debug log
            folderData.push({
              ...entrantInfo,
              folder: path.basename(folderPath),
            });
          }
        }
      }
    }

    // Add the data for the current folder to the allPersons array
    if (folderData.length > 0) {
      allPersons.push(...folderData);
    }

    // Recursively process subfolders (skip unnecessary folders)
    for (const item of items) {
      if (
        item.isDirectory() &&
        !item.name.endsWith("_files") &&
        !item.name.endsWith("_fichiers")
      ) {
        const subFolderPath = path.join(folderPath, item.name);
        console.log(`Processing subfolder: ${subFolderPath}`); // Debug log
        await processFolderRecursively(subFolderPath, allPersons);
      }
    }
  } catch (error) {
    console.error(`Error processing folder ${folderPath}:`, error);
  }
};

// Function to extract entrant info from additional HTML files
const extractEntrantInfo = async (filePath) => {
  try {
    const htmlContent = await fs.readFile(filePath, "utf-8");
    const $ = cheerio.load(htmlContent);

    // Extract Entrant Name
    const entrantName =
      $("body")
        .text()
        .match(/Entrant Name:\s*([^\n]+)/)?.[1]
        ?.trim() || "Manque";

    // Extract Confirmation Number
    const confirmationNumber =
      $("body")
        .text()
        .match(/Confirmation Number:\s*([^\n]+)/)?.[1]
        ?.trim() || "Manque";

    // Extract Year of Birth
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
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return {
      entrantName: "Manque",
      confirmationNumber: "Manque",
      yearOfBirth: "Manque",
    };
  }
};

// Function to extract diversity visa info from the main HTML file
const extractDiversityVisaInfo = async (filePath) => {
  try {
    const htmlContent = await fs.readFile(filePath, "utf-8");
    const $ = cheerio.load(htmlContent);

    // Helper function to extract data or return "Manque" if missing
    const extractField = (headerText) => {
      const card = $(`div.card-header:contains("${headerText}")`).parent();
      const body = card.find("div.card-body").text().trim();
      return body || "Manque";
    };

    const extractFieldFirstName = (selector, labelRegex = null) => {
      const element = $(selector);
      if (!element.length) return "Manque";

      const text = element.text().trim();
      return labelRegex
        ? text.match(labelRegex)?.[1]?.trim() || "Manque"
        : text;
    };

    // Extract First Name
    const firstName = extractFieldFirstName(
      'div.card-body:contains("b. First Name")',
      /b\. First Name\s*([\w\s'-]+)(?=c\. Middle Name)/ // Match until "c. Middle Name"
    );

    console.log(firstName); // Outputs "BOUCHRA" or "MOHAMED MORAD"

    // Extract Gender
    const gender = extractField("2. Gender");

    // Extract Country
    const country = extractField("5. Country Where You Were Born");

    // Extract Phone Number
    const phoneNumber = extractField("10. Phone Number");

    // Extract Email
    const emailCard = $(
      'div.card-header:contains("11. E-mail Address")'
    ).parent();
    const email =
      emailCard.find("div.card-body").text().trim().split("\n")[0].trim() ||
      "Manque";

    // Extract Marital Status (First Word Only)
    const maritalStatusCard = $(
      'div.card-header:contains("13. What is your current marital status?")'
    ).parent();
    const maritalStatusText = maritalStatusCard
      .find("div.card-body")
      .text()
      .trim()
      .split("\n")[0]
      .trim();
    const status = maritalStatusText.split(" ")[0] || "Manque"; // Get the first word

    // Extract Number of Children
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
      status, // Updated to return only the first word
      numberOfChildren,
    };
  } catch (error) {
    console.error(`Error processing file ${filePath}:`, error);
    return {
      firstName: "Manque",
      gender: "Manque",
      country: "Manque",
      phoneNumber: "Manque",
      email: "Manque",
      status: "Manque",
      numberOfChildren: "Manque",
    };
  }
};

const processFolder = asyncHandler(async (req, res) => {
  let filePath = null;
  let extractPath = null;

  try {
    console.log("processFolder endpoint hit"); // Debug log

    upload(req, res, async (err) => {
      if (err) {
        console.error("Multer error:", err); // Debug log
        return res.status(500).json({ message: "Error uploading file" });
      }

      if (!req.file) {
        console.error("No file uploaded"); // Debug log
        return res.status(400).json({ message: "No file uploaded" });
      }

      console.log("Uploaded file:", req.file); // Debug log
      filePath = req.file.path;
      console.log("File path:", filePath); // Debug log

      // Extract date and folderType from the request body
      const { date, folderType } = req.body;
      if (!date || !folderType) {
        return res
          .status(400)
          .json({ message: "Date and folderType are required" });
      }

      // Generate the Excel file name
      const formattedDate = moment(date).format("YYYY-MM-DD"); // Format as YYYY-MM-DD
      const excelFileName = `${formattedDate}_${folderType}.xlsx`;

      // Check if the uploaded file is a zip folder
      if (path.extname(filePath).toLowerCase() === ".zip") {
        const zip = new AdmZip(filePath); // Initialize AdmZip
        extractPath = path.join(__dirname, "../tmp/extracted");

        // Ensure the extracted directory exists
        try {
          await fs.access(extractPath);
        } catch {
          await fs.mkdir(extractPath, { recursive: true });
        }

        // Extract the zip file
        try {
          await zip.extractAllToAsync(extractPath, true); // Use async extraction
          console.log(
            "Extracted folder contents:",
            await fs.readdir(extractPath)
          ); // Debug log
        } catch (error) {
          console.error("Error extracting zip file:", error); // Debug log
          return res.status(500).json({ message: "Error extracting zip file" });
        }

        // Process the extracted folder
        const persons = [];
        await processFolderRecursively(extractPath, persons);

        // Create Excel file
        try {
          if (!persons.length) {
            return res
              .status(400)
              .json({ message: "No data found in the folder" });
          }

          const combinedPersons = [];
          const folderMap = new Map();

          // Group data by folder
          persons.forEach((person) => {
            if (!folderMap.has(person.folder)) {
              folderMap.set(person.folder, []);
            }
            folderMap.get(person.folder).push(person);
          });

          // Match entrant and visa data
          folderMap.forEach((folderData, folder) => {
            const diversityVisaData = folderData.filter((p) => p.gender); // Find all Diversity Visa files
            const entrantData = folderData.filter((p) => p.entrantName); // Find all Entrant files

            // Merge entrant data with diversity visa data
            entrantData.forEach((entrant) => {
              // Find matching diversity visa data based on firstName
              const matchingVisaData = diversityVisaData.find((visa) =>
                entrant.entrantName
                  .toUpperCase()
                  .includes(visa.firstName.toUpperCase())
              );

              // Define default values for all fields
              const defaultPerson = {
                entrantName: "Manque",
                confirmationNumber: "Manque",
                yearOfBirth: "Manque",
                firstName: "Manque",
                gender: "Manque",
                country: "Manque",
                phoneNumber: "Manque",
                email: "Manque",
                status: "Manque",
                numberOfChildren: "Manque",
                folder: folder,
              };

              // If entrant data is missing, replace all fields with "Manque"
              if (
                entrant.entrantName === "Manque" ||
                entrant.confirmationNumber === "Manque" ||
                entrant.yearOfBirth === "Manque"
              ) {
                combinedPersons.push(defaultPerson);
                return; // Skip to the next entrant
              }

              // Merge entrant data with matching visa data (if found)
              const mergedPerson = {
                ...defaultPerson, // Start with default values
                ...entrant, // Override with entrant data
                ...(matchingVisaData || {}), // Override with visa data (if available)
                folder, // Ensure folder is set
              };

              combinedPersons.push(mergedPerson);
            });
          });

          console.log("Combined Persons data:", combinedPersons);

          // Add a default entry with "Manque" values if no data is found
          if (!combinedPersons.length) {
            combinedPersons.push({
              entrantName: "Manque",
              confirmationNumber: "Manque",
              yearOfBirth: "Manque",
              firstName: "Manque",
              gender: "Manque",
              country: "Manque",
              phoneNumber: "Manque",
              email: "Manque",
              status: "Manque",
              numberOfChildren: "Manque",
              folder: "Manque",
            });
          }

          // Return the processed data and Excel file name
          return res.status(200).json({
            message: "Data extracted successfully",
            data: combinedPersons,
            excelFileName,
          });
        } catch (error) {
          console.error("Error creating Excel file:", error); // Debug log
          return res.status(500).json({ message: "Error creating Excel file" });
        }
      } else {
        console.error("Uploaded file is not a zip folder:", filePath); // Debug log
        return res
          .status(400)
          .json({ message: "Uploaded file is not a zip folder" });
      }
    });
  } catch (error) {
    console.error("Unhandled error in processFolder:", error); // Debug log
    return res.status(500).json({ message: "Internal server error" });
  } finally {
    try {
      // Delete the uploaded file
      if (filePath) {
        await fs.unlink(filePath);
        console.log("Uploaded file deleted successfully:", filePath);
      }

      // Delete the extracted folder
      if (extractPath) {
        await fs.rm(extractPath, { recursive: true, force: true });
        console.log("Extracted folder deleted successfully:", extractPath);
      }
    } catch (error) {
      console.error("Error during cleanup:", error);
    }
  }
});

module.exports = { processFolder };
