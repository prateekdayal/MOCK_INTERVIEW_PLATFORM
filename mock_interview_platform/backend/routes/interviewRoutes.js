// backend/routes/interviewRoutes.js
import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SpeechClient } from '@google-cloud/speech';
import InterviewSession from '../models/interviewSession.model.js';
import Job from '../models/job.Model.js';
import Skill from '../models/skill.model.js';
import multer from 'multer';
import protect from '../middleware/auth.js';
import fs from "fs/promises";
import path from "path";
import mongoose from 'mongoose';


import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


const router = Router();

const uploadMedia = multer({ storage: multer.memoryStorage() });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const speechClient = new SpeechClient();

// Helper function to generate questions
async function generateInterviewQuestions(interviewData) {
  const { selectedJobs, selectedSkills, resumeText } = interviewData;

  const jobDetails = await Job.find({ _id: { $in: selectedJobs } });
  const skillDetails = await Skill.find({ _id: { $in: selectedSkills } });

  const jobTitles = jobDetails.map(job => job.title).join(', ');
  const skillNames = skillDetails.map(skill => skill.name).join(', ');

  let prompt = `You are an AI mock interviewer. Generate a set of 5-7 interview questions for a candidate. `;
  prompt += `The candidate is applying for the following role(s): "${jobTitles}". `;
  prompt += `They should be assessed on these key skills: "${skillNames}". `;
  if (resumeText) {
    prompt += `Here is their resume (extract relevant experience/projects from this text to inform questions, keep resume content concise to fit prompt limits):\n"${resumeText.substring(0, Math.min(resumeText.length, 2000))}"\n`;
  }
  prompt += `The questions should cover a mix of technical, behavioral, and situational aspects relevant to the role and skills. Format the output as a numbered list of questions, e.g., "1. Question text. 2. Another question.".`;

  console.log("Gemini Prompt (truncated for log):\n", prompt.substring(0, 500) + '...');

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const responseContent = response.text();

    console.log("Gemini Response (raw):\n", responseContent);

    const questions = responseContent
        .split('\n')
        .filter(line => line.match(/^\s*\d+\./))
        .map(line => line.replace(/^\s*\d+\.\s*/, '').trim())
        .filter(q => q.length > 10 && q.endsWith('?'))
        .map(q => ({ questionText: q }));

    return questions;

  } catch (error) {
    console.error("Error generating questions with Gemini AI:", error);
    if (error instanceof Error && error.message.includes("404 Not Found")) {
        throw new Error("Failed to generate interview questions. The Gemini model name might be incorrect or unavailable in your region. Please ensure 'gemini-2.0-flash' is accessible.");
    }
    throw new Error("Failed to generate interview questions. Please check Gemini API key and usage limits. Error: " + error.message);
  }
}

// POST endpoint to start a new interview session
router.post('/start', protect, async (req, res) => {
  const { selectedJobs, selectedSkills, resumeText } = req.body;
  const userId = req.user.id;

  if (!selectedJobs || selectedJobs.length === 0 || !selectedSkills || selectedSkills.length === 0) {
    return res.status(400).json({ message: 'At least one job and one skill must be selected to start an interview.' });
  }

  try {
    const generatedQuestions = await generateInterviewQuestions({ selectedJobs, selectedSkills, resumeText });

    if (generatedQuestions.length === 0) {
        return res.status(500).json({ message: 'Gemini AI did not return any valid questions. Please try refining your selections or try again.' });
    }

    const newInterview = new InterviewSession({
      userId,
      selectedJobs,
      selectedSkills,
      resumeText,
      generatedQuestions,
      status: 'in-progress',
    });

    await newInterview.save();

    res.status(201).json({
      message: 'Interview session started!',
      interviewId: newInterview._id,
      firstQuestion: newInterview.generatedQuestions[0].questionText,
      totalQuestions: newInterview.generatedQuestions.length
    });

  } catch (error) {
    console.error('Failed to start interview session:', error);
    res.status(500).json({ message: error.message || 'Server Error' });
  }
});

