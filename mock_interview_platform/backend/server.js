// backend/server.js
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import listRoutes from 'express-list-routes';
import path from 'path';

// --- For __dirname in ES modules ---
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// ---

// --- Socket.IO Imports ---
import { createServer } from 'http'; // To create HTTP server for Express and Socket.IO
import { Server } from 'socket.io';   // Socket.IO Server
// --- END Socket.IO Imports ---

// --- DIAGNOSTIC LOGS for Environment Variables ---
console.log("\n--- SERVER START DEBUG ---");
console.log("DEBUG: After dotenv/config, MONGO_URI:", process.env.MONGO_URI ? "Loaded" : "UNDEFINED");
console.log("DEBUG: After dotenv/config, GEMINI_API_KEY:", process.env.GEMINI_API_KEY ? "(Loaded)" : "UNDEFINED");
console.log("DEBUG: After dotenv/config, GOOGLE_APPLICATION_CREDENTIALS:", process.env.GOOGLE_APPLICATION_CREDENTIALS ? "Loaded" : "UNDEFINED");
console.log("DEBUG: After dotenv/config, JWT_SECRET:", process.env.JWT_SECRET ? `(Loaded: ${process.env.JWT_SECRET.substring(0, 10)}...)` : "UNDEFINED");
console.log("DEBUG: After dotenv/config, JWT_EXPIRE:", process.env.JWT_EXPIRE || "UNDEFINED");
console.log("--- END SERVER START DEBUG ---\n");

// routes
import jobRoutes from "./routes/jobRoutes.js";
import resumeRouter from "./routes/resume.routes.js";
import skillsRouter from "./routes/skills.routes.js";
import interviewRoutes from "./routes/interviewRoutes.js"; // This will now only have HTTP GET/POST routes
import authRoutes from "./routes/authRoutes.js";

import setupInterviewSocketHandlers from './sockets/interviewSocketHandlers.js'; // Socket.IO Handlers

const app = express();
app.use(cors());
app.use(express.json());

const uploadsPath = path.join(__dirname, 'uploads');
app.use('/uploads', express.static(uploadsPath));
console.log(`DEBUG: Static /uploads route configured to serve from: ${uploadsPath}`);

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err.message));

app.use("/api/jobs", jobRoutes);
app.use("/api/resume", resumeRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/interview", interviewRoutes); // HTTP routes for interview (GET /:id, GET /, POST /start)
app.use("/api/auth", authRoutes);

console.log("\n--- REGISTERED EXPRESS ROUTES (HTTP Only) ---");
listRoutes(app);
console.log("---------------------------------\n");

app.get('/', (req, res) => {
  res.send('AI Mock Interview Platform Backend is Running!');
});

app.use((req, res, next) => {
    console.warn(`404: Unhandled HTTP route - Method: ${req.method}, Path: ${req.originalUrl}`);
    res.status(404).json({ message: 'Sorry, that HTTP route does not exist.' });
});

// --- CRITICAL: Create HTTP server and attach Socket.IO ---
const httpServer = createServer(app); // Express app now mounted on HTTP server
const io = new Server(httpServer, {
    cors: {
        origin: "http://localhost:5173", // Frontend URL
        methods: ["GET", "POST", "PUT"], // Socket.IO itself doesn't use these methods, but CORS needs to know for handshake
        credentials: true
    },
    maxHttpBufferSize: 1e8 // 100 MB - Crucial for large video uploads
});

setupInterviewSocketHandlers(io); // Attach Socket.IO handlers

const PORT = process.env.PORT || 5000;
httpServer.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT} (HTTP & Socket.IO)`)); // Listen on httpServer