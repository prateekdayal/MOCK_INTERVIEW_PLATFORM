// backend/models/job.model.js
import mongoose from 'mongoose';

const jobSchema = new mongoose.Schema({
    title: { type: String, required: true, unique: true },
    description: { type: String, required: true },
}, { timestamps: true });

const Job = mongoose.model('Job', jobSchema);
export default Job;