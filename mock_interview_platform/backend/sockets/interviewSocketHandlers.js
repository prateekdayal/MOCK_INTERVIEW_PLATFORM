// backend/sockets/interviewSocketHandlers.js
import InterviewSession from '../models/interviewSession.model.js';
import User from '../models/user.model.js'; // Ensure User model is available for socketAuth
import Job from '../models/job.Model.js';
import Skill from '../models/skill.model.js';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { SpeechClient } from '@google-cloud/speech';
import jwt from 'jsonwebtoken';
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from 'url';
import mongoose from 'mongoose'; // For mongoose.Types.ObjectId if needed, and to check mongoose.models

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const geminiModel = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
const speechClient = new SpeechClient();

// Helper function to generate questions (same as before)
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
      prompt += `Here is their resume (snippet):\n"${resumeText.substring(
        0,
        Math.min(resumeText.length, 2000)
      )}"\n`;
    }
    prompt += `The questions should cover technical, behavioral, and situational aspects. Format as a numbered list.`;

    try {
      const result = await geminiModel.generateContent(prompt);
      const response = await result.response;
      const responseContent = response.text();

      const questions = responseContent
        .split("\n")
        .filter((line) => line.match(/^\s*\d+\./))
        .map((line) => line.replace(/^\s*\d+\.\s*/, "").trim())
        .filter((q) => q.length > 10 && q.endsWith("?"))
        .map((q) => ({ questionText: q }));

      return questions;
    } catch (error) {
      console.error("Error generating questions with Gemini AI:", error);
      throw new Error("Failed to generate interview questions.");
    }
}