// GET endpoint to retrieve a specific interview session
router.get('/:id', protect, async (req, res) => {
  console.log("\n--- DEBUG: GET /api/interview/:id route hit ---");
  const { id } = req.params;
  const userId = req.user.id; // From protect middleware

  console.log("DEBUG: Fetching interview for ID:", id);
  console.log("DEBUG: Authenticated User ID:", userId);

  try {
    const interview = await InterviewSession.findById(id).lean() // Use .lean() to get a plain JS object
      .populate('selectedJobs', 'title')
      .populate('selectedSkills', 'name category');

    if (!interview) {
      console.warn("DEBUG: Interview session not found in DB for ID:", id);
      return res.status(404).json({ message: 'Interview session not found.' });
    }

    console.log("DEBUG: Interview found. User ID in DB:", interview.userId.toString());
    if (interview.userId.toString() !== userId) {
        console.warn("DEBUG: User ID mismatch. Not authorized.");
        return res.status(403).json({ message: 'Not authorized to view this interview session.' });
    }
    
    console.log("DEBUG: Interview object being sent to frontend (relevant media fields):");
    interview.generatedQuestions.forEach((q, idx) => {
        console.log(`  Q${idx + 1}: userAudioUrl: ${q.userAudioUrl ? q.userAudioUrl.substring(0,50) + '...' : 'N/A'}, Transcription: ${q.userAudioTranscription ? q.userAudioTranscription.substring(0,50) + '...' : 'N/A'}, isAnswered: ${q.isAnswered}`);
    });

    console.log("DEBUG: Interview successfully fetched and authorized.");
    res.status(200).json(interview);
  } catch (error) {
    console.error('❌ DEBUG: Error fetching interview session in catch block:', error);
    res.status(500).json({ message: 'Server Error fetching interview session.', error: error.message });
  } finally {
      console.log("--- DEBUG: GET /api/interview/:id route finished ---");
  }
});

