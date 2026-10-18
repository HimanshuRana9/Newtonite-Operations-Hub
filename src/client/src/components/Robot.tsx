import React from 'react';
import mascotImg from '../assets/mascot.png';

export interface RobotProps {
  small?: boolean;
  size?: number | string;
  className?: string;
  showHalo?: boolean;
}

export const Robot: React.FC<RobotProps> = ({
  small = false,
  size,
  className = '',
  showHalo = true
}) => {
  const dimension = size || (small ? 36 : 96);

  return (
    <div
      className={`relative inline-flex items-center justify-center select-none ${className}`}
      style={{ width: dimension, height: dimension }}
      aria-label="Newtonite robot co-pilot mascot"
      role="img"
    >
      {showHalo && (
        <div
          className="absolute inset-0 rounded-full bg-gradient-to-tr from-cyan-500/25 via-indigo-500/30 to-purple-500/25 blur-lg animate-pulse"
          style={{ transform: 'scale(1.15)' }}
        />
      )}
      <img
        src={mascotImg}
        alt="Newtonite Co-Pilot"
        className="relative z-10 w-full h-full object-contain filter drop-shadow-[0_8px_16px_rgba(56,189,248,0.35)] transition-transform duration-300 hover:scale-105"
        loading="eager"
      />
    </div>
  );
};

export default Robot;

