// backend/routes/interviewRoutes.js
import { Router } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SpeechClient } from '@google-cloud/speech';
import InterviewSession from '../models/interviewSession.model.js';
import Job from '../models/job.Model.js';
import Skill from '../models/skill.model.js';
import multer from 'multer';
import protect from '../middleware/auth.js';

const router = Router();

const uploadAudio = multer({ storage: multer.memoryStorage() });

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });

const speechClient = new SpeechClient();

// Helper function to generate questions (no changes needed here)
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

// POST endpoint to start a new interview session (no changes needed here)
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

// GET endpoint to retrieve a specific interview session (no changes needed here)
router.get('/:id', protect, async (req, res) => {
  try {
    const interview = await InterviewSession.findById(req.params.id)
      .populate('selectedJobs', 'title')
      .populate('selectedSkills', 'name category');

    if (!interview) {
      return res.status(404).json({ message: 'Interview session not found.' });
    }

    if (interview.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to view this interview session.' });
    }

    res.status(200).json(interview);
  } catch (error) {
    console.error('Error fetching interview session:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// PUT endpoint to save an answer for a specific question (no changes needed here)
router.put('/:id/answer', protect, uploadAudio.single('audioFile'), async (req, res) => {
  const { id } = req.params;
  const { userAnswer, isAnswered, questionId } = req.body;
  const audioFile = req.file;
  let userAudioTranscription = '';
  let userAudioUrl = null;

  try {
    const interview = await InterviewSession.findById(id);

    if (!interview) {
      return res.status(404).json({ message: 'Interview session not found.' });
    }

    if (interview.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to modify this interview session.' });
    }

    const question = interview.generatedQuestions.id(questionId);
    if (!question) {
      return res.status(404).json({ message: 'Question not found in this interview session.' });
    }

    if (audioFile && audioFile.buffer) {
        console.log(`Received audio file: ${audioFile.originalname}, Size: ${audioFile.size} bytes`);
        userAudioUrl = `temp_url_for_audio_${questionId}.webm`;

        const audio = { content: audioFile.buffer.toString('base64'), };
        const config = {
            encoding: 'WEBM_OPUS',
            sampleRateHertz: 48000,
            languageCode: 'en-US',
            model: 'latest_long',
        };
        const request = { audio: audio, config: config, };

        try {
            const [response] = await speechClient.recognize(request);
            const transcription = response.results
                .map(result => result.alternatives[0].transcript)
                .join('\n');
            userAudioTranscription = transcription;
            console.log('Audio Transcription:', transcription);
        } catch (sttError) {
            console.error('Google STT Error:', sttError);
            userAudioTranscription = `Transcription failed: ${sttError.message}`;
        }
    }

    question.userAnswer = userAnswer || '';
    question.isAnswered = isAnswered === 'true';
    question.userAudioUrl = userAudioUrl;
    question.userAudioTranscription = userAudioTranscription;

    await interview.save();
    res.status(200).json({ message: 'Answer saved successfully!', question });

  } catch (error) {
    console.error('Error saving answer:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// UPDATED: PUT endpoint to mark interview as completed AND trigger evaluation with category scores
router.put('/:id/complete-and-evaluate', protect, async (req, res) => {
  const { id } = req.params;

  try {
    const interview = await InterviewSession.findById(id)
      .populate('selectedJobs', 'title')
      .populate('selectedSkills', 'name');

    if (!interview) {
      return res.status(404).json({ message: 'Interview session not found.' });
    }

    if (interview.userId.toString() !== req.user.id) {
        return res.status(403).json({ message: 'Not authorized to evaluate this interview session.' });
    }

    if (interview.status === 'evaluated') {
      return res.status(200).json({ message: 'Interview already evaluated.', interviewId: interview._id, status: interview.status });
    }

    if (interview.status !== 'completed') {
      interview.status = 'completed';
      interview.endTime = new Date();
    }

    let totalScore = 0;
    let questionsEvaluatedCount = 0;
    const evaluatedQuestions = [];

    for (const question of interview.generatedQuestions) {
      if (!question.isAnswered || (!question.userAnswer && !question.userAudioTranscription)) {
        evaluatedQuestions.push(question);
        continue;
      }

      const answerContent = question.userAudioTranscription || question.userAnswer;

      // --- UPDATED EVALUATION PROMPT for CATEGORY SCORES ---
      let evaluationPrompt = `You are an AI interview grader. The candidate applied for role(s): "${interview.selectedJobs.map(j => j.title).join(', ')}", and was assessed on skills: "${interview.selectedSkills.map(s => s.name).join(', ')}".`;
      if (interview.resumeText) {
          evaluationPrompt += ` Their resume snippet: "${interview.resumeText.substring(0, Math.min(interview.resumeText.length, 1000))}".`;
      }
      evaluationPrompt += `\n\nEvaluate the following answer to the question:\nQuestion: "${question.questionText}"\nCandidate's Answer: "${answerContent}"\n\n`;
      evaluationPrompt += `Provide a concise overall feedback summary (2-3 sentences). Then, list 2-3 specific strengths of the answer. Finally, list 2-3 specific areas for improvement. Give a numerical score from 1 (poor) to 10 (excellent) for this specific answer. Also provide a separate score (1-10) for "Technical Relevance", "Behavioral Aspects", and "Communication Clarity".\n`;
      evaluationPrompt += `Format your response strictly as follows:\n`;
      evaluationPrompt += `Summary: [Your feedback summary]\n`;
      evaluationPrompt += `Strengths: - [Strength 1]\n- [Strength 2]\n...\n`;
      evaluationPrompt += `Areas for Improvement: - [Improvement 1]\n- [Improvement 2]\n...\n`;
      evaluationPrompt += `Score: [Numerical score (1-10)]\n`;
      evaluationPrompt += `Technical Relevance: [Score 1-10]\n`;
      evaluationPrompt += `Behavioral Aspects: [Score 1-10]\n`;
      evaluationPrompt += `Communication Clarity: [Score 1-10]`;
      // --- END UPDATED PROMPT ---

      console.log(`\nDEBUG: Evaluation Prompt for QID ${question._id} (truncated):`, evaluationPrompt.substring(0, 300) + '...');

      try {
        const result = await model.generateContent(evaluationPrompt);
        const response = await result.response;
        const evaluationResponseContent = response.text();

        console.log(`DEBUG: Gemini Evaluation Response for QID ${question._id}:\n`, evaluationResponseContent);

        // --- UPDATED PARSING LOGIC for CATEGORY SCORES ---
        const summaryMatch = evaluationResponseContent.match(/Summary:\s*(.*?)(\n|$)/i);
        const strengthsMatch = evaluationResponseContent.match(/Strengths:\s*(-.*?)(?:\nAreas for Improvement:|- Score:|$)/is);
        const improvementsMatch = evaluationResponseContent.match(/Areas for Improvement:\s*(-.*?)(?:\nScore:|$)/is);
        const scoreMatch = evaluationResponseContent.match(/Score:\s*(\d+)/i);
        const techScoreMatch = evaluationResponseContent.match(/Technical Relevance:\s*(\d+)/i);
        const behaviorScoreMatch = evaluationResponseContent.match(/Behavioral Aspects:\s*(\d+)/i);
        const commScoreMatch = evaluationResponseContent.match(/Communication Clarity:\s*(\d+)/i);

        question.aiFeedbackSummary = summaryMatch ? summaryMatch[1].trim() : "No summary feedback generated.";
        question.aiStrengths = strengthsMatch ? strengthsMatch[1].split('\n').filter(s => s.trim().startsWith('-')).map(s => s.replace(/^-/, '').trim()) : [];
        question.aiAreasForImprovement = improvementsMatch ? improvementsMatch[1].split('\n').filter(s => s.trim().startsWith('-')).map(s => s.replace(/^-/, '').trim()) : [];
        question.aiScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
        
        // Populate new category scores
        question.aiCategoryScores = {
            technical: techScoreMatch ? parseInt(techScoreMatch[1], 10) : 0,
            behavioral: behaviorScoreMatch ? parseInt(behaviorScoreMatch[1], 10) : 0,
            softSkills: commScoreMatch ? parseInt(commScoreMatch[1], 10) : 0, // Using 'Communication Clarity' for softSkills
        };
        // --- END UPDATED PARSING ---

        totalScore += question.aiScore;
        questionsEvaluatedCount++;
        evaluatedQuestions.push(question);

      } catch (geminiError) {
        console.error(`Error evaluating question ${question._id} with Gemini AI:`, geminiError);
        question.aiFeedbackSummary = "Evaluation failed due to AI error.";
        question.aiStrengths = [];
        question.aiAreasForImprovement = [];
        question.aiScore = 0;
        question.aiCategoryScores = { technical: 0, behavioral: 0, softSkills: 0 };
        evaluatedQuestions.push(question);
      }
    }

    interview.generatedQuestions = evaluatedQuestions;
    interview.overallScore = questionsEvaluatedCount > 0 ? (totalScore / questionsEvaluatedCount) : 0;
    interview.status = 'evaluated';

    await interview.save();

    res.status(200).json({
      message: 'Interview completed and evaluated!',
      interviewId: interview._id,
      overallScore: interview.overallScore,
      status: interview.status
    });

  } catch (error) {
    console.error('Error completing and evaluating interview:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

// GET endpoint to retrieve all evaluated interview sessions for the logged-in user (no changes needed here)
router.get('/', protect, async (req, res) => {
  const userId = req.user.id;
  try {
    const interviews = await InterviewSession.find({ userId: userId, status: 'evaluated' })
      .select('overallScore startTime selectedJobs selectedSkills')
      .populate('selectedJobs', 'title')
      .populate('selectedSkills', 'name')
      .sort({ startTime: -1 });

    res.status(200).json(interviews);
  } catch (error) {
    console.error('Error fetching all interview sessions:', error);
    res.status(500).json({ message: 'Server Error', error: error.message });
  }
});

export default router;