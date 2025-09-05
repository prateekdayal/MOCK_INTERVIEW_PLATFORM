// backend/routes/resume.routes.js
import { Router } from 'express';
import multer from 'multer';
import PDFParser from 'pdf2json';
import mammoth from 'mammoth';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import protect from '../middleware/auth.js'; // <<< NEW IMPORT

const router = Router();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// --- DIAGNOSTIC LOG (Keep for now to ensure PDFParser is loaded correctly) ---
console.log("DEBUG: Type of imported PDFParser:", typeof PDFParser, PDFParser);
// --- END DIAGNOSTIC LOG ---

const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    try {
      await fs.mkdir(uploadDir, { recursive: true });
      cb(null, uploadDir);
    } catch (err) {
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

// POST endpoint to upload and parse resume - MUST BE PROTECTED
router.post('/upload', protect, upload.single('resume'), async (req, res) => { // <<< PROTECTED
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded.' });
  }

  const filePath = req.file.path;
  let resumeText = '';

  try {
    if (req.file.mimetype === 'application/pdf') {
        const pdfParser = new PDFParser();

        let extractedText = '';

        await new Promise((resolve, reject) => {
            pdfParser.on("pdfParser_dataError", errData => {
                console.error("PDF Parser Error:", errData.parserError);
                reject(new Error(`PDF parsing failed: ${errData.parserError}`));
            });

            pdfParser.on("pdfParser_dataReady", pdfData => {
                pdfData.Pages.forEach(page => {
                    page.Texts.forEach(text => {
                        extractedText += decodeURIComponent(text.R[0].T);
                    });
                    extractedText += '\n';
                });
                resolve();
            });

            pdfParser.parseBuffer(fs.readFile(filePath)); // Read file into buffer
        });

        resumeText = extractedText;

    } else if (req.file.mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') { // .docx
      const dataBuffer = await fs.readFile(filePath);
      const result = await mammoth.extractRawText({ buffer: dataBuffer });
      resumeText = result.value;
      if (result.messages.length > 0) {
        console.warn('Mammoth extraction messages:', result.messages);
      }
    } else if (req.file.mimetype === 'application/msword') { // .doc (older format)
      console.warn("Handling .doc files is complex and not fully implemented here. Proceeding with placeholder.");
      resumeText = "Content extraction for .doc files is not fully supported in this example. Please try PDF or DOCX.";
    } else if (req.file.mimetype === 'text/plain') {
      resumeText = await fs.readFile(filePath, 'utf8');
    } else {
      return res.status(400).json({ message: 'Unsupported file type for parsing.' });
    }

    await fs.unlink(filePath); // Clean up the uploaded file

    res.json({ message: 'Resume uploaded and parsed successfully!', resumeText });

  } catch (error) {
    console.error('Error processing resume file:', error);
    if (filePath) {
      await fs.unlink(filePath).catch(err => console.error('Error deleting temp file:', err));
    }
    res.status(500).json({ message: 'Failed to process resume file.', error: error.message });
  }
});

export default router;