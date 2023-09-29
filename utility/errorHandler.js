// Define a custom error class named ErrorHandler that extends the built-in Error class.
class ErrorHandler extends Error {
    // Constructor for the custom error class.
    constructor(message, statusCode) {
      // Call the constructor of the parent class (Error) with the provided error message.
      super(message);
      
      // Set the custom statusCode property on the error object.
      this.statusCode = statusCode;
  
      // Capture the stack trace for better error debugging.
      Error.captureStackTrace(this, this.constructor);
    }
  }
  
  // Export the ErrorHandler class to make it available for use in other parts of your code.
  module.exports = ErrorHandler;
  