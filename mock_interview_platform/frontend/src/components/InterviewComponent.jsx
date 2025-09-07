// frontend/src/components/InterviewComponent.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';

const InterviewComponent = ({ interviewSessionId, onInterviewComplete, socket }) => {
  const [interview, setInterview] = useState(null);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Timer states
  const [timeLeft, setTimeLeft] = useState(60);
  const timerRef = useRef(null);
  const isTransitioningRef = useRef(false);

  // Media recording states and refs
  const videoRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunks = useRef([]);
  const [isRecording, setIsRecording] = useState(false);
  const [hasMediaAccess, setHasMediaAccess] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);

  // --- Function to stop media streams ---
  const stopMediaStream = useCallback(() => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject;
      stream.getTracks().forEach(track => {
        console.log(`DEBUG: Stopping media track: ${track.kind}`);
        track.stop();
      });
      videoRef.current.srcObject = null;
      console.log("DEBUG: Media stream explicitly stopped.");
    }
  }, []);

  // --- Effect to get webcam/microphone access on component mount ---
  useEffect(() => {
    const getMedia = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        console.log("✅ Microphone and camera access granted.");
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
        setHasMediaAccess(true);
      } catch (err) {
        console.error("❌ Media access error:", err.name, err.message);
        setHasMediaAccess(false);

        let userFriendlyError = 'Failed to access webcam and microphone.';
        if (err.name === "NotAllowedError") {
          userFriendlyError = "Permission denied: Please allow microphone and camera in your browser settings (click the camera icon in the address bar).";
        } else if (err.name === "NotFoundError") {
          userFriendlyError = "No webcam or microphone detected on your system. Please ensure they are connected and enabled.";
        } else if (err.name === "NotReadableError") {
          userFriendlyError = "Webcam/Microphone is busy: Another application (like Zoom, Teams, Discord, OBS) might be using them. Please close other apps and try again.";
        } else if (err.name === "AbortError") {
          userFriendlyError = "Media access aborted: Device startup was canceled. Please try again.";
        } else if (err.name === "SecurityError") {
          userFriendlyError = "Security error: Media access is blocked in this context (e.g., non-HTTPS, or iframe issues).";
        } else if (err.name === "TypeError") {
          userFriendlyError = "Configuration error: Browser might not support requested media constraints.";
        } else {
          userFriendlyError = `Unknown media error: ${err.name} - ${err.message}.`;
        }
        setError(userFriendlyError);
        alert(userFriendlyError);
      }
    };
    getMedia();

    // Cleanup function: runs when component unmounts
    return () => {
      console.log("DEBUG: InterviewComponent unmounting. Calling stopMediaStream from cleanup.");
      stopMediaStream();
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      isTransitioningRef.current = false;
    };
  }, [stopMediaStream]);

  // --- Effect to fetch interview session details (still uses Axios GET) ---
  useEffect(() => {
    const fetchInterviewSession = async () => {
      if (!interviewSessionId) {
        console.warn("DEBUG: InterviewComponent: No interviewSessionId, skipping fetch.");
        setLoading(false); // Ensure loading is false
        return;
      }
      try {
        const response = await axios.get(`http://localhost:5000/api/interview/${interviewSessionId}`);
        setInterview(response.data);
        // Only update question related state if questions exist
        if (response.data.generatedQuestions && response.data.generatedQuestions[currentQuestionIndex]) {
          setUserAnswer(response.data.generatedQuestions[currentQuestionIndex].userAnswer || '');
          setRecordedBlob(null);
          setTimeLeft(60);
          isTransitioningRef.current = false;
        } else {
            // Handle case where no questions are returned or index is invalid
            setError("No questions found for this interview session or invalid index.");
            setLoading(false);
        }
      } catch (err) {
        console.error('Error fetching interview session:', err);
        setError('Failed to load interview session. Please try again.');
      } finally {
        setLoading(false);
      }
    };

    fetchInterviewSession();
  }, [interviewSessionId, currentQuestionIndex]); // Fetch also when question changes

  // --- Effect to manage the countdown timer and auto-advance ---
  useEffect(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
    }

    // Add checks for interview and generatedQuestions existence
    if (interview?.generatedQuestions && currentQuestionIndex < interview.generatedQuestions.length && !isSubmitting && !isTransitioningRef.current) {
      timerRef.current = setInterval(() => {
        setTimeLeft(prevTime => {
          if (prevTime <= 1) {
            clearInterval(timerRef.current);
            if (!isTransitioningRef.current) {
                isTransitioningRef.current = true;
                console.log("DEBUG: Time's up! Triggering auto-save and advance/submit.");
                handleTimeUp();
            }
            return 0;
          }
          return prevTime - 1;
        });
      }, 1000);
    }

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    };
  }, [currentQuestionIndex, interview, isSubmitting]);

  // Handler when time runs out
  const handleTimeUp = async () => {
    if (isRecording) {
        stopRecording();
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    await saveCurrentAnswer();

    // Add checks before accessing interview.generatedQuestions
    if (interview?.generatedQuestions && currentQuestionIndex < interview.generatedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setTimeLeft(60);
      isTransitioningRef.current = false;
    } else {
      await submitInterviewForEvaluation();
      isTransitioningRef.current = false;
    }
  };


  // --- Recording Handlers ---
  const startRecording = () => {
    if (!hasMediaAccess) {
      alert(error || 'Cannot start recording: No media stream available. Please grant permissions.');
      return;
    }
    if (isRecording) return;

    recordedChunks.current = [];
    setRecordedBlob(null);
    
    try {
      let options = {};
      let mimeTypeToUse = 'video/webm'; // Default fallback
      
      if (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')) {
        options = { mimeType: 'video/webm;codecs=vp9,opus' };
        mimeTypeToUse = options.mimeType;
      } else if (MediaRecorder.isTypeSupported('video/webm;codecs=vp8,opus')) {
        options = { mimeType: 'video/webm;codecs=vp8,opus' };
        mimeTypeToUse = options.mimeType;
      } else if (MediaRecorder.isTypeSupported('video/webm')) {
        options = { mimeType: 'video/webm' };
        mimeTypeToUse = options.mimeType;
      } else if (MediaRecorder.isTypeSupported('video/mp4')) {
        options = { mimeType: 'video/mp4' };
        mimeTypeToUse = options.mimeType;
        console.warn("Using video/mp4, which may not be supported by all browsers/platforms for MediaRecorder.");
      } else {
        options = {};
        mimeTypeToUse = 'video/webm'; // Assume webm as a common default if browser chooses
        console.warn("No specific video MIME type supported, letting browser choose. Defaulting to 'video/webm' for Blob type.");
      }

      console.log("🎥 Using MediaRecorder options:", options);

      if (!videoRef.current || !videoRef.current.srcObject) {
        throw new Error("No valid media stream available for MediaRecorder.");
      }
      mediaRecorderRef.current = new MediaRecorder(videoRef.current.srcObject, options);

      mediaRecorderRef.current.ondataavailable = (event) => {
        if (event.data.size > 0) {
          recordedChunks.current.push(event.data);
        }
      };

      mediaRecorderRef.current.onstop = () => {
        const recordedBlob = new Blob(recordedChunks.current, { type: mimeTypeToUse });
        setRecordedBlob(recordedBlob);
        console.log('🎥 Recorded blob:', recordedBlob);
      };

      mediaRecorderRef.current.start();
      setIsRecording(true);
      console.log('✅ Recording started...');
    } catch (err) {
      console.error('❌ Error starting MediaRecorder:', err);
      alert('Failed to start recording: ' + err.message + '. Your browser may not support the selected video/audio codec, or there\'s an issue with the stream.');
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

  // --- NEW: saveCurrentAnswer using Socket.IO ---
  const saveCurrentAnswer = async () => {
    if (!interview || !interview.generatedQuestions[currentQuestionIndex]) return;
    if (!socket || !socket.connected) {
        console.error("Socket.IO not connected. Cannot save answer.");
        alert("Real-time connection lost. Please refresh and log in again.");
        return;
    }

    const questionId = interview.generatedQuestions[currentQuestionIndex]._id;
    
    if (isRecording) {
      stopRecording();
      await new Promise(resolve => setTimeout(resolve, 500)); 
    }

    console.log("\n--- DEBUG: Frontend (Socket.IO): saveCurrentAnswer - preparing data ---");
    let mediaBlobData = null;
    if (recordedBlob) {
        mediaBlobData = { data: Array.from(new Uint8Array(await recordedBlob.arrayBuffer())), type: recordedBlob.type };
    }

    const dataToSend = {
      interviewId: interviewSessionId,
      questionId: questionId,
      userAnswer: userAnswer,
      mediaBlob: mediaBlobData
    };
    console.log("DEBUG: Data for socket emission:", { 
        interviewId: dataToSend.interviewId,
        questionId: dataToSend.questionId,
        userAnswer: dataToSend.userAnswer.substring(0, Math.min(dataToSend.userAnswer.length, 50)) + '...',
        mediaBlob: dataToSend.mediaBlob ? `(Size: ${dataToSend.mediaBlob.data.length} bytes, Type: ${dataToSend.mediaBlob.type})` : 'No Blob'
    });
    console.log("--- END DEBUG: Frontend (Socket.IO): Data Preparation ---");

    try {
      socket.emit('saveAnswer', dataToSend, (response) => {
        if (response.status === 200) {
          console.log(`✅ Socket: Answer for question ${currentQuestionIndex + 1} saved. Backend response:`, response.message);
          // Optimistically update frontend state with received question data
          setInterview(prev => {
            if (!prev) return prev;
            const newQuestions = prev.generatedQuestions.map(q => 
                q._id === response.question._id ? response.question : q
            );
            return { ...prev, generatedQuestions: newQuestions };
          });
          setRecordedBlob(null);
        } else {
          console.error('❌ Socket: Error saving answer. Backend response:', response.message);
          alert('Failed to save answer: ' + response.message);
        }
      });
      
    } catch (err) {
      console.error('❌ Socket: Unexpected error during saveAnswer emit:', err);
      alert('An unexpected error occurred during save. Please check console.');
    }
  };


  const goToNextQuestion = async () => {
    if (isTransitioningRef.current) return;
    await saveCurrentAnswer();
    // Add checks for interview and generatedQuestions existence
    if (interview?.generatedQuestions && currentQuestionIndex < interview.generatedQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setTimeLeft(60);
    } else if (currentQuestionIndex === (interview?.generatedQuestions?.length || 0) -1 ) {
      // If it's the last question, explicitly alert, but then auto-submit happens
      alert('You have reached the last question! Submitting...');
    }
  };

  const goToPreviousQuestion = async () => {
    if (isTransitioningRef.current) return;
    await saveCurrentAnswer();
    if (currentQuestionIndex > 0) {
      setCurrentQuestionIndex(prev => prev - 1);
      setTimeLeft(60);
    }
  };

  const submitInterviewForEvaluation = async () => {
    setIsSubmitting(true);
    await saveCurrentAnswer();
    
    console.log("DEBUG: Submitting interview. Calling stopMediaStream explicitly.");
    stopMediaStream(); 

    if (!socket || !socket.connected) {
        console.error("Socket.IO not connected. Cannot submit evaluation.");
        alert("Real-time connection lost. Please refresh and log in again.");
        setIsSubmitting(false);
        return;
    }
    socket.emit('completeAndEvaluate', interviewSessionId, (response) => {
        if (response.status === 200) {
            console.log('✅ Socket: Evaluation triggered. Backend response:', response.message);
            alert('Interview submitted for evaluation! Redirecting to feedback...');
            onInterviewComplete(interviewSessionId);
        } else {
            console.error('❌ Socket: Error submitting evaluation. Backend response:', response.message);
            alert('Failed to submit evaluation: ' + response.message);
        }
        setIsSubmitting(false);
    });
  };

  // --- CRITICAL RENDERING SAFEGUARDS ---
  if (loading) return <p style={{ textAlign: 'center' }}>Loading interview questions...</p>;
  if (error) return <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>;
  // Check if interview and generatedQuestions exist before accessing them
  if (!interview || !interview.generatedQuestions || interview.generatedQuestions.length === 0) {
      return <p style={{ textAlign: 'center' }}>No questions found for this interview session. (Error or empty interview data)</p>;
  }
  // Also check if currentQuestionIndex is valid BEFORE accessing currentQuestion
  if (currentQuestionIndex >= interview.generatedQuestions.length) {
      return <p style={{ textAlign: 'center', color: 'red' }}>Error: Question index out of bounds. Please restart the interview.</p>;
  }
  // --- END CRITICAL RENDERING SAFEGUARDS ---

  const currentQuestion = interview.generatedQuestions[currentQuestionIndex]; // Now safe to access
  const totalQuestions = interview.generatedQuestions.length;

  const formatTime = (seconds) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

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
        color: timeLeft <= 10 && timeLeft > 0 ? '#dc3545' : '#2196f3',
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
            disabled={disableControls || isRecording}
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
        {recordedBlob && (
          <p style={{ marginTop: '10px', color: '#28a745' }}>Video/Audio Recorded! It will be submitted with your text answer.</p>
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
          disabled={disableControls}
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