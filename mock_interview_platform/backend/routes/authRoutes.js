
 // backend/routes/authRoutes.js
 import { Router } from 'express';
 import User from '../models/user.model.js'; // Ensure this path is correct and User is default exported
 import protect from '../middleware/auth.js'; // Ensure this path is correct and protect is default exported

 const router = Router();

 // @desc    Register user
 // @route   POST /api/auth/register
 // @access  Public
 router.post('/register', async (req, res) => {
   const { username, email, password } = req.body;

   try {
     const user = await User.create({ username, email, password });

     // Generate JWT
     const token = user.getSignedJwtToken();

     res.status(201).json({ success: true, token, user: { id: user._id, username: user.username, email: user.email } });
   } catch (error) {
     if (error.code === 11000) { // Duplicate key error
       const field = error.message.includes('username') ? 'username' : 'email';
       return res.status(400).json({ success: false, message: `A user with this ${field} already exists.` });
     }
     console.error('Error during registration:', error);
     res.status(500).json({ success: false, message: error.message || 'Server Error' });
   }
 });

 // @desc    Login user
 // @route   POST /api/auth/login
 // @access  Public
 router.post('/login', async (req, res) => {
   const { email, password } = req.body;

   if (!email || !password) {
     return res.status(400).json({ success: false, message: 'Please provide an email and password.' });
   }

   try {
     const user = await User.findOne({ email }).select('+password');

     if (!user) {
       return res.status(401).json({ success: false, message: 'Invalid credentials.' });
     }

     const isMatch = await user.comparePassword(password);

     if (!isMatch) {
       return res.status(401).json({ success: false, message: 'Invalid credentials.' });
     }

     const token = user.getSignedJwtToken();

     res.status(200).json({ success: true, token, user: { id: user._id, username: user.username, email: user.email } });
   } catch (error) {
     console.error('Error during login:', error);
     res.status(500).json({ success: false, message: error.message || 'Server Error' });
   }
 });

 // @desc    Get current logged in user
 // @route   GET /api/auth/me
 // @access  Private
 router.get('/me', protect, async (req, res) => {
   const user = await User.findById(req.user.id).select('-password');
   res.status(200).json({ success: true, user });
 });

 export default router; // This MUST be a default export
