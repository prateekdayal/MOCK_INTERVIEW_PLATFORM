// frontend/src/components/FeedbackDashboard.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import moment from 'moment';

const FeedbackDashboard = ({ interviewSessionId, onRetakeInterview, onReviewPastInterviews }) => {
  const [interview, setInterview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [expandedQuestions, setExpandedQuestions] = useState({});

  useEffect(() => {
    const fetchInterviewDetails = async () => {
      console.log("DEBUG: FeedbackDashboard: Fetching interview details for ID:", interviewSessionId);
      try {
        const response = await axios.get(`http://localhost:5000/api/interview/${interviewSessionId}`);
        setInterview(response.data);
        console.log("DEBUG: FeedbackDashboard: Interview data fetched successfully.");
        response.data.generatedQuestions.forEach((q, idx) => {
            console.log(`  Q${idx + 1} (Fetched DB data): userAudioUrl: ${q.userAudioUrl ? q.userAudioUrl.substring(0,50) + '...' : 'N/A'}, Transcription: ${q.userAudioTranscription ? q.userAudioTranscription.substring(0,50) + '...' : 'N/A'}, isAnswered: ${q.isAnswered}`);
        });
      } catch (err) {
        console.error('DEBUG: FeedbackDashboard: Error fetching interview details:', err);
        setError('Failed to load interview feedback. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    if (interviewSessionId) {
      fetchInterviewDetails();
    }
  }, [interviewSessionId]);

  const toggleQuestionExpansion = (questionId) => {
    setExpandedQuestions(prev => ({
      ...prev,
      [questionId]: !prev[questionId]
    }));
  };

  const handleDownloadReport = () => {
    if (!interview) {
      alert('No interview data to download.');
      return;
    }

    let reportContent = `AI Mock Interview Report\n`;
    reportContent += `===================================\n\n`;
    reportContent += `Interview ID: ${interview._id}\n`;
    reportContent += `Date: ${new Date(interview.startTime).toLocaleString()}\n`;
    reportContent += `Overall Score: ${interview.overallScore.toFixed(1)} / 10\n`;
    reportContent += `Job(s): ${interview.selectedJobs.map(job => job.title).join(', ')}\n`;
    reportContent += `Skill(s): ${interview.selectedSkills.map(skill => skill.name).join(', ')}\n`;
    reportContent += `Resume Used: ${interview.resumeText ? 'Yes' : 'No'}\n`;
    reportContent += `\n===================================\n\n`;

    reportContent += `Question-by-Question Breakdown:\n\n`;

    interview.generatedQuestions.forEach((question, index) => {
      reportContent += `--- Question ${index + 1} ---\n`;
      reportContent += `Question: ${question.questionText}\n`;
      reportContent += `Your Text Answer: ${question.userAnswer || 'N/A'}\n`;
      if (question.userAudioTranscription) {
        reportContent += `Your Audio Transcription: ${question.userAudioTranscription}\n`;
      }
      if (question.userAudioUrl) {
        reportContent += `Your Recorded Media URL (if stored): http://localhost:5000${question.userAudioUrl}\n`; // Prepend full URL
      }
      
      const hasContent = (!!question.userAnswer && question.userAnswer.trim().length > 0) || (!!question.userAudioTranscription && question.userAudioTranscription.trim().length > 0);

      if (hasContent) { 
        reportContent += `Score: ${question.aiScore} / 10\n`;
        if (question.aiFeedbackSummary) {
          reportContent += `AI Feedback Summary: ${question.aiFeedbackSummary}\n`;
        }
        if (question.aiCategoryScores) {
            reportContent += `Category Scores:\n`;
            Object.entries(question.aiCategoryScores).forEach(([category, score]) => {
                reportContent += `  - ${category.replace(/([A-Z])/g, ' $1').trim()}: ${score} / 10\n`;
            });
        }
        if (question.aiStrengths && question.aiStrengths.length > 0) {
          reportContent += `Strengths:\n${question.aiStrengths.map(s => `  - ${s}`).join('\n')}\n`;
        }
        if (question.aiAreasForImprovement && question.aiAreasForImprovement.length > 0) {
          reportContent += `Areas for Improvement:\n${question.aiAreasForImprovement.map(a => `  - ${a}`).join('\n')}\n`;
        }
      } else {
        reportContent += `Status: Not Answered / Evaluated\n`;
      }
      reportContent += `\n`;
    });

    const blob = new Blob([reportContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mock_interview_report_${interview._id}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };


  if (loading) return <p style={{ textAlign: 'center' }}>Loading feedback...</p>;
  if (error) return <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>;
  if (!interview) return <p style={{ textAlign: 'center' }}>No feedback available for this session.</p>;

  const getScoreColor = (score) => {
    if (score >= 8) return '#28a745';
    if (score >= 5) return '#ffc107';
    return '#dc3545';
  };

  return (
    <div style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>📊 Interview Feedback Dashboard</h2>
      <p style={{ marginBottom: '25px', color: '#666' }}>Review your performance and get actionable insights.</p>

      {/* Overall Score */}
      <div style={{ marginBottom: '30px', backgroundColor: '#e8f5e9', padding: '20px', borderRadius: '8px', border: '1px solid #c8e6c9' }}>
        <h3 style={{ margin: '0 0 10px 0', color: '#1b5e20' }}>Overall Score:</h3>
        <p style={{ fontSize: '2.5em', fontWeight: 'bold', color: getScoreColor(interview.overallScore) }}>
          {interview.overallScore.toFixed(1)} / 10
        </p>
        <p style={{ color: '#388e3c', fontSize: '0.9em' }}>
          Based on an average of {interview.generatedQuestions.filter(q => q.isAnswered).length} evaluated questions.
        </p>
      </div>

      {/* Question-wise Feedback */}
      <div style={{ marginBottom: '30px' }}>
        <h3 style={{ marginBottom: '15px', color: '#333' }}>Question-by-Question Breakdown:</h3>
        {interview.generatedQuestions.map((question, index) => {
          const hasContent = (!!question.userAnswer && question.userAnswer.trim().length > 0) || (!!question.userAudioTranscription && question.userAudioTranscription.trim().length > 0);

          console.log(`DEBUG: FeedbackDashboard Q${index + 1} (Render): isAnswered (from DB):`, question.isAnswered);
          console.log(`DEBUG: FeedbackDashboard Q${index + 1} (Render): hasContent (calculated):`, hasContent);
          console.log(`DEBUG: FeedbackDashboard Q${index + 1} (Render): userAudioUrl:`, question.userAudioUrl ? `(Length: ${question.userAudioUrl.length}) ${question.userAudioUrl.substring(0, 50)}...` : "N/A");
          console.log(`DEBUG: FeedbackDashboard Q${index + 1} (Render): userAudioTranscription:`, question.userAudioTranscription || "N/A");

          return (
            <div key={question._id} style={{ marginBottom: '20px', padding: '15px', border: '1px solid #eee', borderRadius: '6px', backgroundColor: '#fff' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: '0', color: '#555' }}>Question {index + 1}:</h4>
                {question.isAnswered ? (
                  <span style={{ fontSize: '1.2em', fontWeight: 'bold', color: getScoreColor(question.aiScore) }}>
                    Score: {question.aiScore} / 10
                  </span>
                ) : (
                  <span style={{ color: '#888', fontSize: '0.9em' }}>Not Answered / Evaluated</span>
                )}
              </div>

              <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Question:</p>
              <p style={{ marginBottom: '10px', fontSize: '0.95em', backgroundColor: '#f5f5f5', padding: '8px', borderRadius: '4px' }}>
                {question.questionText}
              </p>

              <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Your Answer:</p>
              <p style={{ marginBottom: '10px', fontSize: '0.95em', fontStyle: 'italic', backgroundColor: '#fdfdfd', padding: '8px', borderRadius: '4px' }}>
                {question.userAudioTranscription || question.userAnswer || "No text/audio answer provided."}
              </p>
              {/* --- CRITICAL FIX: Use <video> tag for playback with static URL --- */}
              {/* Check if userAudioUrl exists AND starts with /uploads/ (our static prefix) */}
              {question.userAudioUrl && question.userAudioUrl.startsWith('/uploads/') && (
                <>
                  <p style={{ fontWeight: 'bold', marginBottom: '5px', marginTop: '10px' }}>Recorded Media Playback:</p>
                  {console.log(`DEBUG: Rendering <video> tag for Q${index + 1}. Full Src: http://localhost:5000${question.userAudioUrl}`)}
                  <video controls src={`http://localhost:5000${question.userAudioUrl}`} style={{ width: '100%', maxWidth: '400px', marginBottom: '10px' }}>
                    Your browser does not support playing this recorded media format.
                    {/* Add a <source> tag with generic webm type as a fallback, since browser detects */}
                    <source src={`http://localhost:5000${question.userAudioUrl}`} type="video/webm" /> 
                  </video>
                  <a href={`http://localhost:5000${question.userAudioUrl}`} download={`recorded_answer_${question._id}.webm`} style={{fontSize: '0.9em', color: '#2196f3', textDecoration: 'underline'}}>Download Recorded Media</a>
                </>
              )}
              {/* --- Handle old Base64 URLs (if any exist in DB from previous tests) --- */}
              {question.userAudioUrl && question.userAudioUrl.startsWith('data:video/') && (
                <>
                  <p style={{ fontWeight: 'bold', marginBottom: '5px', marginTop: '10px' }}>Recorded Media Playback (Data URL):</p>
                  {console.log(`DEBUG: Rendering <video> tag (Data URL) for Q${index + 1}. Src: ${question.userAudioUrl.substring(0,50)}...`)}
                  <video controls src={question.userAudioUrl} type={question.userAudioUrl.split(';')[0].replace('data:', '')} style={{ width: '100%', maxWidth: '400px', marginBottom: '10px' }}>
                    Your browser does not support playing this recorded media format.
                    <source src={question.userAudioUrl} type={question.userAudioUrl.split(';')[0].replace('data:', '')} />
                  </video>
                   <a href={question.userAudioUrl} download={`recorded_answer_${question._id}.webm`} style={{fontSize: '0.9em', color: '#2196f3', textDecoration: 'underline'}}>Download Recorded Media</a>
                </>
              )}
              {/* --- Handle audio-only static URLs if ever needed (not expected for current recording) --- */}
              {question.userAudioUrl && question.userAudioUrl.startsWith('/uploads/') && (question.userAudioUrl.includes('.mp3') || question.userAudioUrl.includes('.ogg') || question.userAudioUrl.includes('.wav')) && (
                <>
                  <p style={{ fontWeight: 'bold', marginBottom: '5px', marginTop: '10px' }}>Recorded Audio Playback:</p>
                  {console.log(`DEBUG: Rendering <audio> tag for Q${index + 1}. Src: http://localhost:5000${question.userAudioUrl}`)}
                  <audio controls src={`http://localhost:5000${question.userAudioUrl}`} style={{ width: '100%', maxWidth: '400px', marginBottom: '10px' }}>
                    Your browser does not support playing this recorded audio format.
                    <source src={`http://localhost:5000${question.userAudioUrl}`} type="audio/webm" />
                  </audio>
                   <a href={`http://localhost:5000${question.userAudioUrl}`} download={`recorded_answer_${question._id}.webm`} style={{fontSize: '0.9em', color: '#2196f3', textDecoration: 'underline'}}>Download Recorded Media</a>
                </>
              )}
              {/* --- END CRITICAL FIX --- */}


              {(question.aiFeedbackSummary || (question.aiStrengths && question.aiStrengths.length > 0) || (question.aiAreasForImprovement && question.aiAreasForImprovement.length > 0) || question.aiCategoryScores) && (
                <button
                  onClick={() => toggleQuestionExpansion(question._id)}
                  style={{
                    padding: '8px 15px',
                    backgroundColor: '#f0f0f0',
                    border: '1px solid #ddd',
                    borderRadius: '4px',
                    cursor: 'pointer',
                    fontSize: '0.9em',
                    marginTop: '10px',
                    width: '100%',
                    textAlign: 'left'
                  }}
                >
                  {expandedQuestions[question._id] ? 'Hide Feedback Details ▲' : 'Show Feedback Details ▼'}
                </button>
              )}

              {expandedQuestions[question._id] && (
                <div style={{ marginTop: '15px' }}>
                  {/* Category Scores Display */}
                  {question.aiCategoryScores && (
                    <div style={{ marginBottom: '15px', backgroundColor: '#e0f2f7', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #03a9f4' }}>
                      <p style={{ fontWeight: 'bold', marginBottom: '5px' }}>Category Scores:</p>
                      <ul style={{ listStyleType: 'none', padding: '0', margin: '0' }}>
                        {Object.entries(question.aiCategoryScores).map(([category, score]) => (
                          <li key={category} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9em', padding: '2px 0' }}>
                            <span>{category.replace(/([A-Z])/g, ' $1').trim()}:</span>
                            <span style={{ fontWeight: 'bold', color: getScoreColor(score) }}>{score} / 10</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {question.aiFeedbackSummary && (
                    <>
                      <p style={{ fontWeight: 'bold', marginBottom: '5px', marginTop: '10px' }}>AI Feedback Summary:</p>
                      <p style={{ color: '#444', fontSize: '0.95em', backgroundColor: '#e6f7ff', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #1890ff' }}>
                        {question.aiFeedbackSummary}
                      </p>
                    </>
                  )}

                  {question.aiStrengths && question.aiStrengths.length > 0 && (
                    <>
                      <p style={{ fontWeight: 'bold', marginBottom: '5px', marginTop: '10px' }}>Strengths:</p>
                      <ul style={{ listStyleType: 'disc', marginLeft: '20px', fontSize: '0.95em', backgroundColor: '#e8f5e9', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #388e3c' }}>
                        {question.aiStrengths.map((strength, sIndex) => (
                          <li key={sIndex}>{strength}</li>
                        ))}
                      </ul>
                    </>
                  )}

                  {question.aiAreasForImprovement && question.aiAreasForImprovement.length > 0 && (
                    <>
                      <p style={{ fontWeight: 'bold', marginBottom: '5px', marginTop: '10px' }}>Areas for Improvement:</p>
                      <ul style={{ listStyleType: 'disc', marginLeft: '20px', fontSize: '0.95em', backgroundColor: '#ffebee', padding: '8px', borderRadius: '4px', borderLeft: '3px solid #d32f2f' }}>
                        {question.aiAreasForImprovement.map((area, aIndex) => (
                          <li key={aIndex}>{area}</li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '20px', marginTop: '40px' }}>
        <button
          onClick={onRetakeInterview}
          style={{
            padding: '12px 25px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1em'
          }}
        >
          Retake Interview
        </button>
        <button
          onClick={onReviewPastInterviews}
          style={{
            padding: '12px 25px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1em'
          }}
        >
          Review Past Interviews
        </button>
        <button
          onClick={handleDownloadReport}
          style={{
            padding: '12px 25px',
            backgroundColor: '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer',
            fontSize: '1em'
          }}
        >
          Download Report
        </button>
      </div>
    </div>
  );
};

export default FeedbackDashboard;