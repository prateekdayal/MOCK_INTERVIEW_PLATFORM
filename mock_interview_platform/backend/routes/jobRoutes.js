// backend/routes/jobRoutes.js
import { Router } from 'express';
import Job from '../models/job.Model.js';
import protect from '../middleware/auth.js'; // Ensure protect is imported

const router = Router();

// GET all jobs (usually public, but can be protected if desired)
// For now, let's keep it public so users can see available jobs before logging in.
router.get('/', async (req, res) => {
    try {
        const jobs = await Job.find();
        res.json(jobs);
    } catch (err) {
        console.error('Error fetching jobs:', err);
        res.status(500).json({ message: 'Error fetching jobs: ' + err.message });
    }
});

// POST a new job - MUST BE PROTECTED
router.post('/add', protect, async (req, res) => { // <<< PROTECTED
    const { title, description } = req.body;
    
    if (!title || !description) {
        return res.status(400).json({ message: 'Error: Title and description are required.' });
    }

    const newJob = new Job({ title, description });

    try {
        await newJob.save();
        res.status(201).json({ message: 'Job added!' });
    } catch (err) {
        console.error('Error adding job:', err);
        if (err.code === 11000) { 
            return res.status(409).json({ message: 'Error: A job with this title already exists.' });
        }
        res.status(500).json({ message: 'Error adding job: ' + err.message });
    }
});

export default router;