// UPDATED: PUT endpoint to save an answer for a specific question - CRITICAL Mongoose Atomic Array Update
router.put('/:id/answer', protect, uploadMedia.single('mediaFile'), async (req, res) => {
  console.log("\n--- DEBUG: PUT /api/interview/:id/answer route hit ---");
  const { id: interviewId } = req.params;
  const { userAnswer, questionId } = req.body;
  const mediaFile = req.file;
  let userAudioTranscription = '';
  let userAudioUrl = null;

  console.log("DEBUG: Request Body:", { userAnswer, questionId });
  console.log("DEBUG: req.file (mediaFile) status:", mediaFile ? `Present, MimeType: ${mediaFile.mimetype}, Size: ${mediaFile.size}` : "Undefined/Not Uploaded");

  try {
    const interview = await InterviewSession.findById(interviewId); 
    if (!interview) {
      console.warn("DEBUG: Interview session not found for ID:", interviewId);
      return res.status(404).json({ message: 'Interview session not found.' });
    }
    if (interview.userId.toString() !== req.user.id) {
        console.warn("DEBUG: User not authorized for interview ID:", interviewId);
        return res.status(403).json({ message: 'Not authorized to modify this interview session.' });
    }
    const questionIndex = interview.generatedQuestions.findIndex(q => q._id.toString() === questionId);
    if (questionIndex === -1) {
      console.warn("DEBUG: Question not found for ID:", questionId, "in interview.");
      return res.status(404).json({ message: 'Question not found in this interview session.' });
    }

    // --- Media File Processing & Speech-to-Text Transcription ---
    if (mediaFile && mediaFile.buffer && (mediaFile.mimetype.startsWith('audio') || mediaFile.mimetype.startsWith('video'))) {
        console.log(`DEBUG: Proceeding with media file processing and STT.`);
        console.log(`DEBUG: Detected MimeType: ${mediaFile.mimetype}`);
        
        // --- CRITICAL: LOCAL FILE STORAGE AND STATIC URL GENERATION ---
        const uploadsBaseDir = path.join(__dirname, '../uploads'); // Path to /backend/uploads
        await fs.mkdir(uploadsBaseDir, { recursive: true }); // Ensure directory exists

        const fileName = `${interviewId}_${questionId}_${Date.now()}.${mediaFile.mimetype.split('/')[1].split(';')[0].replace(/[^a-z0-9]/gi, '_')}`; // Sanitize filename
        const filePath = path.join(uploadsBaseDir, fileName);

        await fs.writeFile(filePath, mediaFile.buffer); // Save the file to disk
        userAudioUrl = `/uploads/${fileName}`; // This is the static URL path
        console.log(`✅ Media file saved locally to: ${filePath}`);
        console.log(`DEBUG: Static userAudioUrl set: ${userAudioUrl}`);
        // --- END CRITICAL LOCAL FILE STORAGE ---

        const audio = {
            content: mediaFile.buffer.toString('base64'),
        };
        
        // --- Refined STT Configuration based on MimeType ---
        let encoding;
        let sampleRateHertz = 48000; 
        
        if (mediaFile.mimetype.includes('webm') && mediaFile.mimetype.includes('opus')) {
            encoding = 'WEBM_OPUS';
            console.log("DEBUG: STT Config: Using WEBM_OPUS for WebM/Opus.");
        } else if (mediaFile.mimetype.includes('webm')) {
            encoding = 'WEBM_OPUS'; 
            console.log("DEBUG: STT Config: Using WEBM_OPUS for generic WebM.");
        } else if (mediaFile.mimetype.includes('mp4')) {
            encoding = 'MP4_AUDIO'; 
            sampleRateHertz = 48000; // Common sample rate for AAC in MP4
            console.warn("DEBUG: Media is MP4. Attempting MP4_AUDIO encoding. This might require specific client-side MP4 audio encoding or FFmpeg pre-processing.");
        } else if (mediaFile.mimetype.includes('ogg')) {
            encoding = 'OGG_OPUS';
            sampleRateHertz = 48000;
            console.log("DEBUG: STT Config: Using OGG_OPUS for Ogg.");
        } else if (mediaFile.mimetype.startsWith('audio/')) {
             encoding = 'ENCODING_UNSPECIFIED';
             sampleRateHertz = 0;
             console.warn("DEBUG: Generic audio type detected. Using ENCODING_UNSPECIFIED.");
        } else {
            encoding = 'ENCODING_UNSPECIFIED';
            sampleRateHertz = 0;
            console.warn("DEBUG: Fallback for unknown media MIME type. Using ENCODING_UNSPECIFIED. This may cause STT issues.");
        }

        const config = {
            encoding: encoding,
            sampleRateHertz: sampleRateHertz,
            languageCode: 'en-US',
            model: 'latest_long',
            enableAutomaticPunctuation: true,
        };
        if (mediaFile.mimetype.startsWith('video')) {
            config.enableWordTimeOffsets = false;
            console.log("DEBUG: Media is video, adjusting STT config (enableWordTimeOffsets=false).");
        }
        console.log("DEBUG: Final STT Config sent to Google:", JSON.stringify(config));


        const request = { audio: audio, config: config, };

        try {
            console.log("DEBUG: Attempting Google Speech-to-Text transcription.");
            const [response] = await speechClient.recognize(request);
            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n');
            userAudioTranscription = transcription;
            console.log('✅ Audio Transcription:', transcription);
        } catch (sttError) {
            console.error('❌ Google STT Error during transcription:', sttError);
            userAudioTranscription = `Transcription failed: ${sttError.message}`;
            console.error('DEBUG: Failed STT for MimeType:', mediaFile.mimetype, 'with config:', JSON.stringify(config));
        }
    } else {
        console.log("DEBUG: No valid media file uploaded for STT (or it's not an audio/video type), skipping transcription.");
        userAudioUrl = null;
        userAudioTranscription = '';
    }

    const newIsAnswered = (!!userAnswer && userAnswer.trim().length > 0) || (!!userAudioTranscription && userAudioTranscription.trim().length > 0);
    
    // --- CRITICAL FIX: Use findOneAndUpdate with positional operator ---
    const updateQuery = { _id: interviewId, "generatedQuestions._id": questionId };
    const updateOperation = {
        $set: { // Use $set to update specific fields within the array element
            "generatedQuestions.$.userAnswer": userAnswer || '',
            "generatedQuestions.$.userAudioUrl": userAudioUrl,
            "generatedQuestions.$.userAudioTranscription": userAudioTranscription,
            "generatedQuestions.$.isAnswered": newIsAnswered,
        },
    };

    const updatedInterview = await InterviewSession.findOneAndUpdate(
        updateQuery,
        updateOperation,
        { new: true, runValidators: true } // Return the updated document and run validators
    ).lean(); // Removed .lean() to work with the Mongoose document structure if needed for markModified

    // Check if the update was successful
    if (!updatedInterview) {
        console.error("DEBUG: findOneAndUpdate returned null, interview or question not found for update (or failed).");
        return res.status(404).json({ message: "Failed to update interview session or question in DB." });
    }
    
    // --- NEW CRITICAL DEBUG: IMMEDIATELY RE-FETCH FROM DB TO VERIFY PERSISTENCE ---
    const finalInterviewDoc = await InterviewSession.findById(interviewId).lean();
    if (!finalInterviewDoc) {
        console.error("DEBUG: CRITICAL: Could not re-fetch interview after update for final logging.");
        return res.status(500).json({ message: "Failed to retrieve updated interview for verification." });
    }
    const updatedQuestion = finalInterviewDoc.generatedQuestions.find(q => q._id.toString() === questionId);

    console.log("DEBUG: AFTER DB UPDATE (final verified) - Question object details:", {
        _id: updatedQuestion._id,
        userAudioUrl: updatedQuestion.userAudioUrl ? updatedQuestion.userAudioUrl.substring(0, 50) + '...' : 'N/A',
        userAudioTranscription: updatedQuestion.userAudioTranscription ? updatedQuestion.userAudioTranscription.substring(0, 50) + '...' : 'N/A',
        isAnswered: updatedQuestion.isAnswered,
        userAnswer: updatedQuestion.userAnswer ? updatedQuestion.userAnswer.substring(0, 50) + '...' : 'N/A'
    });
    // --- END CRITICAL FIX ---

    res.status(200).json({ message: 'Answer saved successfully!', question: updatedQuestion });

  } catch (error) {
    console.error('❌ Error saving answer in catch block:', error);
    res.status(500).json({ message: 'Server Error during answer saving.', error: error.message });
  } finally {
      console.log("--- DEBUG: PUT /api/interview/:id/answer route finished ---");
  }
});
export default router;