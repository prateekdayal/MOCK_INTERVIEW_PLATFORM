// frontend/src/pages/SkillSelection.jsx
import React, { useState, useEffect } from 'react';
import axios from 'axios'; // Make sure you have axios installed: npm install axios

const SkillSelection = ({ onSkillsSelected }) => {
  const [availableSkills, setAvailableSkills] = useState([]);
  const [selectedSkillIds, setSelectedSkillIds] = useState([]);
  const [searchTerm, setSearchTerm] = useState(''); // New state for search term
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch skills from your backend
    const fetchSkills = async () => {
      try {
        const response = await axios.get('http://localhost:5000/api/skills'); // Adjust port if needed
        setAvailableSkills(response.data);
        setLoading(false);
      } catch (err) {
        console.error('Error fetching skills:', err);
        setError('Failed to load skills. Please try again.');
        setLoading(false);
      }
    };
    fetchSkills();
  }, []);

  const handleSkillToggle = (skillId) => {
    setSelectedSkillIds(prev =>
      prev.includes(skillId)
        ? prev.filter(id => id !== skillId)
        : [...prev, skillId]
    );
  };

  const handleSubmit = () => {
    if (selectedSkillIds.length > 0) {
      onSkillsSelected(selectedSkillIds);
    } else {
      alert('Please select at least one skill to continue.');
    }
  };

  // Filter skills based on search term
  const filteredSkills = availableSkills.filter(skill =>
    skill.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    skill.category.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Group filtered skills by category for better display
  const skillsByCategory = filteredSkills.reduce((acc, skill) => {
    const category = skill.category || 'Uncategorized';
    if (!acc[category]) {
      acc[category] = [];
    }
    acc[category].push(skill);
    return acc;
  }, {});

  if (loading) return <p style={{ textAlign: 'center' }}>Loading skills...</p>;
  if (error) return <p style={{ textAlign: 'center', color: 'red' }}>{error}</p>;
  
  return (
    <div style={{ padding: '20px', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
      <h2>2. Select Your Skills</h2>
      <p style={{ marginBottom: '20px', color: '#666' }}>
        Choose the skills relevant to the jobs you selected or that you want to be interviewed on.
      </p>

      {/* Search box for quick filtering */}
      <input
        type="text"
        placeholder="Search for skills or categories..."
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

      {selectedSkillIds.length > 0 && (
        <div style={{ marginBottom: '20px', padding: '10px', border: '1px solid #e9ecef', borderRadius: '4px', backgroundColor: '#f8f9fa' }}>
          <strong>Selected Skills:</strong>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '5px' }}>
            {selectedSkillIds.map(id => {
              const selectedSkill = availableSkills.find(skill => skill._id === id);
              return selectedSkill ? (
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
                  {selectedSkill.name}
                  <button
                    onClick={() => handleSkillToggle(id)}
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
        {Object.entries(skillsByCategory).length === 0 ? (
            <p style={{ textAlign: 'center', color: '#888' }}>No skills found matching your search or no skills available.</p>
        ) : (
            Object.entries(skillsByCategory).map(([category, skills]) => (
                <div key={category} style={{ marginBottom: '20px', paddingBottom: '15px', borderBottom: '1px solid #eee' }}>
                    <h3 style={{ marginTop: '0', marginBottom: '10px', color: '#333', fontSize: '1.1em' }}>{category}</h3>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
                        {skills.map(skill => (
                            <button
                                key={skill._id}
                                onClick={() => handleSkillToggle(skill._id)}
                                style={{
                                    padding: '8px 15px',
                                    borderRadius: '20px',
                                    border: `1px solid ${selectedSkillIds.includes(skill._id) ? '#2196f3' : '#ccc'}`,
                                    backgroundColor: selectedSkillIds.includes(skill._id) ? '#e3f2fd' : '#f8f8f8',
                                    color: selectedSkillIds.includes(skill._id) ? '#2196f3' : '#555',
                                    cursor: 'pointer',
                                    fontSize: '0.9em',
                                    transition: 'all 0.2s ease-in-out'
                                }}
                            >
                                {skill.name}
                            </button>
                        ))}
                    </div>
                </div>
            ))
        )}
      </div>

      <button
        onClick={handleSubmit}
        disabled={selectedSkillIds.length === 0}
        style={{
          marginTop: '30px',
          padding: '12px 24px',
          backgroundColor: selectedSkillIds.length > 0 ? '#2196f3' : '#ccc',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          cursor: selectedSkillIds.length > 0 ? 'pointer' : 'not-allowed',
          fontSize: '1em',
          opacity: selectedSkillIds.length > 0 ? 1 : 0.7
        }}
      >
        Continue to Resume Upload →
      </button>
    </div>
  );
};

export default SkillSelection;