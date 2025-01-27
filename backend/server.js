require("dotenv").config();
const express = require("express"); // Import the controller
const app = express();
const cors = require("cors");
const { processFolder } = require("./controller/backup");
app.use(express.json());

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  cors({
    origin: process.env.CLIENT_DOMAIN, // Allow requests from this origin
    methods: "GET,POST,PUT,DELETE", // Allowed HTTP methods
    credentials: true, // Allow cookies and credentials
  })
);
app.get("/", (req, res) => {
  res.json("Connected");
});
app.post("/process-folder", processFolder);

// Start the server
app.listen(process.env.PORT, () => {
  console.log(`Server is running on port ${process.env.PORT}`);
});
