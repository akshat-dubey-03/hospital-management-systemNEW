// src/pages/public/LandingPage.jsx

import { Link } from 'react-router-dom';
import {
  Heart, Calendar, Users, Shield, Clock, Star,
  ChevronRight, Activity, Stethoscope, Brain,
  Bone, Baby, Sparkles
} from 'lucide-react';

const DEPARTMENTS = [
  { icon: Heart,      name: 'Cardiology',       desc: 'Heart & vascular care' },
  { icon: Brain,      name: 'Neurology',         desc: 'Brain & nervous system' },
  { icon: Bone,       name: 'Orthopedics',       desc: 'Bones, joints & muscles' },
  { icon: Baby,       name: 'Pediatrics',        desc: 'Children\'s health' },
  { icon: Sparkles,   name: 'Dermatology',       desc: 'Skin, hair & nails' },
  { icon: Stethoscope,name: 'General Medicine',  desc: 'Primary care & wellness' },
];

const FEATURES = [
  {
    icon: Calendar,
    title: 'Easy Appointment Booking',
    desc: 'Browse available time slots, pick a date, and book with a few taps. No calls, no queues.',
  },
  {
    icon: Users,
    title: 'Find the Right Doctor',
    desc: 'Search doctors by specialization or department. View profiles, experience, and availability.',
  },
  {
    icon: Shield,
    title: 'Secure & Private',
    desc: 'Role-based access ensures your medical information is only seen by the right people.',
  },
  {
    icon: Clock,
    title: 'Real-Time Availability',
    desc: 'Slots update instantly. If a slot is cancelled, it becomes available again immediately.',
  },
  {
    icon: Activity,
    title: 'AI Health Assistant',
    desc: 'Our intelligent chatbot guides you to the right department and answers your questions 24/7.',
  },
  {
    icon: Star,
    title: 'Track Your History',
    desc: 'View upcoming and past appointments, give feedback, and manage your health journey.',
  },
];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* ── Navbar ──────────────────────────────────────── */}
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">
            <div className="navbar-brand-icon">
              <Heart size={18} />
            </div>
            <div>
              <div style={{ lineHeight: 1 }}>MediCore</div>
              <div style={{ fontSize: 'var(--text-xs)', fontWeight: 400, color: 'var(--color-text-muted)', fontFamily: 'var(--font-sans)' }}>HMS</div>
            </div>
          </div>
          <div className="navbar-links">
            <Link to="/login" className="btn btn-secondary btn-sm">Patient Login</Link>
            <Link to="/register" className="btn btn-primary btn-sm">Get Started</Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────── */}
      <section className="hero">
        <div className="hero-content fade-in">
          <div className="hero-badge">
            <Activity size={14} />
            Online Hospital Management System
          </div>
          <h1 className="hero-title">
            Healthcare, <span>Simplified</span><br />
            for Everyone.
          </h1>
          <p className="hero-subtitle">
            Book appointments with specialist doctors, manage your health journey, and get
            instant answers from our AI assistant — all in one place.
          </p>
          <div className="hero-actions">
            <Link to="/register" className="btn btn-lg" style={{
              background: 'white',
              color: 'var(--color-primary-700)',
              fontWeight: 700,
            }}>
              Register as Patient
              <ChevronRight size={18} />
            </Link>
            <Link to="/login" className="btn btn-lg" style={{
              background: 'rgba(255,255,255,0.15)',
              color: 'white',
              border: '1.5px solid rgba(255,255,255,0.3)',
              backdropFilter: 'blur(4px)',
            }}>
              Sign In
            </Link>
          </div>
        </div>
      </section>

      {/* ── Departments ─────────────────────────────────── */}
      <section style={{ padding: 'var(--space-16) var(--space-6)', background: 'var(--color-neutral-50)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
            <h2 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-3)' }}>
              Our Departments
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-lg)' }}>
              Specialized care across all major medical disciplines
            </p>
          </div>
          <div className="grid-3">
            {DEPARTMENTS.map(({ icon: Icon, name, desc }) => (
              <div key={name} className="card" style={{ textAlign: 'center', cursor: 'default' }}>
                <div style={{
                  width: 56, height: 56,
                  background: 'var(--color-primary-50)',
                  borderRadius: 'var(--radius-xl)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  margin: '0 auto var(--space-4)',
                  color: 'var(--color-primary-600)',
                }}>
                  <Icon size={24} />
                </div>
                <h3 style={{ fontSize: 'var(--text-lg)', marginBottom: 'var(--space-2)' }}>{name}</h3>
                <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)' }}>{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────── */}
      <section style={{ padding: 'var(--space-16) var(--space-6)' }}>
        <div className="container">
          <div style={{ textAlign: 'center', marginBottom: 'var(--space-10)' }}>
            <h2 style={{ fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-3)' }}>
              Everything You Need
            </h2>
            <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-lg)' }}>
              A complete hospital management system for patients, doctors, and administrators
            </p>
          </div>
          <div className="grid-3">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div key={title} className="card" style={{ display: 'flex', gap: 'var(--space-4)', cursor: 'default' }}>
                <div style={{
                  width: 44, height: 44,
                  background: 'var(--color-primary-50)',
                  borderRadius: 'var(--radius-lg)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'var(--color-primary-600)',
                  flexShrink: 0,
                }}>
                  <Icon size={20} />
                </div>
                <div>
                  <h3 style={{ fontSize: 'var(--text-base)', marginBottom: 'var(--space-2)' }}>{title}</h3>
                  <p style={{ color: 'var(--color-text-secondary)', fontSize: 'var(--text-sm)', lineHeight: 1.6 }}>{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────── */}
      <section style={{
        padding: 'var(--space-16) var(--space-6)',
        background: 'linear-gradient(135deg, var(--color-primary-900), var(--color-primary-700))',
        textAlign: 'center',
      }}>
        <h2 style={{ color: 'white', fontSize: 'var(--text-3xl)', marginBottom: 'var(--space-4)' }}>
          Ready to take control of your health?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.75)', fontSize: 'var(--text-lg)', marginBottom: 'var(--space-8)' }}>
          Create your patient account in seconds. It's free.
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-4)', justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register" className="btn btn-lg" style={{ background: 'white', color: 'var(--color-primary-700)', fontWeight: 700 }}>
            Create Patient Account
          </Link>
          <Link to="/doctor/login" className="btn btn-lg" style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1.5px solid rgba(255,255,255,0.25)' }}>
            Doctor Login
          </Link>
          <Link to="/admin/login" className="btn btn-lg" style={{ background: 'rgba(255,255,255,0.12)', color: 'white', border: '1.5px solid rgba(255,255,255,0.25)' }}>
            Admin Login
          </Link>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────── */}
      <footer style={{
        background: 'var(--color-neutral-900)',
        color: 'rgba(255,255,255,0.5)',
        textAlign: 'center',
        padding: 'var(--space-6)',
        fontSize: 'var(--text-sm)',
      }}>
        © 2025 MediCore HMS — Online Hospital Management System. B.Tech Academic Project.
      </footer>
    </div>
  );
}
