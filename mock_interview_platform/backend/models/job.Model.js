// backend/models/job.model.js
import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true }, // Ensure unique:true is here
    description: { type: String, required: true },
}, { timestamps: true });

// Prevent Mongoose from trying to recompile the model if it already exists
const Job = mongoose.models.Job || mongoose.model('Job', jobSchema); // <<< Safety check for model overwrite
export default Job;