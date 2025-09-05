// frontend/src/pages/ResumeUpload.jsx
import React, { useState } from 'react';
import axios from 'axios';

const ResumeUpload = ({ onResumeUploaded }) => {
  const [resumeFile, setResumeFile] = useState(null);
  const [resumeTextPreview, setResumeTextPreview] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleFileChange = (event) => {
    const file = event.target.files[0];
    if (file) {
      setResumeFile(file);
      setError(null); // Clear previous errors
    } else {
      setResumeFile(null);
      setResumeTextPreview('');
      onResumeUploaded('');
      setError(null);
    }
  };

  const handleUpload = async () => {
    if (!resumeFile) {
      setError("Please select a file to upload.");
      return;
    }

    setLoading(true);
    setError(null);

    const formData = new FormData();
    formData.append('resume', resumeFile);

    try {
      // Assuming your backend /api/resume/upload endpoint handles file upload
      // and returns the extracted text.
      const response = await axios.post('http://localhost:5000/api/resume/upload', formData, { // Adjust port if needed
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      const extractedText = response.data.resumeText;
      setResumeTextPreview(extractedText.substring(0, 200) + (extractedText.length > 200 ? '...' : ''));
      onResumeUploaded(extractedText); // Pass the full text to App.jsx
    } catch (err) {
      console.error('Error uploading or parsing resume:', err);
      setError('Failed to upload or parse resume. Please ensure it is a valid PDF/DOCX or try again.');
      onResumeUploaded(''); // Clear resume text on error
    } finally {
      setLoading(false);
    }
  };

  const handleSkip = () => {
    onResumeUploaded(''); // Pass an empty string if skipped
  };

  return (
    <div>
      <h2>3. Upload Your Resume</h2>
      <p>Upload your resume (PDF, DOCX, TXT) to help us tailor the mock interview questions. Your resume will not be stored permanently.</p>
      
      <input 
        type="file" 
        accept=".pdf,.doc,.docx,.txt" 
        onChange={handleFileChange} 
        style={{ marginBottom: '15px', display: 'block' }}
      />
      
      {error && <p style={{ color: 'red', marginBottom: '15px' }}>{error}</p>}

      {resumeFile && (
        <div style={{ marginBottom: '15px', backgroundColor: '#f5f5f5', padding: '10px', borderRadius: '4px', border: '1px solid #eee' }}>
          <strong>Selected File:</strong> {resumeFile.name} ({Math.round(resumeFile.size / 1024)} KB)
        </div>
      )}

      {resumeTextPreview && (
        <div style={{ marginTop: '15px', padding: '10px', border: '1px solid #eee', borderRadius: '4px', backgroundColor: '#f9f9f9' }}>
          <strong>Resume Text Preview:</strong>
          <p style={{ whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto', fontSize: '0.9em' }}>{resumeTextPreview}</p>
        </div>
      )}

      <div style={{ marginTop: '20px', display: 'flex', gap: '10px' }}>
        <button 
          onClick={handleUpload}
          disabled={!resumeFile || loading}
          style={{ 
            padding: '12px 24px',
            backgroundColor: (resumeFile && !loading) ? '#2196f3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: (resumeFile && !loading) ? 'pointer' : 'not-allowed',
            opacity: (resumeFile && !loading) ? 1 : 0.7
          }}
        >
          {loading ? 'Uploading...' : 'Upload & Continue →'}
        </button>
        <button 
          onClick={handleSkip}
          disabled={loading}
          style={{ 
            padding: '12px 24px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            opacity: loading ? 0.7 : 1
          }}
        >
          Skip for now →
        </button>
      </div>
    </div>
  );
};

export default ResumeUpload;