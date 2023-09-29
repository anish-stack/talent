const express = require("express");
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
const multer = require('multer');
const path = require("path");
const router = express.Router();
const fs = require('fs');
const Video = require('./modal/videoScehma')
const mongoose = require("mongoose");
const errorHandler = require("./utility/errorHandler");
const cloudinary = require('cloudinary').v2;
const User = require("./modal/usermodal");
const connectDB = require("./config/database");
const bodyparser = require("body-parser");
const UserRoutes = require("./routes/routes");
const cookieParser = require("cookie-parser");
const MAX_PAYLOAD_SIZE ="50mb"
dotenv.config({ path: "./config/config.env" });
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit:MAX_PAYLOAD_SIZE }));
app.use(express.urlencoded({ extended: true, limit:MAX_PAYLOAD_SIZE }));


// Route For Checking backend
app.get("/", (req, res) => {
  return res.send("Hello, I am from the backend");
});

app.get("/activate", async (req, res) => {
  try {
    const { token } = req.query;

    // Find the user with the provided token
    const user = await User.findOne({ activationtoken: token });

    if (!user) {
      // Handle the case where the token does not match any user
      throw new Error("Invalid or expired activation token");
    }

    // Check if the token has expired
    if (user.activationtokenExpires <= Date.now()) {
      // Handle the case where the token has expired
      throw new Error("Activation token has expired");
    }

    // Activate the user's account
    user.isActivated = true;
    await user.save();

    // Redirect the user to a success page or display a success message
    res.status(200).json({ message: "Account activated successfully" });
  } catch (error) {
    // Handle errors
    console.error("Error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});

app.use(express.static(path.join(__dirname, "temp")));
app.get("/video-upload", (req, res) => {
  res.sendFile(path.join(__dirname, "temp", "video.html"));
});
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "temp", "login.html"));
});
app.get("/logout", (req, res) => {
  res.sendFile(path.join(__dirname, "temp", "logout.html"));
});
app.get("/forget", (req, res) => {
  res.sendFile(path.join(__dirname, "temp", "forget.html"));
});
app.use("/api", UserRoutes);

const {
  RegisterUser,
  loginguser,
  changePassword,
  verifyOTPAndChangePassword,
  logoutUser,
  updateUserProfile,
  allVideo,
} = require("./controller/usercontroller");
const { protect } = require("./middleware/auth");
const videoScehma = require("./modal/videoScehma");

// Define your routes using the app instance directly
app.get("/logout", protect, logoutUser);
app.post("/Profile-change", updateUserProfile);
app.post("/register", RegisterUser);
app.post("/login", loginguser);
app.post("/change-password", changePassword);
app.post("/verifyotp", verifyOTPAndChangePassword);
app.get("/posts", allVideo);

app.get("/api/videos/:userId", async (req, res) => {
  const userId = req.params.userId; // Retrieve the user ID from the URL parameter

  try {
    // Find videos uploaded by the user with the specified userId
    const userVideos = await videoScehma.find({ uploadedBy: userId });

    res.status(200).json({
      success: true,
      videos: userVideos,
    });
  } catch (error) {
    // Handle any errors here
    console.error(error);
    res.status(500).json({
      success: false,
      message: "Error fetching user videos",
      error: error.message,
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ error: err.message });
});

// Configure Cloudinary
cloudinary.config({
  cloud_name: 'dabunigif',
  api_key: '238174512762346',
  api_secret: 'mIO6jLCec99vMkkEBmBrwuK8dDw',
});

// Set up multer for handling file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage });

// Create a temporary directory if it doesn't exist
const tempDirectory = '/tmp';
if (!fs.existsSync(tempDirectory)) {
  fs.mkdirSync(tempDirectory);
}

// Define a route to handle video uploads
app.post('/upload', upload.single('video'), async (req, res) => {
  try {
    // Generate a unique filename
    const tempFilePath = `${tempDirectory}/${Date.now()}.mp4`;

    // Write the Buffer data to the temporary file
    fs.writeFileSync(tempFilePath, req.file.buffer);

    // Upload the temporary file to Cloudinary
    const result = await cloudinary.uploader.upload(tempFilePath, {
      resource_type: 'video',
    });

    // Remove the temporary file
    fs.unlinkSync(tempFilePath);

    // Create a new video document in your MongoDB
    const newVideo = new Video({
      title: req.body.title,
      cloudinaryUrl: result.secure_url,
      uploadedBy: req.body.uploadedBy,
    });

    // Save the video document to the database
    await newVideo.save();

    res.status(201).json({ message: 'Video uploaded successfully' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: 'Internal server error' });
  }
});


// calling server
connectDB();
const Port = process.env.PORT || 4000;

app.listen(Port, () => {
  console.log(`Server Is Running on port number ${Port}`);
});
