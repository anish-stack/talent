const User = require("../modal/usermodal");
const Video = require("../modal/videoScehma")
const sendEmail = require("../utility/sendMail");
const jwt = require("jsonwebtoken");
const ErrorHandler = require("../utility/errorHandler");
require("dotenv").config;
const bcrypt = require("bcrypt");
const sendToken = require("../utility/jwt");
const crypto = require("crypto");
const multer = require('multer')
const cloudinary = require('cloudinary').v2
const sendErrorResponse = (res, error) => {
  const statusCode = error.statusCode || 500;
  const message = error.message || "Internal Server Error";
  res.status(statusCode).json({ success: false, error: message });
};

const catchAsyncErrors = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch((error) => sendErrorResponse(res, error));
  };
};

const deleteUnactivatedUsers = async () => {
  try {
    const twentyMinutesAgo = new Date(Date.now() - 20 * 60 * 1000);

    const unactivatedUsers = await User.find({
      isActivated: false,
      createdAt: { $lt: twentyMinutesAgo },
    });

    for (const user of unactivatedUsers) {
      await user.remove();
      console.log(`Deleted unactivated user with email: ${user.email}`);
    }
  } catch (error) {
    console.error("Error deleting unactivated users:", error);
  }
};

exports.RegisterUser = catchAsyncErrors(async (req, res) => {
  const { username, email, contactNumber, password, confirmPassword, role } =
    req.body;

  const existingUser = await User.findOne({ email });

  try {
    if (existingUser) {
      throw new ErrorHandler("User already exists with this Email Id", 400);
    } else if (
      !username ||
      !email ||
      !contactNumber ||
      !password ||
      !confirmPassword
    ) {
      throw new ErrorHandler("Please Fill All Fields", 422);
    }

    if (password !== confirmPassword) {
      throw new ErrorHandler("Confirm Password Not Match", 422);
    }

    const activationtoken = crypto.randomBytes(20).toString("hex");
    const activationtokenExpires = new Date(Date.now() + 20 * 60 * 1000);

    const newUser = new User({
      username,
      email,
      contactNumber,
      password,
      confirmPassword,
      role,
      isActivated: false,
      activationtoken,
      activationtokenExpires,
    });

    const activationLink = `${
      "https://talenthub.vercel.app"
    }/activate?token=${encodeURIComponent(activationtoken)}`;

    await sendEmail(
      {
        email: newUser.email,
        subject: "Activate Your Account",
        message: `Click the following link to activate your account: ${activationLink}`,
      },
      activationLink
    );

    console.log(activationLink);
    await newUser.save();
    res.status(201).json({
      message:
        "User registered successfully. An activation email has been sent.",
      newUser,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

setInterval(deleteUnactivatedUsers, 20 * 60 * 1000);

// login For User
exports.loginguser = catchAsyncErrors(async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw new ErrorHandler("Please Enter Email And Password", 400);
    }

    const user = await User.findOne({ email });

    if (!user) {
      throw new ErrorHandler("User With this Email Not Existed", 404);
    }

    if (!user.isActivated) {
      throw new ErrorHandler("User Not Activated", 403);
    }

    // Use bcrypt to compare passwords
    const passwordMatch = await bcrypt.compare(password, user.password);

    if (!passwordMatch) {
      throw new ErrorHandler("Password Mismatch", 401);
    }

    const payload = {
      email: user.email,
      id: user._id, // Fix this typo, it should be _id, not _id
      role: user.role,
    };

    const token = jwt.sign(payload, "bjkdhdauigdhjasbcjkaehdhuavcjasdnciaegcjhd", {
      expiresIn: "7h",
    });

    // Remove the password from the user object before sending it in the response
    user.password = undefined;

    const options = {
      expires: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
      httpOnly: true,
    };

    res.cookie("token", token, options).status(200).json({
      success: true,
      token,
      user,
      message: "Logged in successfully",
    });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      success: false,
      message: error.message || "Internal Server Error",
    });
  }
});

//logout
exports.logoutUser = (req, res) => {
  // Clear the authentication token (cookie) to log the user out
  res.clearCookie("token");
  res.status(200).json({
    success: true,
    message: "Logout Successful",
  });
};

//changePassword

