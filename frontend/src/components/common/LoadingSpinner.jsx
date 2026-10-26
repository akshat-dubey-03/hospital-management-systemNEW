// src/components/common/LoadingSpinner.jsx

export default function LoadingSpinner({ size = 'md', className = '' }) {
  const sizeClass = size === 'lg' ? 'spinner spinner-lg' : 'spinner';
  return (
    <div className={`loading-wrapper ${className}`}>
      <div className={sizeClass} />
    </div>
  );
}
