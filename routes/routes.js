const express = require('express')
const { RegisterUser, loginguser,changePassword, verifyOTPAndChangePassword,logoutUser ,updateUserProfile, videoUpload, upload, myVideo } = require('../controller/usercontroller')
const { protect } = require('../middleware/auth');
const videoScehma = require('../modal/videoScehma');
const router = express.Router()


router.get('/logout', protect, logoutUser);
router.route('/Prodile-change').post(updateUserProfile)
router.route("/register").post(RegisterUser)
router.route("/login").post(loginguser)
router.post('/change-password',changePassword)

  
router.route('/verifyotp').post(verifyOTPAndChangePassword)
module.exports = router