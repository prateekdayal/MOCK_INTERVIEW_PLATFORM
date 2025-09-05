// backend/routes/skills.routes.js
import { Router } from 'express';
import Skill from '../models/skill.model.js';
import protect from '../middleware/auth.js'; // Ensure protect is imported

const router = Router();

// GET all skills (usually public)
router.get('/', async (req, res) => {
    try {
        const skills = await Skill.find();
        res.json(skills);
    } catch (err) {
        console.error('Error fetching skills:', err);
        res.status(500).json({ message: 'Error fetching skills: ' + err.message });
    }
});

// POST a new skill - MUST BE PROTECTED
router.post('/add', protect, async (req, res) => { // <<< PROTECTED
    const { name, category } = req.body;
    
    if (!name || !category) {
        return res.status(400).json({ message: 'Error: Name and category are required.' });
    }

    const newSkill = new Skill({ name, category });

    try {
        await newSkill.save();
        res.status(201).json({ message: 'Skill added!' });
    } catch (err) {
        console.error('Error adding skill:', err);
        if (err.code === 11000) { // Assuming name is unique
            return res.status(409).json({ message: 'Error: A skill with this name already exists.' });
        }
        res.status(500).json({ message: 'Error adding skill: ' + err.message });
    }
});

export default router;