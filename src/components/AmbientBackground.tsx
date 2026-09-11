import React from "react";
import stadiumBg from "../assets/images/stadium_ambient_bg_1788865527690.jpg";

export const AmbientBackground: React.FC = () => {
  return (
    <div 
      className="fixed inset-0 pointer-events-none select-none z-0 overflow-hidden" 
      aria-hidden="true"
    >
      {/* Base Solid Dark Canvas */}
      <div className="absolute inset-0 bg-[#04060A]" />

      {/* Cinematic Stadium Atmosphere Imagery */}
      <div className="absolute inset-0 opacity-[0.28] mix-blend-screen overflow-hidden">
        <img
          src={stadiumBg}
          alt=""
          className="w-full h-full object-cover object-center scale-105 filter blur-[3px] transform-gpu"
          referrerPolicy="no-referrer"
        />
        {/* Soft dark gradient mask over image to integrate smoothly */}
        <div className="absolute inset-0 bg-gradient-to-b from-[#04060A]/80 via-transparent to-[#04060A]" />
      </div>

      {/* Volumetric Top Stadium Floodlight Ray */}
      <div 
        className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[900px] h-[500px] pointer-events-none opacity-40 mix-blend-screen"
        style={{
          background: "radial-gradient(ellipse at 50% 0%, rgba(10, 132, 255, 0.45) 0%, rgba(94, 92, 230, 0.25) 45%, transparent 75%)",
          filter: "blur(60px)",
        }}
      />

      {/* Fluid Dynamic Ambient Auroras (Slow organic floating orbs) */}
      {/* Orb 1: Upper Left Cyan-Blue Energy */}
      <div 
        className="absolute -top-24 -left-20 w-[550px] h-[550px] rounded-full animate-ambient-1 mix-blend-screen pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(10, 132, 255, 0.22) 0%, rgba(10, 132, 255, 0.05) 50%, transparent 70%)",
          filter: "blur(80px)",
        }}
      />

      {/* Orb 2: Upper Right Deep Indigo & Violet Glow */}
      <div 
        className="absolute top-10 -right-28 w-[600px] h-[600px] rounded-full animate-ambient-2 mix-blend-screen pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(94, 92, 230, 0.20) 0%, rgba(191, 90, 242, 0.08) 50%, transparent 70%)",
          filter: "blur(90px)",
        }}
      />

      {/* Orb 3: Mid-Lower Pitch Ambient Emerald Accent (Subtle stadium turf reflection) */}
      <div 
        className="absolute top-[45%] -left-36 w-[500px] h-[500px] rounded-full animate-ambient-3 mix-blend-screen pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(48, 209, 88, 0.08) 0%, rgba(10, 132, 255, 0.04) 50%, transparent 70%)",
          filter: "blur(100px)",
        }}
      />

      {/* Orb 4: Bottom Center Warm Spotlight Glow */}
      <div 
        className="absolute -bottom-32 left-1/3 w-[650px] h-[500px] rounded-full animate-ambient-1 mix-blend-screen pointer-events-none"
        style={{
          background: "radial-gradient(circle, rgba(255, 159, 10, 0.06) 0%, rgba(10, 132, 255, 0.08) 50%, transparent 70%)",
          filter: "blur(95px)",
        }}
      />

      {/* Tactile Micro-Grid / Stadium Mesh Overlay */}
      <div className="absolute inset-0 stadium-grid-pattern opacity-[0.22] pointer-events-none" />

      {/* Peripheral Vignette for High Contrast Legibility */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          background: "radial-gradient(ellipse at 50% 40%, transparent 35%, rgba(4, 6, 10, 0.65) 75%, rgba(4, 6, 10, 0.95) 100%)",
        }}
      />
    </div>
  );
};
