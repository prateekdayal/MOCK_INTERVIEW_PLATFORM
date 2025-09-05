 
 // backend/models/user.model.js
 import mongoose from 'mongoose';
 import bcrypt from 'bcryptjs';
 import jwt from 'jsonwebtoken';

 const userSchema = new mongoose.Schema({
   username: {
     type: String,
     required: [true, 'Please provide a username'],
     unique: true,
     trim: true,
     minlength: 3,
   },
   email: {
     type: String,
     required: [true, 'Please provide an email'],
     unique: true,
     trim: true,
     lowercase: true,
     match: [/.+@.+\..+/, 'Please enter a valid email address'],
   },
   password: {
     type: String,
     required: [true, 'Please provide a password'],
     minlength: 6,
     select: false,
   },
 }, { timestamps: true });

 userSchema.pre('save', async function(next) {
   if (!this.isModified('password')) {
     return next();
   }
   const salt = await bcrypt.genSalt(10);
   this.password = await bcrypt.hash(this.password, salt);
   next();
 });

 userSchema.methods.comparePassword = async function(candidatePassword) {
   return await bcrypt.compare(candidatePassword, this.password);
 };

 userSchema.methods.getSignedJwtToken = function() {
   return jwt.sign({ id: this._id }, process.env.JWT_SECRET, {
     expiresIn: process.env.JWT_EXPIRE,
   });
 };

 const User = mongoose.model('User', userSchema);
 export default User; // This MUST be a default export
 