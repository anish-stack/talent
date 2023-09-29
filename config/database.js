
const mongoose = require("mongoose");
const dotenv = require("dotenv");

const uri = process.env.MONGO_URI || "mongodb+srv://anishjha896:TX4bpqa405RefYxQ@cluster0.k2nqhil.mongodb.net/?retryWrites=true&w=majority"; 

const connectDB = async () => {
  try {
    await mongoose.connect(uri, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
      connectTimeoutMS: 60000, // Increased timeout to 60 seconds
    });
    console.log("Connected to the database successfully!");
  } catch (error) {
    console.error("Error connecting to the database:", error);
  }
};

module.exports = connectDB;