exports.changePassword = catchAsyncErrors(async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });

    // Check if the user exists
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User Not Existed",
      });
    }

    // Generate a random four-digit OTP
    const otp = Math.floor(1000 + Math.random() * 9000);

    // Save the OTP and its expiration time in the user object
    user.resetPasswordOTP = otp;
    user.resetPasswordOTPExpires = new Date(Date.now() + 20 * 60 * 1000);

    // Send the OTP to the user's email
    const payload = {
      email: user.email,
      subject: "Reset Password OTP",
      message: `Your OTP to reset your password is: ${otp}`,
    };

    // Send the OTP via email
    // console.log(payload)
    await sendEmail(payload);
    console.log(payload)
    await user.save();

    res.status(200).json({ message: "OTP sent to your email" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

// Endpoint to verify OTP and update the password
exports.verifyOTPAndChangePassword = catchAsyncErrors(async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    // Check if required fields are present and not empty
    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        success: false,
        message: "Please provide email, OTP, and new password",
      });
    }

    // Find the user by email
    const user = await User.findOne({ email });

    // Check if the OTP matches and it's not expired
    if (
      user.resetPasswordOTP !== otp ||
      new Date() > user.resetPasswordOTPExpires
    ) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP or OTP has expired",
      });
    }

    // Reset the OTP and set the new password
    user.resetPasswordOTP = undefined;
    user.resetPasswordOTPExpires = undefined;
    user.password = newPassword;

    // Save the updated user object
    await user.save();

    res.status(200).json({ message: "Password reset successfully" });
  } catch (error) {
    console.error("Error:", error);
    res.status(500).json({ error: "An error occurred" });
  }
});

//user management for user-side
exports.updateUserProfile = catchAsyncErrors(async (req, res) => {
  const { newEmail, newPhoneNumber, newUsername, emailChange } = req.body;
  const userId = req.user.id; // Assuming you have user authentication middleware

  try {
    // Retrieve the user by ID
    const user = await User.findById(userId);

    if (!user) {
      throw new ErrorHandler("User not found", 404);
    }

    // If the user wants to change email, send an OTP for confirmation
    if (emailChange && newEmail !== user.email) {
      // Generate a random four-digit OTP
      const otp = Math.floor(1000 + Math.random() * 9000);
      user.emailChangeOtp = otp;
      user.emailChangeTemp = newEmail;
      user.emailChangeTokenExpires = Date.now() + 15 * 60 * 1000; // OTP expires in 15 minutes
      await user.save();

      // Send the OTP to the new email address
      await sendEmail({
        email: newEmail,
        subject: "Email Change Confirmation",
        message: `Your OTP for email change is: ${otp}`,
      });

      res.status(200).json({
        message: "An OTP has been sent to your new email for confirmation.",
      });
    }

    // Update the user's profile
    if (newEmail) {
      user.email = newEmail;
    }

    if (newPhoneNumber) {
      user.contactNumber = newPhoneNumber;
    }

    if (newUsername) {
      user.username = newUsername;
    }

    await user.save();

    res.status(200).json({
      message: "User profile updated successfully.",
      user,
    });
  } catch (error) {
    console.error("Error:", error);
    res.status(error.statusCode || 500).json({ error: error.message });
  }
});


exports.verifyToken = async (req, res, next) => {
  const token = req.cookies.token || req.headers.authorization;

  if (!token) {
    return next(new ErrorHandler('Unauthorized', 401));
  }

  try {
    const decoded = jwt.verify(token, "bjkdhdauigdhjasbcjkaehdhuavcjasdnciaegcjhd");

    // Fetch the user based on the decoded token (e.g., by user ID)
    const user = await User.findById(decoded.id);

    if (!user) {
      return next(new ErrorHandler('User not found', 404));
    }

    req.user = user; // Attach the user to the request object
    next();
  } catch (error) {
    return next(new ErrorHandler('Unauthorized', 401));
  }
};


exports.allVideo = async (req, res) => {
  try {
    // Fetch all video documents from your database
    const videos = await Video.find({}, 'cloudinaryUrl'); // 'cloudinaryUrl' is the field where the Cloudinary URLs are stored

    // Extract the Cloudinary URLs from the video documents
    const videoLinks = videos.map((video) => video.cloudinaryUrl);

    res.status(200).json({
      success: true,
      videos: videoLinks,
    });
  } catch (error) {
    // Handle any errors here
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error fetching video links',
      error: error.message,
    });
  }
};
exports.myVideo = catchAsyncErrors(async (req, res) => {
  const {userId} = req.body; // Retrieve the user ID from the request body
  console.log(userId)
  try {
    // Check if the user ID is valid
    const userExists = await Video.exists({ uploadedBy });

    if (!userExists) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a valid user ID',
      });
    }

    // Fetch videos uploaded by the user
    const userVideos = await Video.find({ uploadedBy: userId });

    res.status(200).json({
      success: true,
      videos: userVideos,
    });
  } catch (error) {
    // Handle any errors here
    console.error(error);
    res.status(500).json({
      success: false,
      message: 'Error fetching user videos',
      error: error.message,
    });
  }
});
