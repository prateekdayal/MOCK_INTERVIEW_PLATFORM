// backend/models/interviewSession.model.js
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  questionType: { type: String, enum: ['behavioral', 'technical', 'situational', 'general'], default: 'general' },
  userAnswer: { type: String, default: '' },
  userAudioUrl: { type: String },
  userAudioTranscription: { type: String, default: '' },
  aiFeedbackSummary: { type: String, default: '' },
  aiStrengths: [{ type: String }],
  aiAreasForImprovement: [{ type: String }],
  // --- NEW: Category Scores ---
  aiCategoryScores: {
    technical: { type: Number, min: 0, max: 10, default: 0 },
    behavioral: { type: Number, min: 0, max: 10, default: 0 },
    softSkills: { type: Number, min: 0, max: 10, default: 0 },
    // You can add more categories like 'clarity', 'relevance', 'speech_delivery' if your prompt asks for them
  },
  // --- END NEW ---
  aiScore: { type: Number, min: 0, max: 10, default: 0 }, // This is the overall score for the question
  isAnswered: { type: Boolean, default: false },
  timestamp: { type: Date, default: Date.now }
});

const interviewSessionSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  selectedJobs: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Job', required: true }],
  selectedSkills: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Skill', required: true }],
  resumeText: { type: String },
  generatedQuestions: [questionSchema],
  overallScore: { type: Number, min: 0, max: 10, default: 0 },
  status: { type: String, enum: ['pending', 'in-progress', 'completed', 'evaluated'], default: 'pending' },
  startTime: { type: Date, default: Date.now },
  endTime: { type: Date },
}, { timestamps: true });

const InterviewSession = mongoose.model('InterviewSession', interviewSessionSchema);
export default InterviewSession;