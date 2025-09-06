// backend/routes/resume.routes.js
import { Router } from 'express';
import multer from 'multer';
import PDFParser from 'pdf2json'; // Correct import for pdf2json
import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import protect from '../middleware/auth.js';

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- DIAGNOSTIC LOG (Keep for now to ensure PDFParser is loaded correctly) ---
console.log("DEBUG: resume.routes.js file loaded.");
console.log("DEBUG: Type of imported PDFParser:", typeof PDFParser, PDFParser);
// --- END DIAGNOSTIC LOG ---

// Configure Multer for file storage (saves to a temporary 'uploads' directory)
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
      console.error('DEBUG: Multer destination mkdir error:', err);
      cb(err, uploadDir);
    }
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB file size limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only PDF, DOC, DOCX, and TXT files are allowed.'), false);
    }
  }
});

// POST endpoint to upload and parse resume - PROTECTED
router.post('/upload', protect, upload.single('resume'), async (req, res) => {
  console.log("DEBUG: Hit POST /api/resume/upload endpoint.");
  if (!req.file) {
    console.warn("DEBUG: No file received by Multer.");
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  console.log(`DEBUG: File received: ${req.file.originalname}, MimeType: ${req.file.mimetype}, Path: ${req.file.path}`);
  const filePath = req.file.path;
  let resumeText = '';

  try {
    if (req.file.mimetype === 'application/pdf') {
        console.log("DEBUG: Attempting PDF parsing.");
        const pdfParser = new PDFParser();
        let extractedText = '';

        await new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataError", errData => {
                console.error("DEBUG: PDF Parser Error (pdfParser_dataError):", errData.parserError);
                reject(new Error(`PDF parsing failed: ${errData.parserError}`));
            });

            pdfParser.on("pdfParser_dataReady", pdfData => {
                console.log("DEBUG: PDF Parser dataReady.");
                pdfData.Pages.forEach(page => {
                    page.Texts.forEach(text => {
                        extractedText += decodeURIComponent(text.R[0].T);
                    });
                    extractedText += '\n';
                });
                resolve();
            });

            // CRITICAL: Ensure fs.readFile returns a Promise that resolves to a Buffer
            fs.readFile(filePath)
              .then(buffer => pdfParser.parseBuffer(buffer))
              .catch(reject); // Pass file buffer
        });
        resumeText = extractedText;
        console.log("DEBUG: PDF parsing complete. Length:", resumeText.length);

    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { // .docx
      console.log("DEBUG: Attempting DOCX parsing.");
      const dataBuffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      resumeText = result.value;
      if (result.messages.length > 0) {
        console.warn('DEBUG: Mammoth extraction messages:', result.messages);
      }
      console.log("DEBUG: DOCX parsing complete. Length:", resumeText.length);
    } else if (req.file.mimetype === 'application/msword') { // .doc (older format)
      console.log("DEBUG: .doc file detected.");
      console.warn("Handling .doc files is complex and not fully implemented here. Proceeding with placeholder.");
      resumeText = "Content extraction for .doc files is not fully supported in this example. Please try PDF or DOCX.";
    } else if (req.file.mimetype === 'text/plain') {
      console.log("DEBUG: Attempting TXT parsing.");
      resumeText = await fs.readFile(filePath, 'utf8');
      console.log("DEBUG: TXT parsing complete. Length:", resumeText.length);
    } else {
      console.warn("DEBUG: Unsupported file type, fell through filters.");
      return res.status(400).json({ message: 'Unsupported file type for parsing.' });
    }

    // Clean up the uploaded file after processing
    console.log(`DEBUG: Deleting temporary file: ${filePath}`);
    await fs.unlink(filePath);

    res.json({ message: 'Resume uploaded and parsed successfully!', resumeText });

  } catch (error) {
    console.error('DEBUG: Error processing resume file in catch block:', error);
    if (filePath) {
      console.log(`DEBUG: Attempting to delete temporary file ${filePath} on error.`);
      await fs.unlink(filePath).catch(err => console.error('DEBUG: Error deleting temp file on error:', err));
    }
    res.status(500).json({ message: 'Failed to process resume file.', error: error.message });
  }
});

export default router;