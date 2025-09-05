// frontend/src/components/InterviewComponent.jsx
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const InterviewComponent = ({ interviewSessionId, onInterviewComplete }) => {
  const [interview, setInterview] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false); // For final interview submission

  // Timer states
  const [timeLeft, setTimeLeft] = useState(60); // Default 60 seconds per question
  const timerRef = useRef(null); // Ref for the interval ID
  const isTransitioningRef = useRef(false); // New ref to prevent multiple auto-transitions

  // Media recording states and refs
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunks = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [hasMediaAccess, setHasMediaAccess] = useState(false);
  const [recordedAudioBlob, setRecordedAudioBlob] = useState(null);

  // --- Effect to get webcam/microphone access on component mount ---
  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasMediaAccess(true);
      } catch (err) {
        console.error('Error accessing media devices:', err);
        setError('Failed to access webcam and microphone. Please ensure permissions are granted.');
        setHasMediaAccess(false);
      }
    };
    getMedia();

    // Cleanup function to stop media stream when component unmounts
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        videoRef.current.srcObject.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      isTransitioningRef.current = false; // Reset ref
    };
  }, []);

  // --- Effect to fetch interview session details ---
  useEffect(() => {
    const fetchInterviewSession = async () => {
      try {
        const response = await axios.get(`http://localhost:5000/api/interview/${interviewSessionId}`);
        setInterview(response.data);
        if (response.data.generatedQuestions[0]) {
          setUserAnswer(response.data.generatedQuestions[0].userAnswer || '');
          setRecordedAudioBlob(null);
          setTimeLeft(60); // Reset timer for first question
          isTransitioningRef.current = false; // Reset ref for new session
        }
      } catch (err) {
        console.error('Error fetching interview session:', err);
        setError('Failed to load interview session. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchInterviewSession();
  }, [interviewSessionId]);

  // --- Effect to manage the countdown timer and auto-advance ---
  useEffect(() => {
    // Clear any existing timer
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Only start timer if interview is loaded, not submitting, and not already transitioning
    if (interview && currentQuestionIndex < interview.generatedQuestions.length && !isSubmitting && !isTransitioningRef.current) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current);
            if (!isTransitioningRef.current) { // Ensure only one auto-transition
                isTransitioningRef.current = true; // Set ref to block further transitions
                console.log("Time's up! Triggering auto-save and advance/submit.");
                handleTimeUp(); // Call handler for time up
            }
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000); // Update every second
    }

    // Cleanup when component unmounts or question changes
    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentQuestionIndex, interview, isSubmitting]); // Depend on relevant state

  // Handler when time runs out
  const handleTimeUp = async () => {
    // Stop recording if active
    if (isRecording) {
        stopRecording();
        await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for blob processing
    }

    // Save the current answer
    await saveCurrentAnswer(); // saveCurrentAnswer also calls stopRecording internally

    // Determine next action
    if (currentQuestionIndex < interview.generatedQuestions.length - 1) {
      // Go to next question
      setCurrentQuestionIndex(prev => prev + 1);
      setTimeLeft(60); // Reset timer for new question
      isTransitioningRef.current = false; // Reset ref for next question
    } else {
      // Submit interview if it's the last question
      await submitInterviewForEvaluation();
      isTransitioningRef.current = false; // Reset ref
    }
  };


  // --- Effect to update userAnswer and clear recorded audio when currentQuestionIndex changes ---
  useEffect(() => {
    if (interview && interview.generatedQuestions[currentQuestionIndex]) {
      setUserAnswer(interview.generatedQuestions[currentQuestionIndex].userAnswer || '');
      setRecordedAudioBlob(null);
      setTimeLeft(60); // Reset timer for new question
      isTransitioningRef.current = false; // Reset ref when question changes
    }
  }, [currentQuestionIndex, interview]);

  // --- Recording Handlers ---
  const startRecording = () => {
    if (!videoRef.current || !videoRef.current.srcObject) {
      alert('Cannot start recording: No media stream available. Check permissions.');
      return;
    }
    if (isRecording) return;

    recordedChunks.current = [];
    setRecordedAudioBlob(null);
    
    try {
      mediaRecorderRef.current = new MediaRecorder(videoRef.current.srcObject, {
        mimeType: 'audio/webm; codecs=opus'
      });

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(recordedChunks.current, { type: 'audio/webm; codecs=opus' });
        setRecordedAudioBlob(audioBlob);
        console.log('Recorded audio blob:', audioBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      console.log('Recording started...');
    } catch (err) {
      console.error('Error starting MediaRecorder:', err);
      alert('Failed to start recording. Ensure microphone is active and not blocked by another application.');
      setIsRecording(false);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      console.log('Recording stopped.');
    }
  };

  const handleAnswerChange = (e) => {
    setUserAnswer(e.target.value);
  };

  const saveCurrentAnswer = async () => {
    if (!interview || !interview.generatedQuestions[currentQuestionIndex]) return;

    const questionId = interview.generatedQuestions[currentQuestionIndex]._id;
    
    if (isRecording) {
      stopRecording();
      await new Promise(resolve => setTimeout(resolve, 500)); 
    }

    try {
      const formData = new FormData();
      formData.append('questionId', questionId);
      formData.append('userAnswer', userAnswer);
      formData.append('isAnswered', true);

      if (recordedAudioBlob) {
        formData.append('audioFile', recordedAudioBlob, `answer_${questionId}.webm`);
      }

      await axios.put(`http://localhost:5000/api/interview/${interviewSessionId}/answer`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });
      
      setInterview(prev => {
        const newInterview = { ...prev };
        const question = newInterview.generatedQuestions.find(q => q._id === questionId);
        if (question) {
          question.userAnswer = userAnswer;
          question.isAnswered = true;
        }
        return newInterview;
      });
      console.log(`Answer for question ${currentQuestionIndex + 1} saved.`);
      setRecordedAudioBlob(null);
    } catch (err) {
      console.error('Error saving answer:', err.response ? err.response.data : err.message);
      alert('Failed to save answer. Please check console for details.');
    }
  };

  const goToNextQuestion = async () => {
    if (isTransitioningRef.current) return; // Prevent manual advance during auto-transition
    await saveCurrentAnswer();
    if (currentQuestionIndex < interview.generatedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setTimeLeft(60);
    } else {
      alert('You have reached the last question!');
    }
  };

  const goToPreviousQuestion = async () => {
    if (isTransitioningRef.current) return; // Prevent manual back during auto-transition
    await saveCurrentAnswer();
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setTimeLeft(60);
    }
  };

  const submitInterviewForEvaluation = async () => {
    if (isTransitioningRef.current) return; // Prevent manual submit during auto-transition
    setIsSubmitting(true);
    await saveCurrentAnswer();
    try {
      await axios.put(`http://localhost:5000/api/interview/${interviewSessionId}/complete-and-evaluate`);
      alert('Interview submitted for evaluation! Redirecting to feedback...');
      onInterviewComplete(interviewSessionId);
    } catch (err) {
      console.error('Error submitting interview:', err.response ? err.response.data : err.message);
      alert('Failed to submit interview for evaluation. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) return <p style={{ textAlign: 'center' }}>Loading interview questions...</p>;
  if (error) return <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>;
  if (!interview || interview.generatedQuestions.length === 0) return <p style={{ textAlign: 'center' }}>No questions found for this interview session.</p>;

  const currentQuestion = interview.generatedQuestions[currentQuestionIndex];
  const totalQuestions = interview.generatedQuestions.length;

  // Function to format time for display
  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  // Disable controls when time is up or transitioning automatically
  const disableControls = isSubmitting || isRecording || timeLeft <= 0 || isTransitioningRef.current;

  return (
    <div style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>Mock Interview Session</h2>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Question {currentQuestionIndex + 1} of {totalQuestions}
      </p>

      {/* Timer Display */}
      <div style={{
        textAlign: 'center',
        marginBottom: '25px',
        fontSize: '1.8em',
        fontWeight: 'bold',
        color: timeLeft <= 10 && timeLeft > 0 ? '#dc3545' : '#2196f3', // Red when time is low, but not 0
        padding: '10px 0',
        borderBottom: '1px solid #eee'
      }}>
        Time Left: {formatTime(timeLeft)}
        {timeLeft <= 0 && <span style={{ color: '#dc3545', marginLeft: '10px' }}>Time's Up!</span>}
      </div>

      {/* Video Preview and Recording Controls */}
      <div style={{ marginBottom: '25px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <h3>Your Interview Feed</h3>
        {hasMediaAccess ? (
          <video
            ref={videoRef}
            autoPlay
            muted
            style={{ width: '100%', maxWidth: '400px', height: 'auto', borderRadius: '8px', backgroundColor: '#000' }}
          ></video>
        ) : (
          <div style={{ width: '100%', maxWidth: '400px', height: '225px', backgroundColor: '#eee', borderRadius: '8px', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#888' }}>
            {error || 'Grant webcam/mic access to see your feed.'}
          </div>
        )}
        <div style={{ marginTop: '15px', display: 'flex', gap: '15px' }}>
          <button
            onClick={startRecording}
            disabled={disableControls || isRecording} // disable if time is 0 or transitioning
            style={{
              padding: '10px 20px',
              backgroundColor: isRecording ? '#ccc' : '#dc3545',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: disableControls || isRecording ? 'not-allowed' : 'pointer',
              opacity: disableControls || isRecording ? 0.7 : 1
            }}
          >
            {isRecording ? 'Recording...' : 'Record Answer'}
          </button>
          <button
            onClick={stopRecording}
            disabled={!isRecording || isSubmitting}
            style={{
              padding: '10px 20px',
              backgroundColor: !isRecording ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: !isRecording || isSubmitting ? 'not-allowed' : 'pointer',
              opacity: !isRecording || isSubmitting ? 0.7 : 1
            }}
          >
            Stop Recording
          </button>
        </div>
        {recordedAudioBlob && (
          <p style={{ marginTop: '10px', color: '#28a745' }}>Audio Recorded! It will be submitted with your text answer.</p>
        )}
      </div>

      <div style={{ marginBottom: '25px', padding: '20px', backgroundColor: '#f8f9fa', border: '1px solid #e9ecef', borderRadius: '6px' }}>
        <p style={{ fontSize: '1.15em', fontWeight: 'bold', color: '#333', lineHeight: '1.5' }}>
          {currentQuestion.questionText}
        </p>
      </div>

      <div style={{ marginBottom: '25px' }}>
        <h3 style={{ marginBottom: '10px', color: '#444' }}>Your Text Answer:</h3>
        <textarea
          value={userAnswer}
          onChange={handleAnswerChange}
          placeholder="Type your answer here (or just record audio)..."
          rows="8"
          disabled={disableControls} // Disable textarea if time is up
          style={{
            width: '100%',
            padding: '10px',
            border: '1px solid #ccc',
            borderRadius: '4px',
            fontSize: '1em',
            resize: 'vertical',
            opacity: disableControls ? 0.7 : 1,
            cursor: disableControls ? 'not-allowed' : 'text'
          }}
        ></textarea>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '20px' }}>
        <button
          onClick={goToPreviousQuestion}
          disabled={currentQuestionIndex === 0 || disableControls}
          style={{
            padding: '10px 20px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: currentQuestionIndex === 0 || disableControls ? 'not-allowed' : 'pointer',
            opacity: currentQuestionIndex === 0 || disableControls ? 0.7 : 1
          }}
        >
          ← Previous
        </button>

        {currentQuestionIndex < totalQuestions - 1 ? (
          <button
            onClick={goToNextQuestion}
            disabled={disableControls}
            style={{
              padding: '10px 20px',
              backgroundColor: disableControls ? '#ccc' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: disableControls ? 'not-allowed' : 'pointer',
              opacity: disableControls ? 0.7 : 1
            }}
          >
            Next Question →
          </button>
        ) : (
          <button
            onClick={submitInterviewForEvaluation}
            disabled={disableControls}
            style={{
              padding: '12px 25px',
              backgroundColor: disableControls ? '#ccc' : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: disableControls ? 'not-allowed' : 'pointer',
              opacity: disableControls ? 0.7 : 1,
              fontSize: '1.05em',
              fontWeight: 'bold'
            }}
          >
            {isSubmitting ? 'Submitting...' : 'Submit Interview for Evaluation'}
          </button>
        )}
      </div>
    </div>
  );
};

export default InterviewComponent;