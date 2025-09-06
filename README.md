The AI Mock Interview Platform is a full-stack web application designed to help users prepare for job interviews through AI-powered mock sessions. It guides users through selecting desired job roles and skills, uploading their resume, and then conducts a simulated interview using AI-generated questions. The platform captures user's video and audio responses, transcribes them, and provides detailed AI-driven feedback, including overall scores, strengths, areas for improvement, and category-specific scores. Users can also review their past interview performance and track their progress.

This project was built following a multi-step development process, focusing on core functionalities and AI integration.

## Features

**Core Interview Workflow:**
*   **User Authentication:** Secure registration and login system with JWTs.
*   **Job Selection:** Browse and select multiple job titles from a searchable list.
*   **Skill Selection:** Choose multiple relevant skills from a categorized, searchable list.
*   **Resume Upload:** Upload resume files (PDF, DOCX, TXT) for AI-driven question tailoring.
*   **Interactive Interview Interface:**
    *   Webcam video preview during the interview.
    *   Audio recording functionality for answers.
    *   Countdown timer per question with auto-advance.
    *   Navigation between questions (Previous/Next).
*   **AI-Powered Question Generation:** Generates dynamic interview questions based on selected jobs, skills, and resume content using Google Gemini.

**Feedback & Progress Tracking:**
*   **AI-Driven Answer Evaluation:** Provides comprehensive feedback on user answers, including:
    *   Overall score per question (1-10).
    *   Concise summary of feedback.
    *   Specific strengths identified.
    *   Specific areas for improvement.
    *   Category-specific scores (Technical Relevance, Behavioral Aspects, Communication Clarity).
*   **Speech-to-Text Transcription:** Transcribes recorded audio answers using Google Cloud Speech-to-Text API.
*   **Feedback Dashboard:** Displays detailed per-question and aggregated overall feedback.
*   **Audio Playback:** Playback of recorded audio answers (currently using temporary URLs; requires cloud storage for persistence).
*   **Past Interviews History:** View a list of all completed interviews with summary scores, jobs, and skills.
*   **Interview Filtering:** Filter past interviews by job title, skill, and date range.
*   **Score Trend Graph:** Visualizes overall score trends over time using Chart.js.
*   **Download Report:** Generates a downloadable text report of the interview session.

## Technologies Used

**Backend (Node.js/Express):**
*   **Framework:** Express.js
*   **Database:** MongoDB (via Mongoose ODM)
*   **Authentication:** JWT (JSON Web Tokens), `bcryptjs` for password hashing.
*   **Environment Variables:** `dotenv`
*   **File Uploads:** `multer`
*   **Resume Parsing:** `pdf2json` (for PDF), `mammoth` (for DOCX).
*   **AI Integration:**
    *   `@google/generative-ai` (for Google Gemini API - `gemini-2.0-flash` model for NLP).
    *   `@google-cloud/speech` (for Google Cloud Speech-to-Text API for audio transcription).
*   **Utilities:** `cors`, `express-list-routes` (for debugging).

**Frontend (React.js):**
*   **Framework:** React.js (created with Vite)
*   **State Management:** React `useState`, `useEffect`, `useRef`, `useContext` for `AuthContext`.
*   **API Calls:** `axios`
*   **Date Formatting:** `moment`
*   **Charting:** `chart.js`, `react-chartjs-2`
*   **Media Capture:** WebRTC `navigator.mediaDevices.getUserMedia`, `MediaRecorder API`.
*   **Styling:** Inline React styles (for rapid prototyping).

## Local Setup & Installation

Follow these steps to get the project up and running on your local machine.

### Prerequisites

*   **Node.js & npm:** Ensure Node.js (v18 or higher recommended) and npm are installed. You can download them from [nodejs.org](https://nodejs.org/).
*   **MongoDB:** A running MongoDB instance (local or Atlas).
    *   **Local MongoDB:** If running locally, ensure your `mongod` process is active.
    *   **MongoDB Atlas:** If using Atlas, ensure you have a cluster, a database user with password, and Network Access configured (e.g., `0.0.0.0/0` for testing, but restrict for production).
*   **Google Cloud Project:**
    *   Enable **Generative Language API** (for Gemini).
    *   Enable **Cloud Speech-to-Text API**.
    *   Create a **Service Account** with roles like "Generative Language API User", "Speech-to-Text User", and (if you ever integrate GCS) "Storage Object Admin".
    *   Download the **JSON key file** for this service account.
