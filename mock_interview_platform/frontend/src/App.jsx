// frontend/src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import JobSelection from './components/JobSelection';
import SkillSelection from './pages/SkillSelection';
import ResumeUpload from './pages/ResumeUpload';
import InterviewComponent from './components/InterviewComponent';
import FeedbackDashboard from './pages/FeedbackDashboard';
import PastInterviewsScreen from './pages/PastInterviewsScreen';
import Login from './components/Auth/Login';
import Register from './components/Auth/Register';
import { AuthProvider, useAuth } from './context/AuthContext';
import axios from 'axios';
import { io } from 'socket.io-client'; // Socket.IO Client Import

// AppComponent is the main functional component of your application's content
function AppComponent() {
  const { user, isAuthenticated, authLoading, login, logout, token } = useAuth();

  const [currentStep, setCurrentStep] = useState(1);
  const [interviewData, setInterviewData] = useState({
    selectedJobs: [],
    selectedSkills: [],
    resumeText: ''
  });
  const [interviewSessionId, setInterviewSessionId] = useState(null);
  const [loadingInterview, setLoadingInterview] = useState(false);
  const [showRegister, setShowRegister] = useState(false);

  // --- Socket.IO state and ref ---
  const socketRef = useRef(null); // Ref to hold the socket instance
  const [socketConnected, setSocketConnected] = useState(false);
  // --- END NEW ---

  // --- Effect to manage application flow based on authentication state ---
  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      if (currentStep !== 'auth') {
        setCurrentStep('auth');
      }
      setInterviewData({ selectedJobs: [], selectedSkills: [], resumeText: '' });
      setInterviewSessionId(null);
      if (socketRef.current) {
        console.log("App: Disconnecting socket on unauthentication.");
        socketRef.current.disconnect();
        socketRef.current = null;
        setSocketConnected(false);
      }
    } else {
      if (currentStep === 'auth' || currentStep === 0) {
        setCurrentStep(1);
      }
      // --- NEW: Connect socket on successful authentication ---
      if (!socketRef.current && isAuthenticated && token) {
        console.log("App: Authenticated. Attempting to connect Socket.IO.");
        socketRef.current = io('http://localhost:5000', {
          auth: {
            token: token
          },
          transports: ['websocket']
        });

        socketRef.current.on('connect', () => {
          console.log('App: Socket.IO connected.');
          setSocketConnected(true);
        });

        socketRef.current.on('disconnect', () => {
          console.log('App: Socket.IO disconnected.');
          setSocketConnected(false);
        });

        socketRef.current.on('connect_error', (error) => {
            console.error('App: Socket.IO connection error:', error.message);
            if (error.message.includes('Authentication error')) {
                alert('Socket authentication failed. Please log in again.');
                logout();
            }
        });
      }
      // --- END NEW ---
    }
  }, [isAuthenticated, authLoading, currentStep, token, logout]);


  const handleJobsSelected = (jobIds) => {
    console.log('Jobs selected:', jobIds);
    setInterviewData(prev => ({ ...prev, selectedJobs: jobIds }));
    setCurrentStep(2);
  };

  const handleSkillsSelected = (skillIds) => {
    console.log('Skills selected:', skillIds);
    setInterviewData(prev => ({ ...prev, selectedSkills: skillIds }));
    setCurrentStep(3);
  };

  const handleResumeUploaded = (resumeText) => {
    console.log('Resume uploaded (App.jsx)');
    setInterviewData(prev => ({ ...prev, resumeText }));
    setCurrentStep(4);
  };

  // Handler for starting a new interview session (Now uses Axios POST again)
  const startInterview = async () => {
    console.log('Attempting to start interview with:', interviewData);
    if (interviewData.selectedJobs.length === 0 || interviewData.selectedSkills.length === 0) {
      alert('Please select at least one job and one skill to start the interview.');
      return;
    }

    setLoadingInterview(true);
    try {
      // --- CRITICAL FIX: Reverting to Axios POST for startInterview ---
      const response = await axios.post('http://localhost:5000/api/interview/start', {
        selectedJobs: interviewData.selectedJobs,
        selectedSkills: interviewData.selectedSkills,
        resumeText: interviewData.resumeText
      });

      console.log('App: Interview session created (Axios POST):', response.data.interviewId); // Updated log
      setInterviewSessionId(response.data.interviewId);
      setCurrentStep(5);
      // --- END CRITICAL FIX ---
    } catch (error) {
      console.error('App: Error starting interview session (Axios POST):', error.response ? error.response.data : error.message); // Updated log
      if (error.response && error.response.status === 401) {
          alert('Your session has expired or is invalid. Please log in again.');
          logout();
      } else {
          alert('Failed to start interview: ' + (error.response?.data?.message || error.message));
      }
    } finally {
      setLoadingInterview(false);
    }
  };

  // Handler for when the interview is completed and evaluation is triggered (Still uses Socket.IO)
  const handleInterviewComplete = (completedInterviewId) => {
    console.log('App: Interview completed, triggering evaluation (Socket):', completedInterviewId);
    if (!socketRef.current || !socketConnected) {
        alert('Socket.IO is not connected. Cannot trigger evaluation.');
        return;
    }

    socketRef.current.emit('completeAndEvaluate', completedInterviewId, (response) => {
        if (response.status === 200) {
            console.log('App: Evaluation response (Socket):', response.message);
            alert('Interview submitted for evaluation! Check feedback dashboard.');
            setInterviewSessionId(completedInterviewId);
            setCurrentStep(6);
        } else {
            console.error('App: Error triggering evaluation (Socket):', response.message);
            alert('Failed to evaluate interview: ' + response.message);
        }
    });
  };

  const handleRetakeInterview = () => {
    setCurrentStep(1);
    setInterviewData({ selectedJobs: [], selectedSkills: [], resumeText: '' });
    setInterviewSessionId(null);
  };

  const handleReviewPastInterviews = () => {
    setCurrentStep(7);
    setInterviewSessionId(null);
  };

  const handleSelectInterviewForFeedback = (id) => {
    setInterviewSessionId(id);
    setCurrentStep(6);
  };

  // --- Conditional rendering for authentication state ---
  if (authLoading) {
    return (
      <div className="App">
        <div className="main-content-container">
          <div style={{ textAlign: 'center', padding: '50px', fontSize: '1.2em' }}>Loading authentication...</div>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="App">
        <div className="main-content-container">
          <h1 style={{ textAlign: 'center', marginBottom: '40px', color: '#2196f3' }}>AI Mock Interview Platform</h1>
          {showRegister ? (
            <Register
              onRegisterSuccess={(userData, token) => {
                login(userData, token);
                setShowRegister(false);
              }}
              onSwitchToLogin={() => setShowRegister(false)}
            />
          ) : (
            <Login
              onLoginSuccess={(userData, token) => {
                login(userData, token);
              }}
              onSwitchToRegister={() => setShowRegister(true)}
            />
          )}
        </div>
      </div>
    );
  }

  // --- Main Application Content (if isAuthenticated is true) ---
  return (
    <div className="App">
      <div className="main-content-container">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
          <h1>AI Mock Interview Platform</h1>
          {isAuthenticated && user && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
              <span style={{ fontSize: '0.9em', color: '#555' }}>Welcome, <strong>{user.username}</strong>!</span>
              <button
                onClick={logout}
                style={{
                  padding: '8px 15px',
                  backgroundColor: '#dc3545',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9em'
                }}
              >
                Logout
              </button>
            </div>
          )}
        </div>
        
        {/* Progress indicator */}
        <div style={{ marginBottom: '30px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
            <span style={{ color: currentStep >= 1 ? '#2196f3' : '#ccc' }}>1. Select Jobs</span>
            <span style={{ color: currentStep >= 2 ? '#2196f3' : '#ccc' }}>2. Select Skills</span>
            <span style={{ color: currentStep >= 3 ? '#2196f3' : '#ccc' }}>3. Upload Resume</span>
            <span style={{ color: currentStep >= 4 ? '#2196f3' : '#ccc' }}>4. Start Interview</span>
            <span style={{ color: currentStep >= 5 ? '#2196f3' : '#ccc' }}>5. Interview</span>
            <span style={{ color: currentStep >= 6 ? '#2196f3' : '#ccc' }}>6. Feedback</span>
            {currentStep >= 7 && <span style={{ color: currentStep >= 7 ? '#2196f3' : '#ccc' }}>7. Past Interviews</span>}
          </div>
          <div style={{ height: '4px', backgroundColor: '#e0e0e0', borderRadius: '2px' }}>
            <div 
              style={{ 
                height: '100%', 
                backgroundColor: '#2196f3', 
                width: `${(currentStep / 7) * 100}%`,
                borderRadius: '2px',
                transition: 'width 0.3s ease'
              }}
            />
          </div>
        </div>

        {/* Conditional rendering of components based on currentStep */}
        {currentStep === 1 && (<JobSelection onNext={handleJobsSelected} />)}
        {currentStep === 2 && (<SkillSelection onSkillsSelected={handleSkillsSelected} />)}
        {currentStep === 3 && (<ResumeUpload onResumeUploaded={handleResumeUploaded} />)}
        {currentStep === 4 && (
          <div>
            <h2>🎉 Ready to Start Interview!</h2>
            <div style={{ marginBottom: '20px', backgroundColor: '#f5f5f5', padding: '15px', borderRadius: '4px' }}>
              <p><strong>Selected Jobs:</strong> {interviewData.selectedJobs.length}</p>
              <p><strong>Selected Skills:</strong> {interviewData.selectedSkills.length}</p>
              <p><strong>Resume:</strong> {interviewData.resumeText ? 'Uploaded' : 'Not uploaded'}</p>
              {interviewData.resumeText && (
                <p><em>(Resume Snippet: "{interviewData.resumeText.substring(0, Math.min(interviewData.resumeText.length, 100))}...")</em></p>
              )}
            </div>
            <button 
              onClick={startInterview}
              disabled={loadingInterview} // Socket.IO connection is handled implicitly by AuthProvider/useEffect
              style={{ 
                padding: '15px 30px',
                backgroundColor: loadingInterview ? '#a5d6a7' : '#4caf50',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: loadingInterview ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                opacity: loadingInterview ? 0.7 : 1
              }}
            >
              {loadingInterview ? 'Generating Questions...' : 'Start Mock Interview'}
            </button>
            {loadingInterview && <p style={{ marginTop: '10px', color: '#4caf50' }}>This might take a moment as AI generates questions.</p>}
          </div>
        )}

        {currentStep === 5 && interviewSessionId && socketRef.current && (
          <InterviewComponent 
            interviewSessionId={interviewSessionId} 
            onInterviewComplete={handleInterviewComplete} 
            socket={socketRef.current} // Pass socket instance
          />
        )}
        {currentStep === 5 && !interviewSessionId && !loadingInterview && (
          <p style={{ textAlign: 'center', color: 'red' }}>Error: Interview session ID not found. Please restart the process.</p>
        )}

        {currentStep === 6 && interviewSessionId && (
          <FeedbackDashboard 
            interviewSessionId={interviewSessionId} 
            onRetakeInterview={handleRetakeInterview}
            onReviewPastInterviews={handleReviewPastInterviews}
          />
        )}
        {currentStep === 6 && !interviewSessionId && (
          <p style={{ textAlign: 'center', color: 'red' }}>Error: Interview session ID not found for feedback. Please restart the process.</p>
        )}

        {currentStep === 7 && (
          <PastInterviewsScreen
            onSelectInterviewForFeedback={handleSelectInterviewForFeedback}
            onRetakeInterview={handleRetakeInterview}
          />
        )}

        {/* Back button */}
        {currentStep > 1 && currentStep < 5 && (
          <button 
            onClick={() => setCurrentStep(currentStep - 1)}
            style={{ 
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#fff',
              border: '1px solid #ccc',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            ← Back
          </button>
        )}
        {/* Home button for Feedback/Past Interviews screens */}
        {(currentStep === 6 || currentStep === 7) && (
          <button 
            onClick={() => setCurrentStep(1)}
            style={{ 
              marginTop: '20px',
              padding: '10px 20px',
              backgroundColor: '#fff',
              border: '1px solid #ccc',
              cursor: 'pointer',
              borderRadius: '4px',
            }}
          >
            ← Home
          </button>
        )}
      </div>
    </div>
  );
}


// This is the root App component that wraps AppComponent with AuthProvider
function App() {
  return (
    <AuthProvider>
      <AppComponent />
    </AuthProvider>
  );
}

export default App;