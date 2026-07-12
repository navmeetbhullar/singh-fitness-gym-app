import React from "react";

interface GymLogoProps {
  className?: string;
  size?: number;
}

export default function GymLogo({ className = "", size = 80 }: GymLogoProps) {
  return (
    <div 
      className={`relative flex items-center justify-center shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      <svg
        viewBox="0 0 200 200"
        className="w-full h-full drop-shadow-[0_4px_12px_rgba(250,204,21,0.2)]"
      >
        {/* Outer Ring with Glow */}
        <circle cx="100" cy="100" r="94" fill="#0c0c0c" stroke="#facc15" strokeWidth="3" />
        
        {/* Four Compass Points (Triangles) */}
        {/* North */}
        <polygon points="100,2 108,12 92,12" fill="#facc15" />
        {/* South */}
        <polygon points="100,198 108,188 92,188" fill="#facc15" />
        {/* East */}
        <polygon points="198,100 188,108 188,92" fill="#facc15" />
        {/* West */}
        <polygon points="2,100 12,108 12,92" fill="#facc15" />

        {/* Second Inner Border */}
        <circle cx="100" cy="100" r="82" fill="none" stroke="#facc15" strokeWidth="1" strokeDasharray="4 2" />

        {/* Yellow Outer Bevel Circle */}
        <circle cx="100" cy="100" r="76" fill="#000000" stroke="#facc15" strokeWidth="6" />

        {/* Curved Path for Text "ARPAN" */}
        <path
          id="textPath-singh-fitness"
          d="M 40,100 A 60,60 0 0,1 160,100"
          fill="none"
          stroke="none"
        />

        {/* Curved Path for Text "FITNESS" */}
        <path
          id="textPath-fitness"
          d="M 160,100 A 60,60 0 0,1 40,100"
          fill="none"
          stroke="none"
        />

        {/* Arched Text */}
        <text fill="#facc15" fontSize="20" fontWeight="900" letterSpacing="3" textAnchor="middle">
          <textPath href="#textPath-singh-fitness" startOffset="50%">
            ARPAN
          </textPath>
        </text>

        <text fill="#facc15" fontSize="16" fontWeight="900" letterSpacing="2" textAnchor="middle">
          <textPath href="#textPath-fitness" startOffset="50%">
            FITNESS
          </textPath>
        </text>

        {/* Center Circle with Bodybuilder Silhouette */}
        <circle cx="100" cy="100" r="46" fill="#facc15" stroke="#111" strokeWidth="2" />

        {/* Stylized Bodybuilder Silhouette Path */}
        <g transform="translate(68, 62) scale(0.65)">
          {/* Head */}
          <circle cx="50" cy="20" r="8" fill="#000000" />
          {/* Neck */}
          <path d="M 47,27 Q 50,32 53,27 Z" fill="#000000" />
          {/* Left Arm (Flexing Bicep & holding DB) */}
          <path 
            d="M 38,36 Q 20,24 22,12 Q 28,10 32,22 Q 38,30 42,34 Z" 
            fill="#000000" 
          />
          {/* Dumbbell held in left hand */}
          <rect x="16" y="6" width="6" height="12" rx="1.5" fill="#000000" transform="rotate(-15, 19, 12)" />
          <line x1="12" y1="12" x2="26" y2="12" stroke="#000000" strokeWidth="3" transform="rotate(-15, 19, 12)" />
          <rect x="24" y="6" width="6" height="12" rx="1.5" fill="#000000" transform="rotate(-15, 19, 12)" />

          {/* Right Arm (Flexed/resting hand on hip) */}
          <path 
            d="M 62,36 Q 74,44 68,54 Q 62,56 62,48 Q 62,42 60,36 Z" 
            fill="#000000" 
          />

          {/* Torso & Muscle Definition */}
          <path 
            d="M 38,36 Q 50,30 62,36 Q 66,54 58,74 L 42,74 Q 34,54 38,36 Z" 
            fill="#000000" 
          />
          
          {/* Abs/V-line */}
          <path d="M 44,74 Q 50,65 56,74 Z" fill="#facc15" />
          <path d="M 46,65 Q 50,58 54,65 Z" fill="#facc15" />
          
          {/* Pecs cut */}
          <path d="M 40,44 Q 50,48 60,44" stroke="#facc15" strokeWidth="2.5" fill="none" />
        </g>
      </svg>
    </div>
  );
}
