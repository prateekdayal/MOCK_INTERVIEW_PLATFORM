// frontend/src/components/JobSelection.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios';

export default function JobSelection({ onNext }) {
  const [jobs, setJobs] = useState([]);
  const [selectedJobIds, setSelectedJobIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchJobs = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/jobs');
        console.log("DEBUG: Fetched Jobs:", response.data); // Inspect fetched data
        setJobs(response.data);
      } catch (err) {
        console.error('Error fetching jobs:', err);
        setError('Failed to load jobs. Please check your backend connection.');
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, []);

  const handleJobToggle = (jobId) => {
    setSelectedJobIds(prev =>
      prev.includes(jobId)
        ? prev.filter(id => id !== jobId)
        : [...prev, jobId]
    );
  };

  const handleNextClick = () => {
    if (selectedJobIds.length > 0) {
      onNext(selectedJobIds);
    } else {
      alert('Please select at least one job to continue.');
    }
  };

  // --- UPDATED FILTERING LOGIC WITH NULL CHECKS ---
  const filteredJobs = jobs.filter(job => {
    const lowerCaseSearchTerm = searchTerm.toLowerCase();
    const title = job.title ? job.title.toLowerCase() : ''; // Default to empty string if undefined/null
    const description = job.description ? job.description.toLowerCase() : ''; // Default to empty string if undefined/null

    return title.includes(lowerCaseSearchTerm) || description.includes(lowerCaseSearchTerm);
  });
  // --- END UPDATED FILTERING ---

  if (loading) {
    return <p style={{ textAlign: 'center' }}>Loading jobs...</p>;
  }

  if (error) {
    return <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>;
  }

  return (
    <div style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>1. Select Job(s) for Interview</h2>
      <p style={{ marginBottom: '20px', color: '#666' }}>Choose the job roles you're interested in. You can select multiple.</p>

      <input
        type="text"
        placeholder="Search for job titles or keywords..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        style={{
          width: '100%',
          padding: '10px',
          marginBottom: '20px',
          border: '1px solid #ccc',
          borderRadius: '4px',
          fontSize: '1em'
        }}
      />

      {selectedJobIds.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #e9ecef', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
          <strong>Selected Jobs:</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '5px' }}>
            {selectedJobIds.map(id => {
              const selectedJob = jobs.find(job => job._id === id);
              return selectedJob ? (
                <span
                  key={id}
                  style={{
                    backgroundColor: '#e3f2fd',
                    color: '#1e88e5',
                    padding: '6px 10px',
                    borderRadius: '15px',
                    fontSize: '0.9em',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '5px'
                  }}
                >
                  {selectedJob.title || 'Unknown Job'} {/* Added fallback */}
                  <button
                    onClick={() => handleJobToggle(id)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#1e88e5',
                      cursor: 'pointer',
                      fontSize: '1.1em',
                      padding: '0',
                      marginLeft: '5px'
                    }}
                  >
                    ×
                  </button>
                </span>
              ) : null;
            })}
          </div>
        </div>
      )}

      <div style={{ maxHeight: '400px', overflowY: 'auto', border: '1px solid #ddd', borderRadius: '4px', padding: '10px', backgroundColor: '#fff' }}>
        {filteredJobs.length === 0 ? (
          <p style={{ textAlign: 'center', color: '#888' }}>No jobs found matching your search or no jobs available.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '15px' }}>
            {filteredJobs.map(job => (
              <div
                key={job._id}
                onClick={() => handleJobToggle(job._id)}
                style={{
                  border: `2px solid ${selectedJobIds.includes(job._id) ? '#2196f3' : '#e0e0e0'}`,
                  borderRadius: '6px',
                  padding: '15px',
                  cursor: 'pointer',
                  backgroundColor: selectedJobIds.includes(job._id) ? '#e3f2fd' : '#ffffff',
                  boxShadow: selectedJobIds.includes(job._id) ? '0 0 8px rgba(33, 150, 243, 0.3)' : '0 1px 3px rgba(0,0,0,0.05)',
                  transition: 'all 0.2s ease-in-out',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  minHeight: '120px'
                }}
              >
                <h3 style={{ margin: '0 0 10px 0', color: '#333', fontSize: '1.1em' }}>{job.title || 'Untitled Job'}</h3> {/* Added fallback */}
                <p style={{ fontSize: '0.9em', color: '#555', flexGrow: 1 }}>{(job.description || 'No description.').substring(0, 100)}{job.description && job.description.length > 100 ? '...' : ''}</p> {/* Added fallback */}
                <div style={{ textAlign: 'right', marginTop: '10px' }}>
                  {selectedJobIds.includes(job._id) ? (
                    <span style={{ color: '#2196f3', fontWeight: 'bold' }}>Selected</span>
                  ) : (
                    <span style={{ color: '#888' }}>Click to select</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleNextClick}
        disabled={selectedJobIds.length === 0}
        style={{
          marginTop: '30px',
          padding: '12px 24px',
          backgroundColor: selectedJobIds.length > 0 ? '#2196f3' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: selectedJobIds.length > 0 ? 'pointer' : 'not-allowed',
          fontSize: '1em',
          opacity: selectedJobIds.length > 0 ? 1 : 0.7
        }}
      >
        Continue to Skill Selection →
      </button>
    </div>
  );
}