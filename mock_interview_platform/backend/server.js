// backend/server.js
import "dotenv/config";
import express from "express";
import mongoose from "mongoose";
import cors from "cors";
import listRoutes from 'express-list-routes'; // <<< NEW IMPORT

// --- DIAGNOSTIC LOGS ---
console.log("\n--- SERVER START DEBUG ---");
console.log("DEBUG: After dotenv/config, MONGO_URI:", process.env.MONGO_URI ? "Loaded" : "UNDEFINED");
console.log("DEBUG: After dotenv/config, JWT_SECRET:", process.env.JWT_SECRET ? "(Loaded)" : "UNDEFINED");
console.log("DEBUG: After dotenv/config, JWT_EXPIRE:", process.env.JWT_EXPIRE || "UNDEFINED");
console.log("--- END SERVER START DEBUG ---\n");

// routes
import jobRoutes from "./routes/jobRoutes.js";
import resumeRouter from "./routes/resume.routes.js";
import skillsRouter from "./routes/skills.routes.js";
import interviewRoutes from "./routes/interviewRoutes.js";
import authRoutes from "./routes/authRoutes.js";

const app = express();
app.use(cors());
app.use(express.json());

// connect to MongoDB
mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("✅ MongoDB connected"))
  .catch(err => console.error("❌ MongoDB connection error:", err.message));

// register routes
app.use("/api/jobs", jobRoutes);
app.use("/api/resume", resumeRouter);
app.use("/api/skills", skillsRouter);
app.use("/api/interview", interviewRoutes);
app.use("/api/auth", authRoutes);

// --- NEW: List all registered routes at startup ---
console.log("\n--- REGISTERED EXPRESS ROUTES ---");
listRoutes(app); // This will print your routes to the console
console.log("---------------------------------\n");
// --- END NEW ---

// Basic route for testing server status
app.get('/', (req, res) => {
  res.send('AI Mock Interview Platform Backend is Running!');
});

// Fallback for unhandled routes - this will catch the 404
app.use((req, res, next) => {
    console.warn(`404: Unhandled route - Method: ${req.method}, Path: ${req.originalUrl}`);
    res.status(404).json({ message: 'Sorry, that route does not exist.' });
});

// start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`✅ Server running on http://localhost:${PORT}`));