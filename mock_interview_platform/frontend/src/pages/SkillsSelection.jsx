import { useEffect, useState } from 'react';
import axios from 'axios';

export default function SkillSelection({ onSkillsSelected }) {
  const [skills, setSkills] = useState([]);
  const [selected, setSelected] = useState([]);
  const [groupedSkills, setGroupedSkills] = useState({});

  useEffect(() => {
    axios.get('http://localhost:5000/api/skills')
      .then(res => {
        setSkills(res.data);
        // Group skills by category
        const grouped = res.data.reduce((acc, skill) => {
          const category = skill.category || 'General';
          if (!acc[category]) acc[category] = [];
          acc[category].push(skill);
          return acc;
        }, {});
        setGroupedSkills(grouped);
      })
      .catch(err => console.error(err));
  }, []);

  const toggleSkill = (id) => {
    if (selected.includes(id)) {
      setSelected(selected.filter(skillId => skillId !== id));
    } else {
      setSelected([...selected, id]);
    }
  };

  const handleNext = () => {
    if (selected.length > 0) {
      onSkillsSelected(selected);
    }
  };

  return (
    <div>
      <h2>Select Skills to Focus On</h2>
      <p>Choose the skills you want to be evaluated on during the interview:</p>
      
      {Object.entries(groupedSkills).map(([category, categorySkills]) => (
        <div key={category} style={{ marginBottom: '20px' }}>
          <h3 style={{ 
            backgroundColor: '#f5f5f5', 
            padding: '8px 12px', 
            margin: '0 0 10px 0',
            borderRadius: '4px'
          }}>
            {category}
          </h3>
          {categorySkills.map(skill => (
            <div
              key={skill._id}
              onClick={() => toggleSkill(skill._id)}
              style={{ 
                cursor: 'pointer', 
                border: '1px solid #ccc', 
                margin: '4px 0', 
                padding: '8px 12px',
                borderRadius: '4px',
                backgroundColor: selected.includes(skill._id) ? '#e3f2fd' : 'white',
                borderColor: selected.includes(skill._id) ? '#2196f3' : '#ccc'
              }}
            >
              {skill.name}
              {selected.includes(skill._id) && <span style={{ color: '#2196f3', fontWeight: 'bold' }}> ✅</span>}
            </div>
          ))}
        </div>
      ))}
      
      <div style={{ marginTop: '20px' }}>
        <p>Selected: {selected.length} skill(s)</p>
        <button 
          onClick={handleNext}
          disabled={selected.length === 0}
          style={{ 
            padding: '12px 24px',
            backgroundColor: selected.length > 0 ? '#2196f3' : '#ccc',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: selected.length > 0 ? 'pointer' : 'not-allowed',
            fontSize: '16px'
          }}
        >
          Next: Upload Resume →
        </button>
      </div>
    </div>
  );
}