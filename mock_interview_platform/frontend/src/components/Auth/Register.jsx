// frontend/src/components/Auth/Register.jsx
import React, { useState } from 'react';
import axios from 'axios';

const Register = ({ onRegisterSuccess, onSwitchToLogin }) => {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    try {
      const response = await axios.post('http://localhost:5000/api/auth/register', { username, email, password });
      
      // --- CRITICAL CHECK HERE ---
      // Ensure response.data.token and response.data.user exist
      if (response.data && response.data.token && response.data.user) {
          localStorage.setItem('token', response.data.token);
          localStorage.setItem('user', JSON.stringify(response.data.user));
          setSuccessMessage('Registration successful! You are now logged in.');
          onRegisterSuccess(response.data.user, response.data.token); // Pass both user and token
      } else {
          throw new Error('Registration response missing token or user data.');
      }
    } catch (err) {
      console.error('Registration error:', err.response?.data?.message || err.message);
      const backendErrorMessage = err.response?.data?.message || 'Registration failed. Please try again.';
      
      if (backendErrorMessage.includes('user with this email or username already exists')) {
        setError(
          <>
            This username or email is already registered. Please{' '}
            <span
              onClick={onSwitchToLogin}
              style={{ color: '#2196f3', cursor: 'pointer', textDecoration: 'underline' }}
            >
              try logging in
            </span>{' '}
            or use different credentials.
          </>
        );
      } else {
        setError(backendErrorMessage);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: '20px', maxWidth: '400px', margin: '50px auto', border: '1px solid #e0e0e0', borderRadius: '8px', boxShadow: '0 2px 4px rgba[0,0,0,0.1)', textAlign: 'center' }}>
      <h2>Register</h2>
      {error && <p style={{ color: 'red', marginBottom: '15px' }}>{error}</p>}
      {successMessage && <p style={{ color: 'green', marginBottom: '15px' }}>{successMessage}</p>}
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input
          type="text"
          placeholder="Username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          required
          style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1em' }}
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1em' }}
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          style={{ padding: '10px', border: '1px solid #ccc', borderRadius: '4px', fontSize: '1em' }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            padding: '12px 20px',
            backgroundColor: loading ? '#a5d6a7' : '#2196f3',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: loading ? 'not-allowed' : 'pointer',
            fontSize: '1em'
          }}
        >
          {loading ? 'Registering...' : 'Register'}
        </button>
      </form>
      <p style={{ marginTop: '20px', fontSize: '0.9em' }}>
        Already have an account?{' '}
        <span
          onClick={onSwitchToLogin}
          style={{ color: '#2196f3', cursor: 'pointer', textDecoration: 'underline' }}
        >
          Login here
        </span>
      </p>
    </div>
  );
};

export default Register;