// backend/routes/jobRoutes.js
import { Router } from 'express';
import Job from '../models/job.Model.js';
import protect from '../middleware/auth.js';

const router = Router();

// GET all jobs (public)
router.get('/', async (req, res) => {
    console.log("DEBUG: Hit GET /api/jobs/ (all jobs)");
    try {
        const jobs = await Job.find();
        console.log("DEBUG: Fetched Jobs from DB:", jobs); // Log fetched jobs
        res.json(jobs);
    } catch (err) {
        console.error('Error fetching jobs:', err);
        res.status(500).json({ message: 'Error fetching jobs: ' + err.message });
    }
});

// POST a new job (protected)
router.post('/add', protect, async (req, res) => {
    console.log("\n--- DEBUG: Hit POST /api/jobs/add ---");
    console.log("DEBUG: Request body received:", req.body); // <<< CRITICAL LOG
    const { title, description } = req.body;
    console.log("DEBUG: Extracted title:", title, "description:", description); // <<< CRITICAL LOG
    
    if (!title || !description) {
        console.warn("DEBUG: Missing title or description in body. Sending 400.");
        return res.status(400).json({ message: 'Error: Title and description are required.' });
    }

    const newJob = new Job({ title, description });

    try {
        await newJob.save();
        console.log("DEBUG: Job successfully saved to DB:", newJob); // Log saved job
        res.status(201).json({ message: 'Job added!' });
    } catch (err) {
        console.error('DEBUG: Error adding job to DB:', err); // Detailed error log
        if (err.code === 11000) { 
            return res.status(409).json({ message: 'Error: A job with this title already exists.' });
        }
        res.status(500).json({ message: 'Error adding job: ' + err.message });
    } finally {
        console.log("--- DEBUG: POST /api/jobs/add finished ---\n");
    }
});

export default router;