const mongoose = require('mongoose');

const videoSchema =  mongoose.Schema({
  title: {
    type: String,
    required: true,
  },
  cloudinaryUrl: {
    type: String,
    required: true,
  },
  uploadedBy: {
    type: String,
    required: true,
  },
  uploadDate: {
    type: Date,
    default: Date.now,
  },
  comments: [
    {
      Comment: String,
      // other comment-related fields
    },
  ],
});

module.exports = mongoose.model('Video', videoSchema);