// Socket.IO Authentication Middleware
const socketAuth = async (socket, next) => {
    const token = socket.handshake.auth.token; // Or socket.handshake.headers.authorization
    if (!token) {
        console.warn("SocketAuth: No token provided. Disconnecting socket.");
        return next(new Error('Authentication error: No token.'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // Find user by ID from the token payload (use User model if imported, otherwise direct MongoDB driver)
        // Here we use User model, assuming it's correctly defined and available
        const User = mongoose.models.User || mongoose.model('User'); // Safely get User model
        const user = await User.findById(decoded.id); 

        if (!user) {
            console.warn("SocketAuth: User not found for token. Disconnecting socket.");
            return next(new Error('Authentication error: User not found.'));
        }
        socket.user = user; // Attach user to the socket object
        console.log("SocketAuth: User authenticated:", user.username);
        next();
    } catch (error) {
        console.error("SocketAuth: Token verification failed:", error.message);
        next(new Error('Authentication error: Invalid or expired token.'));
    }
};


const setupInterviewSocketHandlers = (io) => {
    io.use(socketAuth); // Apply authentication middleware to all incoming socket connections

    io.on('connection', (socket) => {
        console.log('✅ Socket.IO: User connected:', socket.user.username, socket.id);

        // --- Event for starting a new interview (Frontend still uses HTTP POST /api/interview/start) ---
        // This event handler is NOT NEEDED if App.jsx uses HTTP POST /api/interview/start
        // If App.jsx was emitting 'startInterview' socket event, this would be the handler.
        socket.on('startInterview', async (interviewData, callback) => {
            console.log(`Socket: Received 'startInterview' event from user ${socket.user.username}`);
            const { selectedJobs, selectedSkills, resumeText } = interviewData;
            const userId = socket.user._id;

            if (!selectedJobs?.length || !selectedSkills?.length) {
              return callback({ status: 400, message: "At least one job and one skill required." });
            }

            try {
              const generatedQuestions = await generateInterviewQuestions({
                selectedJobs,
                selectedSkills,
                resumeText,
              });

              if (!generatedQuestions.length) {
                return callback({ status: 500, message: "No questions generated." });
              }

              const newInterview = new InterviewSession({
                userId,
                selectedJobs,
                selectedSkills,
                resumeText,
                generatedQuestions,
                status: "in-progress",
              });

              await newInterview.save();
              console.log("Socket: Interview session created in DB:", newInterview._id);

              callback({
                status: 201,
                message: "Interview started!",
                interviewId: newInterview._id,
                firstQuestion: newInterview.generatedQuestions[0].questionText,
                totalQuestions: newInterview.generatedQuestions.length,
              });
            } catch (error) {
              console.error("Socket: Error starting interview:", error);
              callback({ status: 500, message: error.message });
            }
        });


        // --- Event for saving an answer (replaces PUT /api/interview/:id/answer) ---
        socket.on('saveAnswer', async ({ interviewId, questionId, userAnswer, mediaBlob }, callback) => {
            console.log(`Socket: Received 'saveAnswer' event for interview ${interviewId}, question ${questionId}`);
            const userId = socket.user._id;

            try {
                // Find interview for validation and update
                const interview = await InterviewSession.findById(interviewId);
                if (!interview) {
                    console.warn("Socket: Interview not found for ID:", interviewId);
                    return callback({ status: 404, message: "Interview not found." });
                }
                if (interview.userId.toString() !== userId.toString()) {
                    console.warn("Socket: User not authorized for interview ID:", interviewId);
                    return callback({ status: 403, message: "Not authorized." });
                }

                const questionIndex = interview.generatedQuestions.findIndex(q => q._id.toString() === questionId);
                if (questionIndex === -1) {
                    console.warn("Socket: Question not found for ID:", questionId);
                    return callback({ status: 404, message: "Question not found." });
                }

                let transcription = "";
                let audioUrl = null;
                let mediaBuffer = null;
                let mediaMimeType = null;

                if (mediaBlob) { // Check if blob was sent
                    mediaBuffer = Buffer.from(mediaBlob.data); // Convert ArrayBuffer from frontend to Node.js Buffer
                    mediaMimeType = mediaBlob.type;
                    console.log(`Socket: Media blob received (size: ${mediaBuffer.length}, type: ${mediaMimeType})`);

                    // --- Local File Storage ---
                    const uploadsBaseDir = path.join(__dirname, '../uploads'); // Relative to sockets/interviewSocketHandlers.js
                    await fs.mkdir(uploadsBaseDir, { recursive: true });

                    const fileName = `${interviewId}_${questionId}_${Date.now()}.${mediaMimeType.split('/')[1].split(';')[0].replace(/[^a-z0-9]/gi, '_')}`;
                    const filePath = path.join(uploadsBaseDir, fileName);
                    await fs.writeFile(filePath, mediaBuffer);

                    audioUrl = `/uploads/${fileName}`; // Relative URL for static serving
                    console.log(`✅ Socket: Local media file saved: ${filePath}`);
                    console.log(`DEBUG: Socket: Local audioUrl set: ${audioUrl}`);

                    // --- Attempt STT ---
                    try {
                      let encoding;
                      let sampleRateHertz = 48000; 
                      
                      if (mediaMimeType.includes('webm') && mediaMimeType.includes('opus')) {
                          encoding = 'WEBM_OPUS';
                          console.log("DEBUG: Socket STT Config: Using WEBM_OPUS for WebM/Opus.");
                      } else if (mediaMimeType.includes('webm')) {
                          encoding = 'WEBM_OPUS'; 
                          console.log("DEBUG: Socket STT Config: Using WEBM_OPUS for generic WebM.");
                      } else if (mediaMimeType.includes('mp4')) {
                          encoding = 'MP4_AUDIO'; 
                          sampleRateHertz = 48000;
                          console.warn("DEBUG: Socket STT: Media is MP4. Attempting MP4_AUDIO encoding. This requires specific client-side MP4 audio encoding.");
                      } else if (mediaMimeType.includes('ogg')) {
                          encoding = 'OGG_OPUS';
                          sampleRateHertz = 48000;
                          console.log("DEBUG: Socket STT Config: Using OGG_OPUS for Ogg.");
                      } else if (mediaMimeType.startsWith('audio/')) {
                           encoding = 'ENCODING_UNSPECIFIED';
                           sampleRateHertz = 0;
                           console.warn("DEBUG: Socket STT: Generic audio type. Using ENCODING_UNSPECIFIED.");
                      } else {
                          encoding = 'ENCODING_UNSPECIFIED';
                          sampleRateHertz = 0;
                          console.warn("DEBUG: Socket STT: Fallback for unknown media MIME type. Using ENCODING_UNSPECIFIED.");
                      }

                      const config = {
                          encoding: encoding,
                          sampleRateHertz: sampleRateHertz,
                          languageCode: 'en-US',
                          model: 'latest_long',
                          enableAutomaticPunctuation: true,
                      };
                      if (mediaMimeType.startsWith('video')) {
                          config.enableWordTimeOffsets = false;
                      }
                      console.log("DEBUG: Socket STT Config sent to Google:", JSON.stringify(config));

                      const [response] = await speechClient.recognize({
                          audio: { content: mediaBuffer.toString("base64") },
                          config: config,
                      });
                      transcription = response.results.map((r) => r.alternatives[0].transcript).join("\n");
                      console.log('✅ Socket: Audio Transcription:', transcription);
                    } catch (sttError) {
                      console.error("❌ Socket: STT Error:", sttError.message);
                      transcription = `Transcription failed: ${sttError.message}`;
                    }
                } else {
                    console.log("Socket: No media blob provided for this answer.");
                }

                // Update question in DB
                const newIsAnswered = !!userAnswer?.trim() || !!transcription?.trim();
                
                // --- CRITICAL FIX: Use findOneAndUpdate with positional operator ---
                const updateQuery = { _id: interviewId, "generatedQuestions._id": questionId };
                const updateOperation = {
                    $set: {
                        [`generatedQuestions.${questionIndex}.userAnswer`]: userAnswer || "",
                        [`generatedQuestions.${questionIndex}.userAudioUrl`]: audioUrl,
                        [`generatedQuestions.${questionIndex}.userAudioTranscription`]: transcription,
                        [`generatedQuestions.${questionIndex}.isAnswered`]: newIsAnswered,
                    },
                };
                const updatedInterview = await InterviewSession.findOneAndUpdate(
                    updateQuery,
                    updateOperation,
                    { new: true, runValidators: true }
                ).lean();

                if (!updatedInterview) {
                    console.error("Socket: findOneAndUpdate returned null, interview/question not found for update (or failed).");
                    return callback({ status: 404, message: "Failed to update interview question." });
                }

                const updatedQuestion = updatedInterview.generatedQuestions.find(q => q._id.toString() === questionId);
                console.log(`DEBUG: Socket: Question ${questionId} updated in DB. isAnswered: ${updatedQuestion.isAnswered}, AudioURL: ${updatedQuestion.userAudioUrl}`);

                callback({ status: 200, message: "Answer saved!", question: updatedQuestion });
            } catch (error) {
                console.error("Socket: Error saving answer:", error);
                callback({ status: 500, message: error.message });
            }
        });
// Socket.IO Authentication Middleware
const socketAuth = async (socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        console.warn("SocketAuth: No token provided. Disconnecting socket.");
        return next(new Error('Authentication error: No token.'));
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        // --- CRITICAL: Ensure User model is accessed reliably ---
        const User = mongoose.models.User || mongoose.model('User'); // Safely get User model
        const user = await User.findById(decoded.id); 
        // --- END CRITICAL ---

        if (!user) {
            console.warn("SocketAuth: User not found for token. Disconnecting socket.");
            return next(new Error('Authentication error: User not found.'));
        }
        socket.user = user;
        console.log("SocketAuth: User authenticated:", user.username);
        next();
    } catch (error) {
        console.error("SocketAuth: Token verification failed:", error.message);
        next(new Error('Authentication error: Invalid or expired token.'));
    }
};

        // --- Event for completing evaluation (replaces PUT /api/interview/:id/complete-and-evaluate) ---
        socket.on('completeAndEvaluate', async (interviewId, callback) => {
            console.log(`Socket: Received 'completeAndEvaluate' event for interview ${interviewId}`);
            const userId = socket.user._id;

            try {
                const interview = await InterviewSession.findById(interviewId)
                    .populate("selectedJobs", "title")
                    .populate("selectedSkills", "name");

                if (!interview) return callback({ status: 404, message: "Interview not found." });
                if (interview.userId.toString() !== userId.toString()) return callback({ status: 403, message: "Not authorized." });
                if (interview.status === "evaluated") return callback({ status: 200, message: "Interview already evaluated." });

                interview.status = "completed";
                interview.endTime = new Date();

                let totalScore = 0;
                let questionsEvaluatedCount = 0;
                const evaluatedQuestions = [];

                for (const question of interview.generatedQuestions) {
                    const hasContent = !!question.userAnswer?.trim() || !!question.userAudioTranscription?.trim();
                    if (!hasContent) {
                        evaluatedQuestions.push(question);
                        continue;
                    }

                    const answerContent = question.userAudioTranscription || question.userAnswer;
                    let evaluationPrompt = `You are an AI interview grader. The candidate applied for role(s): "${interview.selectedJobs.map((j) => j.title).join(", ")}", and was assessed on skills: "${interview.selectedSkills.map((s) => s.name).join(", ")}".`;
                    if (interview.resumeText) {
                        evaluationPrompt += ` Their resume snippet: "${interview.resumeText.substring(
                            0,
                            Math.min(interview.resumeText.length, 1000)
                        )}".`;
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


                    try {
                        const result = await geminiModel.generateContent(evaluationPrompt);
                        const responseContent = result.response.text();

                        const summaryMatch = responseContent.match(/Summary:\s*(.*?)(\n|$)/i);
                        const strengthsMatch = responseContent.match(/Strengths:\s*(-.*?)(?:\nAreas for Improvement:|- Score:|$)/is);
                        const improvementsMatch = responseContent.match(/Areas for Improvement:\s*(-.*?)(?:\nScore:|$)/is);
                        const scoreMatch = responseContent.match(/Score:\s*(\d+)/i);
                        const techScoreMatch = responseContent.match(/Technical Relevance:\s*(\d+)/i);
                        const behaviorScoreMatch = responseContent.match(/Behavioral Aspects:\s*(\d+)/i);
                        const commScoreMatch = responseContent.match(/Communication Clarity:\s*(\d+)/i);

                        question.aiFeedbackSummary = summaryMatch ? summaryMatch[1].trim() : "No summary feedback generated.";
                        question.aiStrengths = strengthsMatch ? strengthsMatch[1].split("\n").filter((s) => s.trim().startsWith("-")).map((s) => s.replace(/^-/, "").trim()) : [];
                        question.aiAreasForImprovement = improvementsMatch ? improvementsMatch[1].split("\n").filter((s) => s.trim().startsWith("-")).map((s) => s.replace(/^-/, "").trim()) : [];
                        question.aiScore = scoreMatch ? parseInt(scoreMatch[1], 10) : 0;
                        question.aiCategoryScores = {
                            technical: techScoreMatch ? parseInt(techScoreMatch[1], 10) : 0,
                            behavioral: behaviorScoreMatch ? parseInt(behaviorScoreMatch[1], 10) : 0,
                            softSkills: commScoreMatch ? parseInt(commScoreMatch[1], 10) : 0,
                        };
                        totalScore += question.aiScore;
                        questionsEvaluatedCount++;
                    } catch (geminiError) {
                        console.error("Socket: Evaluation Error:", geminiError);
                        question.aiFeedbackSummary = "Evaluation failed due to AI error.";
                        question.aiScore = 0;
                        question.aiCategoryScores = { technical: 0, behavioral: 0, softSkills: 0 };
                    } finally {
                        evaluatedQuestions.push(question); // Ensure question is added even if evaluation failed
                    }
                }

                interview.generatedQuestions = evaluatedQuestions;
                interview.overallScore = questionsEvaluatedCount > 0 ? totalScore / questionsEvaluatedCount : 0;
                interview.status = "evaluated";
                await interview.save();
                console.log(`Socket: Interview ${interviewId} completed and evaluated.`);

                callback({
                    status: 200,
                    message: "Interview completed and evaluated!",
                    interviewId: interview._id,
                    overallScore: interview.overallScore,
                    status: interview.status,
                });
            } catch (error) {
                console.error("Socket: Error completing evaluation:", error);
                callback({ status: 500, message: error.message });
            }
        });

        socket.on('disconnect', () => {
            console.log('❌ Socket.IO: User disconnected:', socket.id, socket.user?.username);
        });
    });
};

export default setupInterviewSocketHandlers;