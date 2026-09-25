// src/pages/public/RegisterPage.jsx — Patient Registration

import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart, Mail, Lock, Eye, EyeOff, User, AlertCircle, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';

export default function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({ firstName: '', lastName: '', email: '', password: '', confirmPassword: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [fieldErrors, setFieldErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  function validate() {
    const errors = {};
    if (!form.firstName.trim()) errors.firstName = 'First name is required.';
    if (!form.lastName.trim()) errors.lastName = 'Last name is required.';
    if (!form.email) errors.email = 'Email is required.';
    if (form.password.length < 8) errors.password = 'Password must be at least 8 characters.';
    if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(form.password)) {
      errors.password = 'Must contain uppercase, lowercase, and a number.';
    }
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match.';
    return errors;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    const errors = validate();
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    setLoading(true);
    try {
      await register({ firstName: form.firstName, lastName: form.lastName, email: form.email, password: form.password });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      const errs = err.response?.data?.errors || [];
      if (errs.length > 0) {
        const fe = {};
        errs.forEach(e => { fe[e.field] = e.message; });
        setFieldErrors(fe);
      } else {
        setError(msg);
      }
    } finally {
      setLoading(false);
    }
  }

  if (success) {
    return (
      <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, var(--color-primary-900), var(--color-accent-600))', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
        <div style={{ background: 'white', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-10)', maxWidth: 440, width: '100%', textAlign: 'center', boxShadow: 'var(--shadow-xl)' }}>
          <CheckCircle size={48} style={{ color: 'var(--color-success-500)', margin: '0 auto var(--space-4)' }} />
          <h2 style={{ marginBottom: 'var(--space-2)' }}>Account Created!</h2>
          <p style={{ color: 'var(--color-text-secondary)' }}>Redirecting you to login...</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'linear-gradient(135deg, var(--color-primary-900) 0%, var(--color-primary-700) 60%, var(--color-accent-600) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-6)' }}>
      <div style={{ background: 'white', borderRadius: 'var(--radius-2xl)', padding: 'var(--space-10)', width: '100%', maxWidth: 480, boxShadow: 'var(--shadow-xl)' }}>
        <div style={{ textAlign: 'center', marginBottom: 'var(--space-8)' }}>
          <div style={{ width: 52, height: 52, background: 'linear-gradient(135deg, var(--color-primary-600), var(--color-accent-500))', borderRadius: 'var(--radius-xl)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)', color: 'white' }}>
            <Heart size={24} />
          </div>
          <h1 style={{ fontSize: 'var(--text-2xl)', marginBottom: 'var(--space-1)' }}>Create Account</h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>Join MediCore as a patient</p>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 'var(--space-5)' }}><AlertCircle size={16} />{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <div className="form-group">
              <label className="form-label required">First Name</label>
              <input id="firstName" type="text" className={`form-input ${fieldErrors.firstName ? 'error' : ''}`} placeholder="Rahul" value={form.firstName} onChange={e => setForm(f => ({ ...f, firstName: e.target.value }))} required />
              {fieldErrors.firstName && <span className="form-error">{fieldErrors.firstName}</span>}
            </div>
            <div className="form-group">
              <label className="form-label required">Last Name</label>
              <input id="lastName" type="text" className={`form-input ${fieldErrors.lastName ? 'error' : ''}`} placeholder="Kumar" value={form.lastName} onChange={e => setForm(f => ({ ...f, lastName: e.target.value }))} required />
              {fieldErrors.lastName && <span className="form-error">{fieldErrors.lastName}</span>}
            </div>
          </div>

          <div className="form-group">
            <label className="form-label required">Email address</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: 'var(--space-4)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input id="reg-email" type="email" className={`form-input ${fieldErrors.email ? 'error' : ''}`} style={{ paddingLeft: 'calc(var(--space-4) + 16px + var(--space-2))' }} placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required autoComplete="email" />
            </div>
            {fieldErrors.email && <span className="form-error">{fieldErrors.email}</span>}
          </div>

          <div className="form-group">
            <label className="form-label required">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: 'var(--space-4)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
              <input id="reg-password" type={showPassword ? 'text' : 'password'} className={`form-input ${fieldErrors.password ? 'error' : ''}`} style={{ paddingLeft: 'calc(var(--space-4) + 16px + var(--space-2))', paddingRight: 'var(--space-10)' }} placeholder="Min 8 chars, upper + lower + number" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} required autoComplete="new-password" />
              <button type="button" onClick={() => setShowPassword(s => !s)} style={{ position: 'absolute', right: 'var(--space-3)', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)', display: 'flex' }}>
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {fieldErrors.password && <span className="form-error">{fieldErrors.password}</span>}
          </div>

          <div className="form-group">
            <label className="form-label required">Confirm Password</label>
            <input id="confirmPassword" type="password" className={`form-input ${fieldErrors.confirmPassword ? 'error' : ''}`} placeholder="Repeat password" value={form.confirmPassword} onChange={e => setForm(f => ({ ...f, confirmPassword: e.target.value }))} required autoComplete="new-password" />
            {fieldErrors.confirmPassword && <span className="form-error">{fieldErrors.confirmPassword}</span>}
          </div>

          <button type="submit" id="register-btn" className="btn btn-primary btn-full btn-lg" disabled={loading} style={{ marginTop: 'var(--space-2)' }}>
            {loading ? <><div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> Creating account...</> : 'Create Account'}
          </button>
        </form>

        <p style={{ textAlign: 'center', marginTop: 'var(--space-6)', fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
          Already have an account?{' '}
          <Link to="/login" style={{ color: 'var(--color-primary-600)', fontWeight: 600 }}>Sign in</Link>
        </p>
      </div>
    </div>
  );
}
