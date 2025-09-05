// frontend/src/pages/PastInterviewsScreen.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import moment from 'moment'; // For date formatting
// --- NEW IMPORTS FOR CHART ---
import { Line } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
);
// --- END NEW IMPORTS ---


const PastInterviewsScreen = ({ onSelectInterviewForFeedback, onRetakeInterview }) => {
  const [pastInterviews, setPastInterviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filter states
  const [filterJob, setFilterJob] = useState('');
  const [filterSkill, setFilterSkill] = useState('');
  const [filterDateFrom, setFilterDateFrom] = useState(''); // YYYY-MM-DD
  const [filterDateTo, setFilterDateTo] = useState('');     // YYYY-MM-DD

  useEffect(() => {
    const fetchPastInterviews = async () => {
      try {
        // Axios interceptor will automatically add the Authorization header
        const response = await axios.get('http://localhost:5000/api/interview'); // Fetches interviews for logged-in user
        setPastInterviews(response.data);
      } catch (err) {
        console.error('Error fetching past interviews:', err.response?.data?.message || err.message);
        if (err.response && err.response.status === 401) {
            setError('Your session has expired or is invalid. Please log in again.');
            // This component doesn't have direct access to logout, App.jsx handles it
        } else {
            setError('Failed to load past interviews. Please try again.');
        }
      } finally {
        setLoading(false);
      }
    };

    fetchPastInterviews();
  }, []); // Run once on mount

  // --- Filtering Logic (No change) ---
  const filteredInterviews = pastInterviews.filter(interview => {
    // Filter by job title
    const matchesJob = filterJob
      ? interview.selectedJobs.some(job => job.title.toLowerCase().includes(filterJob.toLowerCase()))
      : true;

    // Filter by skill name
    const matchesSkill = filterSkill
      ? interview.selectedSkills.some(skill => skill.name.toLowerCase().includes(filterSkill.toLowerCase()))
      : true;

    // Filter by date range
    const interviewDate = moment(interview.startTime);
    const matchesDateFrom = filterDateFrom ? interviewDate.isSameOrAfter(moment(filterDateFrom, 'YYYY-MM-DD'), 'day') : true;
    const matchesDateTo = filterDateTo ? interviewDate.isSameOrBefore(moment(filterDateTo, 'YYYY-MM-DD'), 'day') : true;

    return matchesJob && matchesSkill && matchesDateFrom && matchesDateTo;
  });

  // --- Data Preparation for Graph (Updated to handle no data) ---
  const chartDataPoints = filteredInterviews
    .filter(interview => interview.overallScore !== undefined) // Only include interviews with a score
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime)) // Sort chronologically
    .map(interview => ({
      date: moment(interview.startTime).format('YYYY-MM-DD HH:mm'), // More precise date for graph
      score: parseFloat(interview.overallScore.toFixed(1))
    }));
  
  // --- Chart.js Data Structure ---
  const data = {
    labels: chartDataPoints.map(dataPoint => dataPoint.date), // X-axis labels (dates)
    datasets: [
      {
        label: 'Overall Score',
        data: chartDataPoints.map(dataPoint => dataPoint.score), // Y-axis values (scores)
        fill: false,
        backgroundColor: 'rgb(75, 192, 192)',
        borderColor: 'rgba(75, 192, 192, 0.6)',
        tension: 0.1,
      },
    ],
  };

  // --- Chart.js Options ---
  const options = {
    responsive: true,
    maintainAspectRatio: false, // Allow custom height
    plugins: {
      legend: {
        position: 'top',
      },
      title: {
        display: true,
        text: 'Interview Score Trend',
      },
    },
    scales: {
      y: {
        min: 0,
        max: 10,
        title: {
          display: true,
          text: 'Score / 10',
        },
      },
      x: {
        title: {
          display: true,
          text: 'Date of Interview',
        },
      },
    },
  };


  if (loading) return <p style={{ textAlign: 'center' }}>Loading past interviews...</p>;
  if (error) return (
    <div style={{ textAlign: 'center', padding: '50px', color: 'red' }}>
      <p>{error}</p>
      {error.includes('log in again') && (
        <button
          onClick={onRetakeInterview}
          style={{ marginTop: '20px', padding: '10px 20px', backgroundColor: '#2196f3', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
        >
          Go to Login / Start Page
        </button>
      )}
    </div>
  );
  if (pastInterviews.length === 0) return (
    <div style={{ textAlign: 'center', padding: '50px', border: '1px dashed #ccc', borderRadius: '8px', margin: '20px auto', maxWidth: '600px' }}>
      <p style={{ fontSize: '1.2em', color: '#666' }}>You haven't completed any mock interviews yet.</p>
      <button
        onClick={onRetakeInterview}
        style={{
          marginTop: '20px',
          padding: '12px 25px',
          backgroundColor: '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer',
          fontSize: '1em'
        }}
      >
        Start Your First Interview
      </button>
    </div>
  );

  const getScoreColor = (score) => {
    if (score >= 8) return '#28a745';
    if (score >= 5) return '#ffc107';
    return '#dc3545';
  };

  return (
    <div style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>📚 Your Past Mock Interviews</h2>
      <p style={{ marginBottom: '25px', color: '#666' }}>Review your progress over time.</p>

      {/* Filter Section */}
      <div style={{ marginBottom: '30px', padding: '15px', border: '1px solid #ddd', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h3 style={{ marginTop: '0', marginBottom: '15px', color: '#333' }}>Filter Interviews</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>Job Title:</label>
            <input
              type="text"
              placeholder="e.g., Software Engineer"
              value={filterJob}
              onChange={(e) => setFilterJob(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>Skill:</label>
            <input
              type="text"
              placeholder="e.g., React.js"
              value={filterSkill}
              onChange={(e) => setFilterSkill(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>Date From:</label>
            <input
              type="date"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
          <div>
            <label style={{ display: 'block', marginBottom: '5px', fontSize: '0.9em' }}>Date To:</label>
            <input
              type="date"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              style={{ width: '100%', padding: '8px', border: '1px solid #ccc', borderRadius: '4px' }}
            />
          </div>
        </div>
      </div>

      {/* --- Graph Integration --- */}
      {chartDataPoints.length > 0 ? (
        <div style={{ marginBottom: '30px', padding: '20px', border: '1px solid #a8d0ed', borderRadius: '8px', backgroundColor: '#eef7ff', textAlign: 'center', height: '300px' }}> {/* Added height */}
          <Line data={data} options={options} />
        </div>
      ) : (
        <div style={{ marginBottom: '30px', padding: '20px', border: '1px dashed #a8d0ed', borderRadius: '8px', backgroundColor: '#eef7ff', textAlign: 'center' }}>
          <h3 style={{ marginTop: '0', marginBottom: '15px', color: '#0056b3' }}>Score Trend Over Time (Graph)</h3>
          <p style={{ color: '#0056b3' }}>Complete at least one interview to see your score trend here.</p>
        </div>
      )}
      {/* --- End Graph Integration --- */}


      {filteredInterviews.length === 0 && (pastInterviews.length > 0) ? (
        <p style={{ textAlign: 'center', fontSize: '1.1em', color: '#888' }}>
          No interviews match your current filter criteria.
        </p>
      ) : (
        <div style={{ display: 'grid', gap: '20px' }}>
          {filteredInterviews.map(interview => (
            <div key={interview._id} style={{ border: '1px solid #eee', borderRadius: '8px', padding: '15px', backgroundColor: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.05)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                <h4 style={{ margin: '0', color: '#333' }}>
                  Interview on {moment(interview.startTime).format('MMMM Do, YYYY [at] h:mm A')}
                </h4>
                <span style={{ fontSize: '1.2em', fontWeight: 'bold', color: getScoreColor(interview.overallScore) }}>
                  Score: {interview.overallScore.toFixed(1)} / 10
                </span>
              </div>
              <p style={{ fontSize: '0.9em', color: '#555', marginBottom: '5px' }}>
                **Job(s):** {interview.selectedJobs.map(job => job.title).join(', ')}
              </p>
              <p style={{ fontSize: '0.9em', color: '#555', marginBottom: '15px' }}>
                **Skill(s):** {interview.selectedSkills.map(skill => skill.name).join(', ')}
              </p>
              <button
                onClick={() => onSelectInterviewForFeedback(interview._id)}
                style={{
                  padding: '8px 15px',
                  backgroundColor: '#007bff',
                  color: 'white',
                  border: 'none',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  fontSize: '0.9em'
                }}
              >
                View Full Report →
              </button>
            </div>
          ))}
        </div>
      )}


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
          Start New Interview
        </button>
      </div>
    </div>
  );
};

export default PastInterviewsScreen;