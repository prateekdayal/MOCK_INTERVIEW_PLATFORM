// backend/models/interviewSession.model.js
import mongoose from 'mongoose';

const questionSchema = new mongoose.Schema({
  questionText: { type: String, required: true },
  questionType: { type: String, enum: ['behavioral', 'technical', 'situational', 'general'], default: 'general' },
  userAnswer: { type: String, default: '' },
  userAudioUrl: { type: String }, // Placeholder URL for now, GCS later
  userAudioTranscription: { type: String, default: '' },
  aiFeedbackSummary: { type: String, default: '' },
  aiStrengths: [{ type: String }],
  aiAreasForImprovement: [{ type: String }],
  aiCategoryScores: {
    technical: { type: Number, min: 0, max: 10, default: 0 },
    behavioral: { type: Number, min: 0, max: 10, default: 0 },
    softSkills: { type: Number, min: 0, max: 10, default: 0 },
  },
  aiScore: { type: Number, min: 0, max: 10, default: 0 },
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

// --- CRITICAL CHANGE HERE ---
// This prevents Mongoose from trying to recompile the model if it already exists
const InterviewSession = mongoose.models.InterviewSession || mongoose.model('InterviewSession', interviewSessionSchema);
// --- END CRITICAL CHANGE ---

export default InterviewSession;