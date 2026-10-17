import React, { useEffect, useLayoutEffect, useState, useRef, useCallback } from 'react';
import styled, { keyframes } from 'styled-components';
import { useGame } from '../context/GameContext';
import { useNavigate } from 'react-router-dom';
import { collisionManager } from '../utils/CollisionManager';
import { spawnManager } from '../utils/SpawnManager';
import { locationManager } from '../utils/LocationManager';
import QuestDialog from '../components/QuestDialog';
import SaveLoadMenu from '../components/SaveLoadMenu';
import PauseMenu from '../components/PauseMenu';
import BattleDialog from '../components/BattleDialog';

// Constants
const MAP_DIMENSIONS = {
  width: 2048,
  height: 1639
};

const VIEWPORT_ZOOM = 4.5;
const CHARACTER_WIDTH = 18;
const CHARACTER_HEIGHT = 24;
const MAP_PADDING = 40;
const SPRINT_COOLDOWN = 3000; // 3 seconds cooldown
const STAMINA_THRESHOLD = 5; // Minimum stamina required to start sprinting
const VIEWPORT_WIDTH = 400;
const VIEWPORT_HEIGHT = 300;

const cameraForPosition = ({ x, y }) => ({
  x: Math.max(0, Math.min(Math.floor(x - VIEWPORT_WIDTH / 2), MAP_DIMENSIONS.width - VIEWPORT_WIDTH)),
  y: Math.max(0, Math.min(Math.floor(y - VIEWPORT_HEIGHT / 2), MAP_DIMENSIONS.height - VIEWPORT_HEIGHT))
});

// Add these constants
const FIXED_TIMESTEP = 1000 / 60; // 60 FPS
const MAX_FRAME_TIME = 250; // Maximum time between frames (ms)
const BASE_MOVEMENT_SPEED = 2; // Base movement speed

const SPEED_MULTIPLIERS = {
  walk: 2,
  run: {
    normal: 2.75,
    fast: 3.5
  }
};

const VIEWPORT_PADDING = {
  left: VIEWPORT_WIDTH / 2,
  right: VIEWPORT_WIDTH / 2,
  top: VIEWPORT_HEIGHT / 2,
  bottom: VIEWPORT_HEIGHT / 2
};

const MOVEMENT_SMOOTHING = 0.08; // Much lower for smoother movement
const MIN_MOVEMENT_THRESHOLD = 0.01; // Minimum movement distance

const GameContainer = styled.div`
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  position: relative;
  overflow: hidden;
  display: flex;
  justify-content: flex-end;
`;

const CloseButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(139, 69, 19, 0.2);
  border: 1px solid #8b4513;
  color: #d4af37;
  font-size: 24px;
  cursor: pointer;
  z-index: 11;
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);

  &:hover {
    background: rgba(212, 175, 55, 0.2);
    border-color: #d4af37;
    transform: scale(1.1) rotate(90deg);
  }

  &:active {
    transform: scale(0.95) rotate(90deg);
  }
`;

const WorldContainer = styled.div`
  width: 100%;
  height: 100vh;
  height: 100dvh;
  position: relative;
  overflow: hidden;
  background: #1a0f2b;
  display: flex;
  flex-direction: column;
`;

const Header = styled.div`
  width: 100%;
  height: 60px;
  flex-shrink: 0;
  padding: 0 12px;
  overflow: hidden;
  background: #2c1810;
  border-bottom: 2px solid #8b4513;
  color: #ffd700;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  box-sizing: border-box;
  font-size: clamp(18px, 4vw, 24px);
  font-weight: bold;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  font-family: 'MedievalSharp', cursive;
`;

const BattleLaunchButton = styled.button`
  min-height: 44px;
  padding: 8px 16px;
  flex-shrink: 0;
  border: 1px solid #d4af37;
  border-radius: 5px;
  background: #533023;
  color: #ffe5a0;
  font: bold 15px Georgia, serif;
  cursor: pointer;
  &:hover { background: #71432d; }
  &:focus-visible { outline: 3px solid #8fd3df; outline-offset: 2px; }
  &:disabled { opacity: .5; cursor: default; }
`;

const GameArea = styled.div`
  position: relative;
  width: 100%;
  flex: 1;
  min-height: 0;
  display: flex;
  background: #1a0f2b;

  @media (max-width: 768px) {
    flex-direction: column;
  }

  @media (min-width: 480px) and (max-height: 480px) {
    flex-direction: row;
  }
`;

const MapFrame = styled.div`
  position: relative;
  flex: 1;
  min-width: 0;
  min-height: 0;
  background: #2c1810;
  border-right: 2px solid #8b4513;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 12px;
  overflow: hidden;
  /* Focus/scrollIntoView must not pan this clipped presentation container. */
  overflow: clip;

  @media (max-width: 768px) {
    width: 100%;
    border-right: none;
    border-bottom: 2px solid #8b4513;
    padding: 8px;
  }

  @media (min-width: 480px) and (max-height: 480px) {
    border-bottom: none;
    border-right: 2px solid #8b4513;
  }
`;

const GameplayContainer = styled.div.attrs(props => ({
  style: { transform: `scale(${props.$scale})` }
}))`
  width: ${VIEWPORT_WIDTH}px;
  height: ${VIEWPORT_HEIGHT}px;
  flex-shrink: 0;
  outline: 2px solid #8b4513;
  outline-offset: -2px;
  position: relative;
  overflow: hidden;
  background: #2c1810;
  display: flex;
  align-items: center;
  justify-content: center;
  transform-origin: center;
`;

const ViewportContainer = styled.div`
  position: relative;
  width: 400px;
  height: 300px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const ViewportFrame = styled.div`
  position: relative;
  width: 400px;
  height: 300px;
  overflow: hidden;
`;

const MapContainer = styled.div`
  position: relative;
  width: ${MAP_DIMENSIONS.width}px;
  height: ${MAP_DIMENSIONS.height}px;
  overflow: visible;
`;

const Map = styled.div.attrs(props => ({
  style: {
    transform: `translate3d(${Math.floor(-props.$cameraX)}px, ${Math.floor(-props.$cameraY)}px, 0)`
  }
}))`
  position: absolute;
  width: ${MAP_DIMENSIONS.width}px;
  height: ${MAP_DIMENSIONS.height}px;
  background-size: contain;
  background-repeat: no-repeat;
  background-position: center;
  transform-origin: center;
  will-change: transform;
  image-rendering: pixelated;
  pointer-events: none;
`;

const DayNightOverlay = styled.div.attrs(props => ({
  style: {
    opacity: props.$isNight ? 1 : 0
  }
}))`
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-size: cover;
  background-repeat: no-repeat;
  background-position: center;
  transition: opacity 2s ease-in-out;
  z-index: 1;
  pointer-events: none;
`;

const Character = styled.div.attrs(props => ({
  style: {
    left: `${Math.floor(props.x)}px`,
    top: `${Math.floor(props.y)}px`
  }
}))`
  position: absolute;
  width: ${CHARACTER_WIDTH}px;
  height: ${CHARACTER_HEIGHT}px;
  background-size: 100% 100%;
  background-repeat: no-repeat;
  background-position: center;
  image-rendering: pixelated;
  z-index: 2;
  transform: translate3d(0, 0, 0);
  will-change: transform;
`;

const UIContainer = styled.div`
  width: clamp(220px, 22vw, 300px);
  flex-shrink: 0;
  min-height: 0;
  background: #2c1810;
  border-left: 2px solid #8b4513;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow-y: auto;

  @media (max-width: 768px) {
    width: 100%;
    padding: 8px;
    padding-bottom: max(8px, env(safe-area-inset-bottom));
    gap: 8px;
    border-left: none;
    border-top: 2px solid #8b4513;
    overflow-x: hidden;
    max-height: 60%;
  }

  @media (min-width: 480px) and (max-height: 480px) {
    width: clamp(268px, 32vw, 300px);
    max-height: none;
    padding: 6px;
    gap: 6px;
    border-top: none;
    border-left: 2px solid #8b4513;
  }
`;

const ContainerShown = styled.div`
  width: min(420px, calc(100% - 20px));
  position: absolute;
  right: 10px;
  top: 10px;
  bottom: 10px;
  z-index: 10;
  display: ${props => props.$isVisible ? 'flex' : 'none'};
  flex-direction: column;
  gap: 10px;
  padding: 8px;
  background: rgba(44, 24, 16, 0.95);
  border: 2px solid #8b4513;
  min-height: 0;

  @media (max-width: 768px) {
    width: auto;
    left: 8px;
    right: 8px;
    top: 8px;
    bottom: 8px;
  }
`;

const MenuPanel = styled.div.attrs(props => ({
  style: {
    transform: `translateX(${props.$isVisible ? '0' : '100%'}) scale(${props.$isVisible ? '1' : '0.95'})`,
    opacity: props.$isVisible ? '1' : '0',
    flex: props.$isStacked ? '1 1 0' : '1',
    minHeight: 0
  }
}))`
  background: #2c1810;
  border: 2px solid #8b4513;
  border-radius: 8px;
  padding: 20px;
  box-sizing: border-box;
  overflow-y: auto;
  overscroll-behavior: contain;
  overflow-wrap: anywhere;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  position: relative;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.3);
  
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    border: 1px solid rgba(212, 175, 55, 0.3);
    border-radius: 6px;
    pointer-events: none;
  }

  /* Styling the scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(139, 69, 19, 0.1);
    border-radius: 4px;
    margin: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #8b4513;
    border-radius: 4px;
    border: 2px solid #2c1810;
    
    &:hover {
      background: #d4af37;
    }
  }

  @media (max-width: 768px) {
    padding: 15px;
  }

  @media (max-width: 480px) {
    padding: 10px;
  }
`;

const StatsPanel = styled.div`
  position: relative;
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid #8b4513;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;

  @media (max-width: 768px) {
    min-width: 0;
    max-width: none;
    margin-top: 0;
    padding: 6px;
    gap: 8px;
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    align-items: center;
    font-size: 12px;
    flex-shrink: 0;
  }

  @media (min-width: 480px) and (max-height: 480px) {
    display: grid;
    grid-template-columns: 45px repeat(3, minmax(0, 1fr));
    width: 100%;
    min-width: 0;
    max-width: none;
    margin-top: 0;
    padding: 6px;
    gap: 4px;
    font-size: 10px;
    flex-shrink: 0;
  }

  > div {
    display: flex;
    flex-direction: column;
    gap: 8px;

    > div:first-child {
      color: #ffd700;
      font-size: clamp(12px, 2vw, 16px);
      text-align: left;
      text-shadow: 2px 2px 2px rgba(0, 0, 0, 0.5);
    }
  }

  @media (min-width: 480px) and (max-height: 480px) {
    > div > div:first-child {
      font-size: 11px;
      line-height: 1.2;
    }
  }
`;

const DetailedStatsPanel = styled.div`
  position: absolute;
  top: 0;
  right: 0;
  width: 20%;
  height: 100%;
  background: #2c1810;
  border-left: 2px solid #8b4513;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  box-sizing: border-box;
  overflow-y: auto;
  z-index: 100;
  transform: ${props => props.$show ? 'translateX(0)' : 'translateX(100%)'};
  transition: transform 0.3s ease-in-out;

  /* Styling the scrollbar */
  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(139, 69, 19, 0.1);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #8b4513;
    border-radius: 4px;
    
    &:hover {
      background: #a25616;
    }
  }
`;

const StatRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: rgba(139, 69, 19, 0.2);
  border: 1px solid #8b4513;
  border-radius: 6px;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(139, 69, 19, 0.3);
    transform: translateX(5px);
  }
`;

const StatLabel = styled.div`
  font-size: 16px;
  color: #ffd700;
  font-weight: bold;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
`;

const StatValue = styled.div`
  font-size: 16px;
  color: #fff;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
`;

const CloseStatsButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: none;
  border: none;
  color: #ffd700;
  font-size: 24px;
  cursor: pointer;
  padding: 5px;
  
  &:hover {
    color: #fff;
  }
`;

const EquipmentSection = styled.div`
  padding: 15px;
  background: rgba(44, 24, 16, 0.6);
  border: 1px solid #8b4513;
  border-radius: 8px;
`;

const EquipmentTitle = styled.h3`
  color: #ffd700;
  font-size: 18px;
  margin: 0 0 15px 0;
  text-align: center;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  letter-spacing: 1px;
  border-bottom: 1px solid #8b4513;
  padding-bottom: 10px;
`;

const EquipmentRow = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 15px;
  background: rgba(139, 69, 19, 0.2);
  border: 1px solid #8b4513;
  border-radius: 6px;
  margin-bottom: 10px;
  transition: all 0.2s ease;

  &:last-child {
    margin-bottom: 0;
  }

  &:hover {
    background: rgba(139, 69, 19, 0.3);
    transform: translateX(5px);
  }

  span:first-child {
    color: #d4af37;
    font-weight: bold;
  }

  span:last-child {
    color: #fff;
  }
`;

const ControlsPanel = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  align-items: center;

  @media (max-width: 768px) {
    flex-direction: row;
    justify-content: space-between;
    width: 100%;
    min-width: 0;
    gap: 8px;
    padding: 0;
  }

  @media (min-width: 480px) and (max-height: 480px) {
    flex-direction: row;
    width: 100%;
    padding: 0;
    gap: 6px;
  }
`;

const MovementDPadContainer = styled.div`
  position: relative;
  width: 160px;  // Increased from 140px
  height: 160px; // Increased from 140px
  margin: 12px auto 0;
  padding: 10px;
  background: rgba(44, 24, 16, 0.8);
  clip-path: polygon(
    33% 0%,
    67% 0%,
    67% 33%,
    100% 33%,
    100% 67%,
    67% 67%,
    67% 100%,
    33% 100%,
    33% 67%,
    0% 67%,
    0% 33%,
    33% 33%
  );
  border-radius: 4px;
  box-shadow: 
    0 0 0 2px #8b4513,
    inset 0 0 20px rgba(0, 0, 0, 0.3);

  @media (max-width: 768px) {
    width: 152px;
    height: 152px;
    flex-shrink: 0;
    margin: 0; // Reset margin for mobile
  }

  @media (max-width: 480px) {
    width: 152px;
    height: 152px;
  }

  @media (min-width: 480px) and (max-height: 480px) {
    width: 152px;
    height: 152px;
    flex-shrink: 0;
    margin: 0;
  }
`;

const MovementDPadButton = styled.button`
  position: absolute;
  width: 45px;  // Increased from original size
  height: 45px; // Increased from original size
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(139, 69, 19, 0.2);
  border: 2px solid #8b4513;
  color: #ffd700;
  font-size: 24px; // Slightly increased font size
  cursor: pointer;
  touch-action: none;
  user-select: none;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(139, 69, 19, 0.4);
    transform: scale(1.1);
  }

  &:active {
    background: rgba(139, 69, 19, 0.6);
    transform: scale(0.95);
  }

  &.up {
    top: 10px;
    left: 50%;
    transform: translateX(-50%);
  }

  &.down {
    bottom: 10px;
    left: 50%;
    transform: translateX(-50%);
  }

  &.left {
    left: 10px;
    top: 50%;
    transform: translateY(-50%);
  }

  &.right {
    right: 10px;
    top: 50%;
    transform: translateY(-50%);
  }

  @media (max-width: 768px) {
    width: 44px;
    height: 44px;
    font-size: 20px;
  }

  @media (max-width: 480px) {
    width: 44px;
    height: 44px;
    font-size: 18px;
  }

  @media (min-width: 480px) and (max-height: 480px) {
    width: 44px;
    height: 44px;
    font-size: 20px;
  }
`;

const DPadCenter = styled.div`
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: 30px;
  height: 30px;
  background: linear-gradient(
    45deg,
    rgba(139, 69, 19, 0.6),
    rgba(139, 69, 19, 0.3)
  );
  border: 2px solid #8b4513;
  border-radius: 50%;
  box-shadow: inset 0 0 10px rgba(0, 0, 0, 0.3);

  &:before {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    width: 10px;
    height: 10px;
    background: #d4af37;
    border-radius: 50%;
    box-shadow: 0 0 5px rgba(212, 175, 55, 0.5);
  }
`;

const ActionButtonGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
  margin-top: 6px;

  @media (max-width: 768px) {
    grid-template-columns: repeat(3, minmax(0, 1fr));
    width: 156px;
    min-width: 144px;
    gap: 6px;
    margin-top: 0;
    align-items: start;
  }

  @media (max-width: 480px) {
    width: 144px;
    gap: 5px;
  }

  @media (min-width: 480px) and (max-height: 480px) {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    width: 96px;
    min-width: 96px;
    gap: 6px;
    margin-top: 0;
  }
`;

const ActionButtonWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;

  @media (max-width: 768px) {
    gap: 2px;
  }
`;

const CooldownOverlay = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: ${props => props.$progress}%;
  background-color: rgba(255, 0, 0, 0.3);
  pointer-events: none;
  transition: height 0.05s linear;
  border-radius: 6px;
  overflow: hidden;
`;

const ActionButton = styled.button`
  position: relative;
  background: linear-gradient(to bottom, #8b4513, #5c2d0e);
  border: 2px solid #ffd700;
  color: #ffd700;
  font-size: 16px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  transition: all 0.2s ease;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  min-width: 44px;
  min-height: 44px;
  padding: 8px;
  overflow: hidden;

  &:hover {
    background: linear-gradient(to bottom, #a25616, #6d3610);
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
  }

  &:active {
    transform: scale(0.95);
    background: linear-gradient(to bottom, #5c2d0e, #3d1e09);
  }

  &:disabled {
    background: #2c1810;
    border-color: #5c2d0e;
    cursor: default;
  }

  &.active {
    background: linear-gradient(to bottom, #d4af37, #aa8c2c);
    border-color: #ffd700;
    color: #2c1810;
  }

  @media (max-width: 768px) {
    min-width: 44px;
    min-height: 44px;
    padding: 6px;
    font-size: 14px;
  }

  @media (max-width: 480px) {
    min-width: 44px;
    min-height: 44px;
    padding: 4px;
    font-size: 12px;
  }
`;

const ButtonLabel = styled.div`
  color: #d4af37;
  font-size: 12px;
  text-align: center;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);

  @media (max-width: 768px) {
    font-size: 10px;
  }

  @media (max-width: 480px) {
    font-size: 9px;
  }

  @media (min-width: 480px) and (max-height: 480px) {
    display: none;
  }
`;

const StatBar = styled.div`
  width: 100%;
  height: clamp(12px, 3vh, 20px);
  background: rgba(0, 0, 0, 0.4);
  border: 1px solid #8b4513;
  border-radius: 10px;
  overflow: hidden;
  position: relative;

  @media (min-width: 480px) and (max-height: 480px) {
    height: 10px;
  }

  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: ${props => props.value}%;
    background: ${props => props.color};
    transition: width 0.3s ease;
    box-shadow: 0 0 10px ${props => props.color};
  }
`;

const TimeDisplay = styled.div`
  color: #ffd700;
  font-size: clamp(16px, 3vw, 24px);
  text-align: center;
  margin-bottom: 10px;
  font-family: 'MedievalSharp', cursive;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  padding: 6px;
  background: rgba(0, 0, 0, 0.2);
  border-radius: 8px;
  border: 1px solid #8b4513;

  @media (max-width: 768px) {
    margin-bottom: 0;
    padding: 4px;
    font-size: 14px;
  }

  @media (min-width: 480px) and (max-height: 480px) {
    font-size: 10px;
    margin-bottom: 0;
    padding: 2px;
  }
`;

const ActionButtons = styled.div`
  position: absolute;
  right: 20px;
  bottom: 20px;
  display: grid;
  grid-template: repeat(2, 1fr) / repeat(2, 1fr);
  gap: 10px;
  z-index: 3;
`;

// Update animation configuration for more stable timing
const ANIMATION_CONFIG = {
  idle: { frames: 2, frameTime: 500 },
  walk: { frames: 9, frameTime: 150 },  // Increased frameTime for more stable walk
  run: { frames: 8, frameTime: 120 }    // Increased frameTime for more stable run
};

const DIRECTION_MAP = {
  up: 1,
  left: 3,
  down: 5,
  right: 7
};

const IDLE_FRAMES = {
  up: [1, 2],
  left: [3, 4],
  down: [5, 6],
  right: [7, 8]
};

const WALK_FRAMES = {
  up: [1, 2, 3, 4, 5, 6, 7, 8, 9],
  left: [10, 11, 12, 13, 14, 15, 16, 17, 18],
  down: [19, 20, 21, 22, 23, 24, 25, 26, 27],
  right: [28, 29, 30, 31, 32, 33, 34, 35, 36]
};

const RUN_FRAMES = {
  up: [1, 2, 3, 4, 5, 6, 7, 8],       // run1-8 for up
  left: [9, 10, 11, 12, 13, 14, 15, 16],   // run9-16 for left
  down: [17, 18, 19, 20, 21, 22, 23, 24],  // run17-24 for down
  right: [25, 26, 27, 28, 29, 30, 31, 32]  // run25-32 for right
};

const LONG_IDLE_FRAMES = {
  up: 1,      // sit1.png for up
  left: 2,    // sit2.png for left
  down: 3,    // sit3.png for down
  right: 4    // sit4.png for right
};

const IDLE_TIMEOUT = 6000; // 6 seconds

const PauseOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background-color: rgba(0, 0, 0, 0.7);
  z-index: 998;
`;



const InventoryPanel = styled.div`
  position: relative;
  width: 100%;
  background: rgba(0, 0, 0, 0.3);
  border: 2px solid #8b4513;
  border-radius: 8px;
  padding: 12px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  margin-top: 10px;
`;

const InventoryGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, 40px);
  justify-content: center;
  width: 100%;
  max-width: 210px;
  gap: 8px;
  padding: 8px;
  background: rgba(44, 24, 16, 0.6);
  border: 1px solid #8b4513;
  border-radius: 6px;
  margin: 0 auto;

  @media (max-width: 768px) {
    max-width: 306px;
  }

  @media (max-width: 480px) {
    grid-template-columns: repeat(auto-fit, 35px);
    max-width: 177px;
    gap: 5px;
  }
`;

const InventorySlot = styled.div`
  width: 40px;
  height: 40px;
  background: rgba(139, 69, 19, 0.2);
  border: 2px solid #3d1e09;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  cursor: pointer;
  transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  
  &:hover {
    background: rgba(139, 69, 19, 0.4);
    border-color: #ffd700;
    transform: translateY(-2px);
    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
  }

  &:active {
    transform: translateY(0);
  }

  img {
    max-width: 32px;
    max-height: 32px;
    image-rendering: pixelated;
    transition: transform 0.2s ease;
  }

  &:hover img {
    transform: scale(1.1);
  }

  @media (max-width: 480px) {
    width: 35px;
    height: 35px;

    img {
      max-width: 28px;
      max-height: 28px;
    }
  }
`;

const ItemCount = styled.div`
  position: absolute;
  bottom: 2px;
  right: 2px;
  font-size: 12px;
  color: #ffffff;
  text-shadow: 1px 1px 1px rgba(0, 0, 0, 0.8);
  font-weight: bold;
`;

const DurabilityBar = styled.div`
  position: absolute;
  bottom: 0;
  left: 0;
  width: 100%;
  height: 2px;
  background: rgba(0, 0, 0, 0.5);
  
  &::after {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    height: 100%;
    width: ${props => props.$durability}%;
    background: ${props => {
      if (props.$durability > 66) return '#44ff44';
      if (props.$durability > 33) return '#ffaa44';
      return '#ff4444';
    }};
  }
`;

const ItemTooltip = styled.div`
  position: absolute;
  bottom: 100%;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(44, 24, 16, 0.95);
  border: 1px solid #8b4513;
  padding: 5px 8px;
  border-radius: 4px;
  font-size: 12px;
  color: #ffffff;
  white-space: nowrap;
  pointer-events: none;
  opacity: 0;
  transition: opacity 0.2s ease;
  z-index: 1000;

  ${InventorySlot}:hover & {
    opacity: 1;
  }
`;

const ArmorAndPlayerSection = styled.div`
  display: flex;
  gap: 10px;
  justify-content: center;
  margin-bottom: 15px;
  padding: 10px;
  background: rgba(139, 69, 19, 0.1);
  border-radius: 8px;
  border: 1px solid rgba(139, 69, 19, 0.3);
`;

const ArmorGrid = styled.div`
  display: grid;
  grid-template-rows: repeat(4, 40px);
  gap: 8px;
  padding: 8px;
  background: rgba(44, 24, 16, 0.6);
  border: 1px solid #8b4513;
  border-radius: 6px;
  width: 56px;
`;

const PlayerPreview = styled.div`
  width: 117px;
  height: 175.5px;
  background: rgba(44, 24, 16, 0.6);
  border: 1px solid #8b4513;
  border-radius: 6px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  overflow: hidden;
  
  &:before {
    content: '';
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: radial-gradient(
      circle at center,
      transparent 30%,
      rgba(44, 24, 16, 0.4) 100%
    );
    pointer-events: none;
  }
  
  img {
    height: 138px;
    width: auto;
    image-rendering: pixelated;
    filter: drop-shadow(0 2px 4px rgba(0, 0, 0, 0.3));
  }
`;

const InventoryTitle = styled.div`
  color: #d4af37;
  font-size: 18px;
  text-align: center;
  margin-bottom: 15px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  font-weight: bold;
  position: relative;
  padding-bottom: 10px;

  &:after {
    content: '';
    position: absolute;
    bottom: 0;
    left: 25%;
    width: 50%;
    height: 2px;
    background: linear-gradient(
      to right,
      transparent,
      #8b4513,
      #d4af37,
      #8b4513,
      transparent
    );
  }
`;

const ToggleButton = styled.button`
  position: absolute;
  top: 10px;
  left: 10px;
  background: #2c1810;
  color: #ffd700;
  border: 2px solid #8b4513;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-family: 'MedievalSharp', cursive;
  z-index: 100;
  transition: all 0.2s ease;

  &:hover {
    background: #3d2315;
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
  }

  &.active {
    background: #8b4513;
    border-color: #ffd700;
  }
`;

const MapPopup = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  width: min(867.2px, calc(100vw - 24px), calc((100vh - 64px) * ${MAP_DIMENSIONS.width / MAP_DIMENSIONS.height} + 40px));
  width: min(867.2px, calc(100vw - 24px), calc((100dvh - 64px) * ${MAP_DIMENSIONS.width / MAP_DIMENSIONS.height} + 40px));
  background: #2c1810;
  border: 4px solid #8b4513;
  z-index: 1100;
  display: ${props => props.$show ? 'flex' : 'none'};
  flex-direction: column;
  align-items: center;
  padding: 16px;
  box-shadow: 0 0 30px rgba(0, 0, 0, 0.7);

  .map-container {
    position: relative;
    width: 100%;
    aspect-ratio: ${MAP_DIMENSIONS.width} / ${MAP_DIMENSIONS.height};
  }

  img {
    position: absolute;
    inset: 0;
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
`;

const PlayerLocationMarker = styled.div.attrs(props => ({
  style: {
    left: `${props.$x / MAP_DIMENSIONS.width * 100}%`,
    top: `${props.$y / MAP_DIMENSIONS.height * 100}%`
  }
}))`
  position: absolute;
  width: 8px;
  height: 8px;
  background: #ff0000;
  border-radius: 50%;
  border: 2px solid #ffffff;
  transform: translate(-50%, -50%);
  z-index: 1100;
  box-shadow: 0 0 4px rgba(0, 0, 0, 0.5);
`;

const CloseMapButton = styled.button`
  position: absolute;
  top: 10px;
  right: 10px;
  background: rgba(44, 24, 16, 0.9);
  border: 2px solid #8b4513;
  border-radius: 50%;
  color: #ffd700;
  font-size: 24px;
  cursor: pointer;
  padding: 0;
  width: 36px;
  height: 36px;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1101;
  transition: all 0.2s ease;
  box-shadow: 0 0 10px rgba(0, 0, 0, 0.5);
  
  &:hover {
    background: #8b4513;
    color: #fff;
    transform: scale(1.1);
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.3);
  }

  &:active {
    transform: scale(0.95);
  }
`;

const MapOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(5px);
  z-index: 1099;
  display: ${props => props.$show ? 'block' : 'none'};
`;

// Update collision constants
const COLLISION_OFFSET = {
  x: 6,  // Center the collision box (18px sprite width - 6px collision width) / 2
  y: 20  // Position at character's feet (24px height - 4px collision height)
};

const CHARACTER_COLLISION_BOX = {
  width: 6,   // Small area for feet
  height: 4   // Very small height for just the feet area
};

// Update debug box to be more visible
const CollisionDebugBox = styled.div.attrs(props => ({
  style: {
    left: `${props.x}px`,
    top: `${props.y}px`
  }
}))`
  position: absolute;
  width: ${CHARACTER_COLLISION_BOX.width}px;
  height: ${CHARACTER_COLLISION_BOX.height}px;
  border: 1px solid #ff0000;
  background: rgba(255, 0, 0, 0.3);
  pointer-events: none;
  z-index: 1000;
`;

// Add this after other styled components
const LocationNotification = styled.div`
  position: absolute;
  top: 20px;
  left: 50%;
  transform: translateX(-50%);
  background: rgba(44, 24, 16, 0.9);
  border: 2px solid #8b4513;
  padding: 10px 20px;
  max-width: calc(100% - 24px);
  color: #ffd700;
  border-radius: 8px;
  font-family: 'MedievalSharp', cursive;
  font-size: 18px;
  z-index: 5;
  opacity: ${props => props.$show ? 1 : 0};
  transition: opacity 0.3s ease-in-out;
  pointer-events: none;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
`;

const CharacterHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 15px;
  background: rgba(44, 24, 16, 0.6);
  border: 1px solid #8b4513;
  border-radius: 8px;
  margin-bottom: 20px;
`;

const CharacterTitle = styled.h2`
  color: #ffd700;
  font-size: 24px;
  margin: 0;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  letter-spacing: 1px;
`;

const CharacterSubtitle = styled.h3`
  color: #d4af37;
  font-size: 18px;
  margin: 5px 0 0 0;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  font-style: italic;
`;

const CharacterStatsSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 15px;
  padding: 15px;
  background: rgba(44, 24, 16, 0.6);
  border: 1px solid #8b4513;
  border-radius: 8px;
  margin-bottom: 20px;
`;

const RelicSection = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 15px;
  background: rgba(44, 24, 16, 0.6);
  border: 1px solid #8b4513;
  border-radius: 8px;
  margin-bottom: 20px;
`;

const RelicTitle = styled.h3`
  color: #ffd700;
  font-size: 18px;
  margin: 0 0 10px 0;
  text-align: center;
  text-shadow: 1px 1px 2px rgba(0, 0, 0, 0.5);
  letter-spacing: 1px;
  border-bottom: 1px solid #8b4513;
  padding-bottom: 10px;
`;

const RelicContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 10px;
  padding: 5px;
`;

const RelicBox = styled.div`
  flex-shrink: 0;
  width: 30px;
  height: 30px;
  background: ${props => props.$obtained ? 'rgba(255, 215, 0, 0.3)' : 'rgba(139, 69, 19, 0.2)'};
  border: 2px solid ${props => props.$obtained ? '#ffd700' : '#8b4513'};
  border-radius: 4px;
  transition: all 0.3s ease;
  box-shadow: ${props => props.$obtained ? '0 0 10px rgba(255, 215, 0, 0.3)' : 'none'};
  
  &:hover {
    transform: scale(1.1);
    box-shadow: 0 0 15px rgba(255, 215, 0, 0.2);
  }
`;

const VisitMenuOverlay = styled.div`
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  height: 100dvh;
  background: rgba(0, 0, 0, 0.7);
  backdrop-filter: blur(3px);
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const VisitMenu = styled.div`
  width: min(600px, calc(100vw - 24px));
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  background: #2c1810;
  border: 3px solid #8b4513;
  border-radius: 15px;
  padding: 20px;
  color: #ffd700;
  position: relative;
`;

const VisitMenuTitle = styled.h2`
  text-align: center;
  color: #ffd700;
  font-size: 24px;
  margin-bottom: 20px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
  border-bottom: 2px solid #8b4513;
  padding-bottom: 10px;
`;

const VisitMenuDescription = styled.p`
  color: #d4af37;
  font-size: 16px;
  margin-bottom: 20px;
  text-align: center;
  font-style: italic;
`;

const VisitOptionList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 400px;
  overflow-y: auto;
  padding-right: 10px;

  &::-webkit-scrollbar {
    width: 8px;
  }

  &::-webkit-scrollbar-track {
    background: rgba(139, 69, 19, 0.1);
    border-radius: 4px;
  }

  &::-webkit-scrollbar-thumb {
    background: #8b4513;
    border-radius: 4px;
    
    &:hover {
      background: #d4af37;
    }
  }
`;

const VisitOption = styled.button`
  background: rgba(139, 69, 19, 0.2);
  border: 1px solid #8b4513;
  border-radius: 8px;
  padding: 15px;
  color: #ffd700;
  text-align: left;
  transition: all 0.2s ease;
  display: flex;
  flex-wrap: wrap;
  min-width: 0;
  align-items: center;
  gap: 10px;

  &:hover {
    background: rgba(139, 69, 19, 0.4);
    transform: translateX(5px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    &:hover {
      transform: none;
    }
  }
`;

const VisitOptionIcon = styled.span`
  font-size: 20px;
  min-width: 24px;
  text-align: center;
`;

const ItemPopup = styled.div`
  position: absolute;
  bottom: calc(100% + 5px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(44, 24, 16, 0.95);
  border: 1px solid #8b4513;
  border-radius: 4px;
  padding: 5px;
  display: flex;
  flex-direction: column;
  gap: 5px;
  z-index: 1001;
`;

const PopupButton = styled.button`
  background: rgba(139, 69, 19, 0.2);
  border: 1px solid #8b4513;
  color: #ffd700;
  padding: 4px 8px;
  cursor: pointer;
  transition: all 0.2s ease;

  &:hover {
    background: rgba(139, 69, 19, 0.4);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

const GameCompletionPopup = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(44, 24, 16, 0.95);
  border: 4px solid #ffd700;
  padding: 30px;
  border-radius: 15px;
  color: #ffd700;
  text-align: center;
  z-index: 2000;
  box-shadow: 0 0 50px rgba(255, 215, 0, 0.3);
  max-width: 600px;
  width: 90%;
  max-height: calc(100vh - 24px);
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  overscroll-behavior: contain;
`;

const GameCompletionTitle = styled.h2`
  font-size: 32px;
  margin-bottom: 20px;
  text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
`;

const GameCompletionText = styled.p`
  font-size: 18px;
  margin-bottom: 15px;
  color: #d4af37;
  line-height: 1.6;
`;

const GameCompletionButton = styled.button`
  background: rgba(139, 69, 19, 0.3);
  border: 2px solid #ffd700;
  color: #ffd700;
  padding: 10px 20px;
  font-size: 18px;
  cursor: pointer;
  margin-top: 20px;
  transition: all 0.3s ease;
  border-radius: 5px;

  &:hover {
    background: rgba(139, 69, 19, 0.5);
    transform: scale(1.05);
  }
`;

const World = () => {
  const { selectedCharacter, characterStats, setCharacterStats, playerName, clearGameData } = useGame();
  const navigate = useNavigate();
  
  // Change initial position to null
  const [position, setPosition] = useState(null);
  const [direction, setDirection] = useState('down');
  const [movement, setMovement] = useState('idle');
  const [frame, setFrame] = useState(0);
  const [isRunning, setIsRunning] = useState(false);
  const [currentStats, setCurrentStats] = useState({
    ...characterStats,
    defense: characterStats.armor,
    maxHp: characterStats.maxHp ?? characterStats.hp
  });
  const [useSecondFrame, setUseSecondFrame] = useState(false);
  const [walkFrame, setWalkFrame] = useState(0);
  const [runFrame, setRunFrame] = useState(0);
  const [gameTime, setGameTime] = useState({ hours: 6, minutes: 0 });
  
  // Add baseStats state
  const [baseStats, setBaseStats] = useState({
    ...characterStats,
    defense: characterStats.armor,
    maxHp: characterStats.maxHp ?? characterStats.hp
  });
  
  // Add equipmentBonuses state
  const [equipmentBonuses, setEquipmentBonuses] = useState({
    damage: 0,
    defense: 0,
    hp: 0,
    maxHp: 0
  });

  const [currentStamina, setCurrentStamina] = useState(characterStats.stamina);
  const [currentHunger, setCurrentHunger] = useState(characterStats.hunger);
  const [showInventory, setShowInventory] = useState(false);
  const [isNight, setIsNight] = useState(false);
  const [isSprintCooldown, setIsSprintCooldown] = useState(false);
  const [cooldownProgress, setCooldownProgress] = useState(0);
  const [showMap, setShowMap] = useState(false);
  const [containerContent, setContainerContent] = useState('');
  const [showDebug, setShowDebug] = useState(false);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [loadedSprites, setLoadedSprites] = useState(new Set());
  const [isLongIdle, setIsLongIdle] = useState(false);
  const [playerGold, setPlayerGold] = useState(1000); // Add initial gold amount
  const [inventory, setInventory] = useState({
    main: Array(16).fill(null).map(() => ({
      id: null,
      name: null,
      icon: null,
      count: 0,
      durability: 100,
      type: null
    })),
    armor: Array(4).fill(null).map(() => ({
      id: null,
      name: null,
      icon: null,
      durability: 100,
      type: null
    }))
  });
  const [cameraPosition, setCameraPosition] = useState({ x: 0, y: 0 });
  const [mapPosition, setMapPosition] = useState({ x: -50, y: -50 });
  const [obtainedRelics, setObtainedRelics] = useState(Array(8).fill(false));
  const [showVisitMenu, setShowVisitMenu] = useState(false);
  const [showShop, setShowShop] = useState(false);
  const [currentShop, setCurrentShop] = useState('');
  const [showLodge, setShowLodge] = useState(false);
  const [showDialog, setShowDialog] = useState(false);
  const [dialogContent, setDialogContent] = useState(null);
  const [purchaseInProgress, setPurchaseInProgress] = useState(false);
  const [purchaseMessage, setPurchaseMessage] = useState('');
  const [showQuest, setShowQuest] = useState(false);

  // Add loading state
  const [isLoading, setIsLoading] = useState(true);

  // Add equipment slots state and selected item state
  const [selectedItem, setSelectedItem] = useState(null);
  const [equipmentSlots, setEquipmentSlots] = useState({
    helmet: null,
    bodyArmor: null,
    weapon: null,
    shield: null
  });

  // Add timeOfDay state
  const [timeOfDay, setTimeOfDay] = useState('day');
  const [isPaused, setIsPaused] = useState(false);
  const [isRunToggled, setIsRunToggled] = useState(false);
  const [showDetailedStats, setShowDetailedStats] = useState(false);

  const [useItemMessage, setUseItemMessage] = useState('');
  const [showGameCompletion, setShowGameCompletion] = useState(false);
  const [showBattle, setShowBattle] = useState(false);
  const [restInProgress, setRestInProgress] = useState(false);
  const [temporaryBonuses, setTemporaryBonuses] = useState({ damage: 0, speed: 0 });
  const temporaryBuffTimers = useRef([]);
  useEffect(() => () => temporaryBuffTimers.current.forEach(clearTimeout), []);
  const [battleProgress, setBattleProgress] = useState({ xp: 0, victories: 0 });
  const previousContextStats = useRef(characterStats);
  const legacyMaxHp = useRef(characterStats.maxHp ?? characterStats.hp);

  // Add new state for save/load menu
  const [showSaveLoadMenu, setShowSaveLoadMenu] = useState(false);

  // Function to check if an item can be equipped in a slot
  const canEquipInSlot = (item, slotName) => {
    if (!item || !item.type) return false;
    
    const slotTypes = {
      helmet: ['helmet'],
      bodyArmor: ['armor'],
      weapon: ['sword', 'weapon'],
      shield: ['shield']
    };
    return slotTypes[slotName]?.includes(item.type);
  };

  // Function to get slot name from index
  const getSlotNameFromIndex = (index) => {
    const slotMap = {
      0: 'helmet',
      1: 'bodyArmor',
      2: 'weapon',
      3: 'shield'
    };
    return slotMap[index];
  };

  // Update the calculateEquipmentBonuses function
  const calculateEquipmentBonuses = (slots) => {
    const bonuses = {
      damage: 0,
      defense: 0,
      hp: 0,
      maxHp: 0
    };

    Object.values(slots).forEach(item => {
      if (item && item.stats) {
        Object.entries(item.stats).forEach(([stat, value]) => {
          switch(stat) {
            case 'damage':
              bonuses.damage += value;
              break;
            case 'defense':
              bonuses.defense += value;
              break;
            case 'hp':
              bonuses.hp += value;
              bonuses.maxHp += value;
              break;
          }
        });
      }
    });

    return bonuses;
  };

  // Function to handle equipping items
  const handleEquipItem = (item, slotName) => {
    if (!item || !slotName) return;

    // Remove item from inventory
    const newInventory = [...inventory.main];
    const itemIndex = newInventory.findIndex(i => i === item);
    if (itemIndex === -1) return;
    
    newInventory[itemIndex] = null;

    // If there was an item in the slot, put it back in inventory
    const oldItem = equipmentSlots[slotName];
    if (oldItem) {
      const emptySlot = newInventory.findIndex(i => !i);
      if (emptySlot !== -1) {
        newInventory[emptySlot] = oldItem;
      }
    }

    // Update equipment slots
    const newEquipmentSlots = {
      ...equipmentSlots,
      [slotName]: item
    };
    setEquipmentSlots(newEquipmentSlots);

    // Update inventory
    setInventory({
      ...inventory,
      main: newInventory
    });

    // Calculate and update bonuses
    const newBonuses = calculateEquipmentBonuses(newEquipmentSlots);
    setEquipmentBonuses(newBonuses);
    
    // Clear selected item
    setSelectedItem(null);
  };

  // Function to handle unequipping items
  const handleUnequipItem = (slotName) => {
    const item = equipmentSlots[slotName];
    if (!item) return;

    // Find empty inventory slot
    const newInventory = [...inventory.main];
    const emptySlot = newInventory.findIndex(i => !i);
    if (emptySlot === -1) return; // Inventory full

    // Move item to inventory
    newInventory[emptySlot] = item;
    setInventory({
      ...inventory,
      main: newInventory
    });

    // Clear equipment slot
    const newEquipmentSlots = {
      ...equipmentSlots,
      [slotName]: null
    };
    setEquipmentSlots(newEquipmentSlots);

    // Recalculate bonuses
    const newBonuses = calculateEquipmentBonuses(newEquipmentSlots);
    setEquipmentBonuses(newBonuses);
    
  };

  // Function to handle discarding items
  const handleDiscardItem = (item) => {
    if (!item) return;
    
    const newInventory = [...inventory.main];
    const itemIndex = newInventory.findIndex(i => i === item);
    if (itemIndex !== -1) {
      newInventory[itemIndex] = null;
      setInventory({
        ...inventory,
        main: newInventory
      });
    }
    setSelectedItem(null);
  };

  // Group all useRef declarations
  const walkTimer = useRef(null);
  const runTimer = useRef(null);
  const gameTimeRef = useRef(null);
  const characterRef = useRef(null);
  const mapRef = useRef(null);
  const keysPressed = useRef({});
  const dPadPointers = useRef(new globalThis.Map());
  const spriteCacheRef = useRef({});
  const lastMovementTime = useRef(Date.now());
  const longIdleTimer = useRef(null);
  const mapFrameRef = useRef(null);
  const [viewportScale, setViewportScale] = useState(1);
  const staminaTimer = useRef(null);
  const hungerTimer = useRef(null);
  const cooldownTimer = useRef(null);
  const gameLoopId = useRef(null);
  const lastFrameTimeRef = useRef(null);
  const isShiftPressed = useRef(false);
  const lastUpdateTime = useRef(0);
  const targetMapPosition = useRef({ x: -50, y: -50 });
  const animationFrameId = useRef(null);
  const accumulator = useRef(0);
  const lastTime = useRef(0);

  const releaseMovement = useCallback(() => {
    keysPressed.current = {};
    isShiftPressed.current = false;
    for (const [pointerId, { target }] of dPadPointers.current) {
      if (target.hasPointerCapture?.(pointerId)) target.releasePointerCapture(pointerId);
    }
    dPadPointers.current.clear();
    setMovement('idle');
  }, []);

  // Constants
  const STAMINA_DRAIN_RATE = 15;
  const STAMINA_REGEN_RATE = 10;
  const HUNGER_DECREASE_RATE = 0.75;
  
  // Add lerp function
  const lerp = (start, end, factor) => {
    if (Math.abs(end - start) < MIN_MOVEMENT_THRESHOLD) {
      return end;
    }
    return start + (end - start) * factor;
  };

  // Separate animation loop for map movement
  useEffect(() => {
    const updateMapPosition = () => {
      if (!position) return; // Add null check

      const targetX = -(position.x - VIEWPORT_WIDTH/2);
      const targetY = -(position.y - VIEWPORT_HEIGHT/2);
      
      targetMapPosition.current = {
        x: targetX,
        y: targetY
      };

      setMapPosition(prev => ({
        x: lerp(prev.x, targetMapPosition.current.x, MOVEMENT_SMOOTHING),
        y: lerp(prev.y, targetMapPosition.current.y, MOVEMENT_SMOOTHING)
      }));

      animationFrameId.current = requestAnimationFrame(updateMapPosition);
    };

    if (!isPaused && !showMap && !showBattle) {
      animationFrameId.current = requestAnimationFrame(updateMapPosition);
    }

    return () => {
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [position, isPaused, showMap, showBattle]);

  // Idle animation timer
  useEffect(() => {
    const timer = setInterval(() => {
      setUseSecondFrame(prev => !prev);
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Optimized preload function
  const preloadSprite = async (path) => {
    if (loadedSprites.has(path)) return spriteCacheRef.current[path];
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        setLoadedSprites(prev => new Set([...prev, path]));
        spriteCacheRef.current[path] = img;
        resolve(img);
      };
      img.onerror = reject;
      img.src = path;
    });
  };

  // Preload all sprites for current state and direction
  const preloadSprites = async (characterClass, state, direction) => {
    if (typeof window === 'undefined') return;

    const getBaseDir = (state) => `/assets/${characterClass}PC/${characterClass}${state.charAt(0).toUpperCase() + state.slice(1)}`;
    const loadPromises = [];

    if (state === 'idle') {
      const baseDir = getBaseDir('idle');
      const [frame1, frame2] = IDLE_FRAMES[direction];
      loadPromises.push(
        preloadSprite(`${baseDir}/idle${frame1}.png`),
        preloadSprite(`${baseDir}/idle${frame2}.png`)
      );
      
      // Also preload sit sprites
      const sitBaseDir = `/assets/${characterClass}PC/${characterClass}Sit`;
      const sitFrame = LONG_IDLE_FRAMES[direction];
      loadPromises.push(preloadSprite(`${sitBaseDir}/sit${sitFrame}.png`));
    } else if (state === 'walk') {
      const baseDir = getBaseDir('walk');
      WALK_FRAMES[direction].forEach(frameNum => {
        loadPromises.push(preloadSprite(`${baseDir}/walk${frameNum}.png`));
      });
    } else if (state === 'run') {
      const baseDir = getBaseDir('run');
      RUN_FRAMES[direction].forEach(frameNum => {
        loadPromises.push(preloadSprite(`${baseDir}/run${frameNum}.png`));
      });
    }

    // Also preload the next likely sprites (adjacent directions)
    const adjacentDirections = {
      up: ['left', 'right'],
      down: ['left', 'right'],
      left: ['up', 'down'],
      right: ['up', 'down']
    };

    adjacentDirections[direction].forEach(adjDir => {
      if (state === 'idle') {
        const baseDir = getBaseDir('idle');
        const [frame1, frame2] = IDLE_FRAMES[adjDir];
        loadPromises.push(
          preloadSprite(`${baseDir}/idle${frame1}.png`),
          preloadSprite(`${baseDir}/idle${frame2}.png`)
        );
      }
    });

    await Promise.all(loadPromises);
  };

  // Update the animation effect for smoother frame transitions
  useEffect(() => {
    let lastFrameTime = 0;
    let accumulatedTime = 0;
    let animationFrameId;
    
    const animate = (timestamp) => {
      if (!lastFrameTime) {
        lastFrameTime = timestamp;
        animationFrameId = requestAnimationFrame(animate);
        return;
      }

      const deltaTime = timestamp - lastFrameTime;
      accumulatedTime += deltaTime;

      const config = ANIMATION_CONFIG[movement];
      if (config) {
        const frameTime = config.frameTime;
        
        if (accumulatedTime >= frameTime) {
          const framesToAdvance = Math.floor(accumulatedTime / frameTime);
          
          if (movement === 'walk') {
            setWalkFrame(prev => (prev + framesToAdvance) % config.frames);
          } else if (movement === 'run') {
            setRunFrame(prev => (prev + framesToAdvance) % config.frames);
          }
          
          accumulatedTime = accumulatedTime % frameTime;
        }
      }
      
      lastFrameTime = timestamp;
      animationFrameId = requestAnimationFrame(animate);
    };

    if (movement === 'walk' || movement === 'run') {
      lastFrameTime = 0;
      accumulatedTime = 0;
      animationFrameId = requestAnimationFrame(animate);
    }

    return () => {
      if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
      }
    };
  }, [movement]);

  // Preload sprites when state changes
  useEffect(() => {
    if (!selectedCharacter) return;
    preloadSprites(selectedCharacter.name, movement, direction);
  }, [selectedCharacter, movement, direction]);

  // Function to handle long idle state
  const handleLongIdle = useCallback(() => {
    if (longIdleTimer.current) {
      clearTimeout(longIdleTimer.current);
    }

    // Reset long idle timer whenever there's movement
    if (movement === 'idle') {
      longIdleTimer.current = setTimeout(() => {
        console.log('Setting long idle to true'); // Debug log
        setIsLongIdle(true);
      }, IDLE_TIMEOUT);
    } else {
      setIsLongIdle(false);
    }
  }, [movement]);

  // Update long idle state when movement changes
  useEffect(() => {
    console.log('Movement changed to:', movement); // Debug log
    handleLongIdle();
    
    return () => {
      if (longIdleTimer.current) {
        clearTimeout(longIdleTimer.current);
      }
    };
  }, [movement, handleLongIdle]);

  // Debug log for sprite changes
  useEffect(() => {
    console.log('Current sprite:', getCharacterSprite());
    console.log('Is long idle:', isLongIdle);
  }, [isLongIdle, movement, direction]);

  // Update getCharacterSprite to ensure consistent frame selection
  const getCharacterSprite = useCallback(() => {
    if (!selectedCharacter) return '';
    
    const characterClass = selectedCharacter.name;
    
    if (isLongIdle && movement === 'idle') {
      const baseDir = `/assets/${characterClass}PC/${characterClass}Sit`;
      const frame = LONG_IDLE_FRAMES[direction];
      return `${baseDir}/sit${frame}.png`;
    }
    
    const baseDir = `/assets/${characterClass}PC/${characterClass}${movement.charAt(0).toUpperCase() + movement.slice(1)}`;
    let frameNumber;
    
    switch (movement) {
      case 'run':
        frameNumber = RUN_FRAMES[direction][runFrame];
        break;
      case 'walk':
        frameNumber = WALK_FRAMES[direction][walkFrame];
        break;
      default:
        frameNumber = IDLE_FRAMES[direction][useSecondFrame ? 1 : 0];
    }
    
    return `${baseDir}/${movement}${frameNumber}.png`;
  }, [selectedCharacter, movement, direction, isLongIdle, runFrame, walkFrame, useSecondFrame]);

  useEffect(() => {
    if (!selectedCharacter) {
      navigate('/');
      return;
    }
    // Quest/context changes apply their deltas without erasing combat wounds,
    // equipment or the current stamina pool.
    const previous = previousContextStats.current;
    previousContextStats.current = characterStats;
    setBaseStats({
      ...characterStats,
      defense: characterStats.armor,
      maxHp: characterStats.maxHp ?? legacyMaxHp.current
    });
    if (characterStats.hp !== previous.hp) {
      setCurrentStats(stats => ({ ...stats,
        hp: Math.max(0, Math.min(stats.maxHp, stats.hp + characterStats.hp - previous.hp))
      }));
    }
    if (characterStats.gold !== previous.gold) {
      setPlayerGold(gold => gold + characterStats.gold - previous.gold);
    }
  }, [selectedCharacter, characterStats, navigate]);

  // Handle pause/unpause
  const togglePause = () => {
    setIsPaused(prev => !prev);
    setShowSaveLoadMenu(false);
  };

  const closeLocationPanels = () => {
    setShowVisitMenu(false);
    setShowShop(false);
    setShowLodge(false);
    setShowDialog(false);
    setShowQuest(false);
  };

  const startBattle = () => {
    if (isPaused || showMap || showBattle || restInProgress || purchaseInProgress || currentStats.hp <= 0) return;
    releaseMovement();
    closeLocationPanels();
    setShowInventory(false);
    setShowDetailedStats(false);
    setShowBattle(true);
  };

  const finishBattle = (result) => {
    if (result) {
      const defeated = result.phase === 'defeat';
      setCurrentStats(stats => ({ ...stats,
        hp: defeated ? Math.max(1, Math.ceil(stats.maxHp * 0.3)) : result.player.hp
      }));
      setCurrentStamina(result.player.stamina);
      setPlayerGold(gold => defeated ? gold - Math.floor(gold * 0.1) : gold + result.rewards.gold);
      if (result.phase === 'victory') {
        setBattleProgress(progress => ({
          xp: progress.xp + result.rewards.xp,
          victories: progress.victories + 1
        }));
      }
    }
    releaseMovement();
    setShowBattle(false);
  };

  // Handle restart
  const handleRestart = () => {
    const spawnPoint = spawnManager.getRandomSpawnPoint();
    setPosition(spawnPoint);
    setCameraPosition(cameraForPosition(spawnPoint));
    setCurrentLocation(locationManager.checkLocation(spawnPoint.x, spawnPoint.y));
    closeLocationPanels();
    releaseMovement();
    setMapPosition({
      x: -(spawnPoint.x - VIEWPORT_WIDTH/2),
      y: -(spawnPoint.y - VIEWPORT_HEIGHT/2)
    });
    setDirection('down');
    setMovement('idle');
    setIsRunning(false);
    setGameTime({ hours: 6, minutes: 0 }); // Reset time to 6:00
    setIsPaused(false);
  };

  // Handle exit to main menu
  const handleExitToMainMenu = () => {
    clearGameData();
    navigate('/');
  };

  // Handle run toggle button
  const toggleRun = () => {
    setIsRunToggled(prev => !prev);
  };

  // Update keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase();
      if (showBattle) return;
      if (e.target.closest?.('input, textarea, select, [contenteditable="true"]') || e.ctrlKey || e.altKey || e.metaKey) return;
      if (['w', 'a', 's', 'd', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright', 'shift'].includes(key)) {
        if (!isPaused && !showMap && !showBattle) {
          e.preventDefault();
          keysPressed.current[key] = true;
          if (key === 'shift') isShiftPressed.current = true;
        }
        return;
      }
      // Menu shortcuts should fire once per press, even when the key is held.
      if (e.repeat) return;
      if (key === 'escape') {
        e.preventDefault();
        if (showSaveLoadMenu) {
          setShowSaveLoadMenu(false);
        } else if (showMap) {
          setShowMap(false);
        } else {
          togglePause();
        }
        return;
      }
      if (isPaused) return;
      if (key === 'm') {
        setShowMap(prev => !prev);
        return;
      }
      if (showMap) return;
      if (key === 'r') {
        toggleRun();
      }
      if (key === 'i') {
        if (showInventory) {
          setShowInventory(false);
        } else {
          setShowInventory(true);
          setContainerContent('inventory');
        }
      }
      if (key === 't') {
        if (showDetailedStats) {
          setShowDetailedStats(false);
        } else {
          setShowDetailedStats(true);
          setContainerContent('stats');
        }
      }
      
      // Add F3 key for debug toggle
      if (e.key === 'F3') {
        setShowDebug(prev => !prev);
      }
      if (key === 'e') {
        handleInteract();
      }
      // Cheat code: Press 'P' to get all relics
      if (key === 'p') {
        const relicNames = [
          'Majapahit Relic',
          'Kutai Relic',
          'Sriwijaya Relic',
          'Mataram Kuno Relic',
          'Samudra Pasai Relic',
          'Demak Relic',
          'Mataram Islam Relic',
          'Gowa-Tallo Relic'
        ];
        setObtainedRelics(Array(8).fill(true));
        setCharacterStats(prev => ({
          ...prev,
          relics: [...relicNames]
        }));
        // Show a message that cheats are activated
        setUseItemMessage('🎮 Cheat Activated: All Relics Obtained!');
        setTimeout(() => setUseItemMessage(''), 3000);
      }
    };

    const handleKeyUp = (e) => {
      keysPressed.current[e.key.toLowerCase()] = false;
      if (e.key.toLowerCase() === 'shift') {
        isShiftPressed.current = false;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [showBattle, isPaused, showSaveLoadMenu, showMap, showInventory, showDetailedStats, showVisitMenu, currentLocation]);

  // Game loop function using useCallback
  const gameLoop = useCallback((timestamp) => {
    if (!position || isPaused || showMap || showBattle) {
      lastTime.current = 0;
      accumulator.current = 0;
      return;
    }

    if (!lastTime.current) {
      lastTime.current = timestamp;
      gameLoopId.current = requestAnimationFrame(gameLoop);
      return;
    }

    let frameTime = timestamp - lastTime.current;
    lastTime.current = timestamp;

    if (frameTime > MAX_FRAME_TIME) {
      frameTime = MAX_FRAME_TIME;
    }

    accumulator.current += frameTime;

    while (accumulator.current >= FIXED_TIMESTEP) {
      const keys = { ...keysPressed.current };
      for (const { key } of dPadPointers.current.values()) keys[key] = true;
      let newX = position.x;
      let newY = position.y;
      let newDirection = direction;
      let isMoving = false;

      const canSprint = currentStamina > STAMINA_THRESHOLD && !isSprintCooldown;
      const isCharacterFast = selectedCharacter?.stats?.speed === 2.5;
      const speedMultiplier = canSprint && (isShiftPressed.current || isRunToggled) 
        ? (isCharacterFast ? SPEED_MULTIPLIERS.run.fast : SPEED_MULTIPLIERS.run.normal)
        : SPEED_MULTIPLIERS.walk;

      const speed = Math.floor((BASE_MOVEMENT_SPEED * speedMultiplier * FIXED_TIMESTEP) / 16.67);

      // Store original position for collision checking
      const originalX = newX;
      const originalY = newY;

      // Handle movement with proper boundaries
      if (keys['w'] || keys['arrowup']) {
        newY = Math.max(0, newY - speed);
        newDirection = 'up';
        isMoving = true;
      }
      if (keys['s'] || keys['arrowdown']) {
        newY = Math.min(MAP_DIMENSIONS.height - CHARACTER_HEIGHT, newY + speed);
        newDirection = 'down';
        isMoving = true;
      }
      if (keys['a'] || keys['arrowleft']) {
        newX = Math.max(0, newX - speed);
        newDirection = 'left';
        isMoving = true;
      }
      if (keys['d'] || keys['arrowright']) {
        newX = Math.min(MAP_DIMENSIONS.width - CHARACTER_WIDTH, newX + speed);
        newDirection = 'right';
        isMoving = true;
      }

      // Normalize diagonal movement
      if (isMoving && 
          ((keys['w'] || keys['arrowup'] || keys['s'] || keys['arrowdown']) && 
           (keys['a'] || keys['arrowleft'] || keys['d'] || keys['arrowright']))) {
        const diagonalFactor = 1 / Math.sqrt(2);
        const dx = newX - position.x;
        const dy = newY - position.y;
        newX = Math.floor(position.x + dx * diagonalFactor);
        newY = Math.floor(position.y + dy * diagonalFactor);

        // Re-check boundaries after diagonal movement
        newX = Math.max(0, Math.min(MAP_DIMENSIONS.width - CHARACTER_WIDTH, newX));
        newY = Math.max(0, Math.min(MAP_DIMENSIONS.height - CHARACTER_HEIGHT, newY));
      }

      // Check collision at new position with offset
      if (isMoving) {
        // Check X and Y movement separately to allow sliding along walls
        const collideX = collisionManager.checkCollision(
          newX + COLLISION_OFFSET.x, 
          originalY + COLLISION_OFFSET.y,
          CHARACTER_COLLISION_BOX.width,
          CHARACTER_COLLISION_BOX.height
        );
        
        const collideY = collisionManager.checkCollision(
          originalX + COLLISION_OFFSET.x,
          newY + COLLISION_OFFSET.y,
          CHARACTER_COLLISION_BOX.width,
          CHARACTER_COLLISION_BOX.height
        );

        // If there's collision, revert to original position
        if (collideX) newX = originalX;
        if (collideY) newY = originalY;

        // Only update position and movement if we actually moved
        if (newX !== originalX || newY !== originalY) {
        setPosition({ x: newX, y: newY });

        // Update camera position to follow player
        setCameraPosition(cameraForPosition({ x: newX, y: newY }));
        
        setDirection(newDirection);
        const newMovement = canSprint && (isShiftPressed.current || isRunToggled) ? 'run' : 'walk';
        setMovement(newMovement);
        }
      } else if (movement !== 'idle') {
        setMovement('idle');
      }

      // Check location after position update
      if (newX !== originalX || newY !== originalY) {
        const location = locationManager.checkLocation(newX, newY);
        if (location !== currentLocation) {
          setCurrentLocation(location);
        }
      }

      accumulator.current -= FIXED_TIMESTEP;
    }

    gameLoopId.current = requestAnimationFrame(gameLoop);
  }, [position, direction, movement, currentStamina, isSprintCooldown, isRunToggled, selectedCharacter?.stats?.speed, isPaused, showMap, showBattle, currentLocation]);

  // Main game loop effect
  useEffect(() => {
    if (!isPaused && !showMap && !showBattle) {
      gameLoopId.current = requestAnimationFrame(gameLoop);
    }

    return () => {
      if (gameLoopId.current) {
        cancelAnimationFrame(gameLoopId.current);
        gameLoopId.current = null;
      }
    };
  }, [gameLoop, isPaused, showMap, showBattle]);

  // Handle visibility change
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        lastFrameTimeRef.current = null;
        if (gameLoopId.current) {
          cancelAnimationFrame(gameLoopId.current);
          gameLoopId.current = null;
        }
      } else if (!isPaused && !showMap && !showBattle) {
        gameLoopId.current = requestAnimationFrame(gameLoop);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [gameLoop, isPaused, showMap, showBattle]);

  // Modify stamina handling
  useEffect(() => {
    if (staminaTimer.current) {
      clearInterval(staminaTimer.current);
    }

    if (showBattle) return;
    staminaTimer.current = setInterval(() => {
      if (movement === 'run' && currentStamina > 0) {
        // Drain stamina while sprinting
        setCurrentStamina(prev => {
          const newStamina = Math.max(0, prev - STAMINA_DRAIN_RATE / 10);
          if (newStamina <= STAMINA_THRESHOLD) {
            // Force walk and trigger cooldown when stamina is too low
            setIsRunning(false);
            setIsRunToggled(false);
            setMovement('walk');
            setIsSprintCooldown(true);
          }
          return newStamina;
        });
      } else if (movement !== 'run') {
        // Regenerate stamina when not sprinting
        setCurrentStamina(prev => Math.min(characterStats.stamina, prev + STAMINA_REGEN_RATE / 10));
      }
    }, 100);

    return () => {
      if (staminaTimer.current) {
        clearInterval(staminaTimer.current);
      }
    };
  }, [movement, characterStats.stamina, showBattle]);

  // Handle hunger decrease
  useEffect(() => {
    if (hungerTimer.current) {
      clearInterval(hungerTimer.current);
    }

    if (showBattle) return;
    hungerTimer.current = setInterval(() => {
      setCurrentHunger(prev => {
        const newHunger = Math.max(0, prev - HUNGER_DECREASE_RATE);
        // Update currentStats to reflect hunger change
        setCurrentStats(prev => ({
          ...prev,
          hunger: newHunger
        }));
        return newHunger;
      });
    }, 30000); // 30 seconds

    return () => {
      if (hungerTimer.current) {
        clearInterval(hungerTimer.current);
      }
    };
  }, [showBattle]);

  // Add useEffect to update currentStats when equipment changes
  useEffect(() => {
    setCurrentStats(previous => {
      const maxHp = baseStats.maxHp + equipmentBonuses.maxHp;
      return {
        ...previous,
        damage: baseStats.damage + equipmentBonuses.damage + temporaryBonuses.damage,
        speed: baseStats.speed + temporaryBonuses.speed,
        defense: baseStats.defense + equipmentBonuses.defense,
        maxHp,
        hp: Math.max(0, Math.min(maxHp, previous.hp + maxHp - previous.maxHp))
      };
    });
  }, [baseStats, equipmentBonuses, temporaryBonuses]);

  // Scale only the presentation; movement, camera and collision use logical pixels.
  useLayoutEffect(() => {
    const frame = mapFrameRef.current;
    if (!frame) return;

    const updateScale = () => {
      const styles = getComputedStyle(frame);
      const width = frame.clientWidth - parseFloat(styles.paddingLeft) - parseFloat(styles.paddingRight);
      const height = frame.clientHeight - parseFloat(styles.paddingTop) - parseFloat(styles.paddingBottom);
      if (width > 0 && height > 0) {
        setViewportScale(Math.min(width / VIEWPORT_WIDTH, height / VIEWPORT_HEIGHT));
      }
    };

    updateScale();
    const observer = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(updateScale) : null;
    observer?.observe(frame);
    window.addEventListener('resize', updateScale);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [isLoading, selectedCharacter?.name]);

  useEffect(() => {
    const handleHidden = () => { if (document.hidden) releaseMovement(); };
    window.addEventListener('blur', releaseMovement);
    window.addEventListener('resize', releaseMovement);
    document.addEventListener('visibilitychange', handleHidden);
    return () => {
      window.removeEventListener('blur', releaseMovement);
      window.removeEventListener('resize', releaseMovement);
      document.removeEventListener('visibilitychange', handleHidden);
      releaseMovement();
    };
  }, [releaseMovement]);

  useEffect(() => {
    if (isPaused || showMap || showBattle) {
      releaseMovement();
    }
  }, [isPaused, showMap, showBattle, releaseMovement]);

  // Function to handle inventory slot click
  const handleSlotClick = (section, index) => {
    if (section === 'armor') {
      const slotName = getSlotNameFromIndex(index);
      if (equipmentSlots[slotName]) {
        handleUnequipItem(slotName);
      }
    } else if (section === 'main') {
      const item = inventory.main[index];
      if (item) {
        setSelectedItem(selectedItem === item ? null : item);
      }
    }
  };

  // Modify game time effect for day/night cycle (5 minutes each)
  useEffect(() => {
    const updateGameTime = () => {
      setGameTime(prevTime => {
        let newHours = prevTime.hours;
        let newMinutes = prevTime.minutes + 1;
        
        if (newMinutes >= 60) {
          newMinutes = 0;
          newHours = (newHours + 1) % 24;
          
          // Only check for night time when hour changes
          const isNightTime = newHours >= 18 || newHours < 6;
          if (isNightTime !== isNight) {
            setIsNight(isNightTime);
          }
        }
        
        return { hours: newHours, minutes: newMinutes };
      });
    };

    if (!isPaused && !showMap && !showBattle) {
      gameTimeRef.current = setInterval(updateGameTime, 1000);
    }

    return () => {
      if (gameTimeRef.current) {
        clearInterval(gameTimeRef.current);
      }
    };
  }, [isPaused, showMap, showBattle, isNight]);

  // Add effect to handle day/night transition
  useEffect(() => {
    const isNightTime = gameTime.hours >= 18 || gameTime.hours < 6;
    setIsNight(isNightTime);
    console.log('Time changed:', gameTime.hours + ':' + gameTime.minutes, 'Is night:', isNightTime);
  }, [gameTime]);

  // Add cooldown progress effect
  useEffect(() => {
    if (isSprintCooldown) {
      const startTime = Date.now();
      const updateProgress = () => {
        const elapsed = Date.now() - startTime;
        const progress = (elapsed / SPRINT_COOLDOWN) * 100;
        
        if (progress >= 100) {
          setIsSprintCooldown(false);
          setCooldownProgress(0);
          if (cooldownTimer.current) {
            clearInterval(cooldownTimer.current);
          }
        } else {
          setCooldownProgress(progress);
        }
      };
      
      cooldownTimer.current = setInterval(updateProgress, 50);
      return () => {
        if (cooldownTimer.current) {
          clearInterval(cooldownTimer.current);
        }
      };
    }
  }, [isSprintCooldown]);

  const dPadHandlers = (direction) => {
    const releasePointer = (event) => {
      dPadPointers.current.delete(event.pointerId);
      if (event.currentTarget.hasPointerCapture?.(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId);
      }
    };
    return {
      onPointerDown: (event) => {
        if (event.button !== 0 || isPaused || showMap || showBattle) return;
        event.preventDefault();
        event.currentTarget.setPointerCapture(event.pointerId);
        dPadPointers.current.set(event.pointerId, {
          key: { up: 'w', down: 's', left: 'a', right: 'd' }[direction],
          target: event.currentTarget
        });
      },
      onPointerUp: releasePointer,
      onPointerCancel: releasePointer,
      onLostPointerCapture: releasePointer
    };
  };

  // Add collision map loading
  useEffect(() => {
    collisionManager.loadCollisionMap();
  }, []);

  // Modify the initialization effect
  useEffect(() => {
    const initializeGame = async () => {
      try {
        setIsLoading(true);
        // Wait for all managers to load
        await Promise.all([
          collisionManager.loadCollisionMap(),
          spawnManager.loadSpawnPoints(),
          locationManager.loadLocationMap()
        ]);

        // Get spawn point and set initial position
        const spawnPoint = spawnManager.getRandomSpawnPoint();
        setPosition(spawnPoint);
        
        // Set initial map position based on spawn point
        setMapPosition({
          x: -(spawnPoint.x - VIEWPORT_WIDTH/2),
          y: -(spawnPoint.y - VIEWPORT_HEIGHT/2)
        });

        // Set initial camera position
        setCameraPosition(cameraForPosition(spawnPoint));
        setCurrentLocation(locationManager.checkLocation(spawnPoint.x, spawnPoint.y));
      } catch (error) {
        console.error('Failed to initialize game:', error);
      } finally {
        setIsLoading(false);
      }
    };

    initializeGame();
  }, []);

  // Location-specific visit options
  const locationOptions = {
    'Lakers City': {
      description: 'Kota pelabuhan yang terkenal dengan danau indahnya dan hasil tangkapan ikan yang melimpah.',
      options: [
        { 
          icon: '🏪', 
          label: 'Lakers General Store', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('lakersGeneral');
            setContainerContent('shop');
          }
        },
        { 
          icon: '🍖', 
          label: 'Lakeside Food Court', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('lakersFood');
            setContainerContent('shop');
          }
        },
        { 
          icon: '🛏️', 
          label: 'Lakers Hill Inn', 
          action: () => {
            setShowVisitMenu(false);
            setShowLodge(true);
            setContainerContent('lodge');
          }
        },
        { 
          icon: '🎣', 
          label: 'Lakers Fishing Shop', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('lakersFishing');
            setContainerContent('shop');
          }
        },
        { 
          icon: '💬', 
          label: 'Talk to Locals', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Lakers City! Saya adalah nelayan lokal yang sudah lama tinggal di sini.",
              tips: [
                "Kota kami terkenal dengan hasil laut dan danau yang melimpah.",
                "Jangan lupa untuk membeli peralatan memancing di Lakers Fishing Shop.",
                "Cobalah hidangan khas ikan segar di Lakeside Food Court.",
                "Anda bisa membeli berbagai kebutuhan di Lakers General Store.",
                "Lakers Hill Inn menyediakan pemandangan danau yang indah saat beristirahat."
              ],
              farewell: "Semoga Anda menikmati kunjungan di kota kami!"
            });
          }
        },
        { 
          icon: '📜', 
          label: 'Sejarah Quest', 
          action: () => {
            setShowVisitMenu(false);
            setShowQuest(true);
            setContainerContent('quest');
          }
        }
      ]
    },
    'Woodville City': {
      description: 'A peaceful city in the midst of the dense Redwood forest.',
      options: [
        { 
          icon: '🏹', 
          label: 'Hunting Equipment Shop', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('hunting');
            setContainerContent('shop');
          }
        },
        { 
          icon: '🪓', 
          label: 'Woodworking Tools Shop', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('woodworking');
            setContainerContent('shop');
          }
        },
        { 
          icon: '🍖', 
          label: 'Forest Meat House', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('food');
            setContainerContent('shop');
          }
        },
        { 
          icon: '🛏️', 
          label: 'Wooden Lodge Inn', 
          action: () => {
            setShowVisitMenu(false);
            setShowLodge(true);
            setContainerContent('lodge');
          }
        },
        { 
          icon: '🧝‍♂️', 
          label: 'Meet Elf Advisor', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Welcome to Woodville, traveler! I am the Elf Advisor.",
              tips: [
                "The Sacred Relics are scattered across Elendor.",
                "Each location holds its own secrets and challenges.",
                "Build your strength and gather resources before venturing far.",
                "The Elven Kingdom awaits those who prove worthy."
              ],
              farewell: "May the forest guide your path!"
            });
          }
        },
        { 
          icon: '📜', 
          label: 'Sejarah Quest', 
          action: () => {
            setShowVisitMenu(false);
            setShowQuest(true);
            setContainerContent('quest');
          }
        }
      ]
    },
    'Managarmr Central City': {
      description: 'The magnificent capital city of Elendor.',
      options: [
        { 
          icon: '⚔️', 
          label: 'Legendary Weapons Shop', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('managarmrWeapons');
            setContainerContent('shop');
          }
        },
        { 
          icon: '🛡️', 
          label: 'Premium Armor Shop', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('managarmrArmor');
            setContainerContent('shop');
          }
        },
        { 
          icon: '🏰', 
          label: 'Meeting Hall', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Balai Pertemuan Managarmr!",
              tips: [
                "Di sini Anda bisa bertemu dengan para pemimpin kota.",
                "Berbagai keputusan penting diambil di tempat ini.",
                "Balai ini juga menyimpan sejarah panjang Elendor."
              ],
              farewell: "Semoga kunjungan Anda bermanfaat!"
            });
          }
        },
        { 
          icon: '🏦', 
          label: 'Managarmr Bank', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Bank Managarmr!",
              tips: [
                "Kami menyediakan layanan penyimpanan emas yang aman.",
                "Anda bisa menyimpan dan mengambil emas kapan saja.",
                "Keamanan harta Anda adalah prioritas kami."
              ],
              farewell: "Terima kasih telah mempercayai Bank Managarmr!"
            });
          }
        },
        { 
          icon: '🍺', 
          label: 'Managarmr Tavern', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Tavern Managarmr!",
              tips: [
                "Tempat terbaik untuk mendengar kabar terbaru.",
                "Para petualang sering berkumpul di sini.",
                "Cobalah hidangan dan minuman spesial kami."
              ],
              farewell: "Datang lagi ya!"
            });
          }
        },
        { 
          icon: '📜', 
          label: 'Sejarah Quest', 
          action: () => {
            setShowVisitMenu(false);
            setShowQuest(true);
            setContainerContent('quest');
          }
        }
      ]
    },
    'Wheatlived Village': {
      description: 'A peaceful and productive wheat farming village.',
      options: [
        { 
          icon: '🌾', 
          label: 'Wheat Market', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('wheatMarket');
            setContainerContent('shop');
          }
        },
        { 
          icon: '🍞', 
          label: 'Bakery Shop', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('wheatBakery');
            setContainerContent('shop');
          }
        },
        { 
          icon: '🏠', 
          label: 'Farmer\'s Inn', 
          action: () => {
            setShowVisitMenu(false);
            setShowLodge(true);
            setContainerContent('lodge');
          }
        },
        { 
          icon: '👨‍🌾', 
          label: 'Meet Village Chief', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Wheatlived Village!",
              tips: [
                "Desa kami adalah penghasil gandum terbaik di Elendor.",
                "Roti buatan toko roti kami sangat terkenal.",
                "Para petani kami bekerja keras sepanjang tahun.",
                "Jangan lupa mencoba makanan khas desa kami!"
              ],
              farewell: "Semoga panen selalu melimpah!"
            });
          }
        },
        { 
          icon: '📜', 
          label: 'Sejarah Quest', 
          action: () => {
            setShowVisitMenu(false);
            setShowQuest(true);
            setContainerContent('quest');
          }
        }
      ]
    },
    'Fishmell Village': {
      description: 'A fishing village by Lake Lakers rich in seafood.',
      options: [
        { 
          icon: '🐟', 
          label: 'Fish Market', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('fishMarket');
            setContainerContent('shop');
          }
        },
        { 
          icon: '🎣', 
          label: 'Fishing Equipment Shop', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('fishingShop');
            setContainerContent('shop');
          }
        },
        { 
          icon: '🍜', 
          label: 'Fish Soup House', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Rumah Sup Ikan!",
              tips: [
                "Sup ikan kami dibuat dari ikan segar pilihan.",
                "Resep rahasia turun-temurun keluarga.",
                "Cocok dimakan saat cuaca dingin."
              ],
              farewell: "Selamat menikmati!"
            });
          }
        },
        { 
          icon: '⛵', 
          label: 'Boat Rental', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Penyewaan Perahu!",
              tips: [
                "Kami menyewakan berbagai jenis perahu.",
                "Tersedia untuk memancing atau sekedar berkeliling danau.",
                "Keselamatan penumpang adalah prioritas kami."
              ],
              farewell: "Selamat berlayar!"
            });
          }
        },
        { 
          icon: '📜', 
          label: 'Sejarah Quest', 
          action: () => {
            setShowVisitMenu(false);
            setShowQuest(true);
            setContainerContent('quest');
          }
        }
      ]
    },
    'Stonedust Castle': {
      description: 'The mighty military fortress and defense center of Elendor.',
      options: [
        { 
          icon: '⚔️', 
          label: 'Training Room', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Ruang Latihan!",
              tips: [
                "Di sini Anda bisa berlatih teknik bertarung.",
                "Para pelatih berpengalaman siap membimbing.",
                "Latihan rutin membuat Anda lebih kuat."
              ],
              farewell: "Tetap semangat berlatih!"
            });
          }
        },
        { 
          icon: '🛡️', 
          label: 'Military Armory', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('militaryArmory');
            setContainerContent('shop');
          }
        },
        { 
          icon: '📜', 
          label: 'Military Missions', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Pusat Misi Militer!",
              tips: [
                "Berbagai misi tersedia untuk diambil.",
                "Selesaikan misi untuk mendapat hadiah.",
                "Tingkatkan reputasi Anda di militer."
              ],
              farewell: "Semoga berhasil dalam misi Anda!"
            });
          }
        },
        { 
          icon: '📜', 
          label: 'Sejarah Quest', 
          action: () => {
            setShowVisitMenu(false);
            setShowQuest(true);
            setContainerContent('quest');
          }
        }
      ]
    },
    'Beautiful Harbor': {
      description: 'A busy port serving as Elendor\'s trade center.',
      options: [
        { 
          icon: '🏪', 
          label: 'Import Market', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('importMarket');
            setContainerContent('shop');
          }
        },
        { 
          icon: '⛵', 
          label: 'Ship Dock', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Dermaga!",
              tips: [
                "Berbagai kapal dari berbagai negeri berlabuh di sini.",
                "Jadwal pelayaran tersedia di papan pengumuman.",
                "Pastikan cuaca baik sebelum berlayar."
              ],
              farewell: "Semoga pelayaran Anda menyenangkan!"
            });
          }
        },
        { 
          icon: '📦', 
          label: 'Warehouse', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Gudang Pelabuhan!",
              tips: [
                "Kami menyimpan berbagai barang dagangan.",
                "Keamanan barang terjamin 24 jam.",
                "Sistem inventaris terorganisir dengan baik."
              ],
              farewell: "Terima kasih telah menggunakan jasa kami!"
            });
          }
        },
        { 
          icon: '📜', 
          label: 'Sejarah Quest', 
          action: () => {
            setShowVisitMenu(false);
            setShowQuest(true);
            setContainerContent('quest');
          }
        }
      ]
    },
    'Wizard Tower': {
      description: 'The mysterious tower of magical arts.',
      options: [
        { 
          icon: '📚', 
          label: 'Magic Library', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Perpustakaan Sihir!",
              tips: [
                "Ribuan buku sihir tersimpan di sini.",
                "Pelajari mantra-mantra kuno.",
                "Jaga ketenangan saat membaca."
              ],
              farewell: "Semoga pengetahuan Anda bertambah!"
            });
          }
        },
        { 
          icon: '🔮', 
          label: 'Potion Shop', 
          action: () => {
            setShowVisitMenu(false);
            setShowShop(true);
            setCurrentShop('potionShop');
            setContainerContent('shop');
          }
        },
        { 
          icon: '✨', 
          label: 'Learn Magic', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Kelas Sihir!",
              tips: [
                "Pelajari dasar-dasar sihir di sini.",
                "Latihan rutin membuat sihir lebih kuat.",
                "Hati-hati dalam menggunakan sihir."
              ],
              farewell: "Semoga sihir menyertai Anda!"
            });
          }
        },
        { 
          icon: '📜', 
          label: 'Sejarah Quest', 
          action: () => {
            setShowVisitMenu(false);
            setShowQuest(true);
            setContainerContent('quest');
          }
        }
      ]
    },
    'Stronghold Maul': {
      description: 'A fortress fallen to monsters and dark creatures.',
      options: [
        { 
          icon: '⚔️', 
          label: 'Challenge Monsters', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Bersiaplah untuk pertarungan!",
              tips: [
                "Monster-monster kuat menunggu di dalam.",
                "Pastikan perlengkapan Anda memadai.",
                "Bertarunglah dengan bijak dan hati-hati."
              ],
              farewell: "Semoga keberuntungan menyertai Anda!"
            });
          }
        },
        { 
          icon: '🗝️', 
          label: 'Explore Rooms', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Jelajahi ruangan-ruangan misterius...",
              tips: [
                "Setiap ruangan menyimpan misteri.",
                "Harta karun tersembunyi menunggu.",
                "Waspadalah terhadap jebakan."
              ],
              farewell: "Berhati-hatilah dalam penjelajahan Anda!"
            });
          }
        }
      ]
    },
    'Dwarf Kingdom': {
      description: 'The ruins of the ancient Dwarf Kingdom.',
      options: [
        { 
          icon: '⛏️', 
          label: 'Old Mine', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Selamat datang di Tambang Tua!",
              tips: [
                "Tambang ini menyimpan banyak mineral berharga.",
                "Berhati-hatilah dengan struktur yang rapuh.",
                "Perhatikan tanda-tanda bahaya."
              ],
              farewell: "Semoga beruntung dalam penambangan!"
            });
          }
        },
        { 
          icon: '🏺', 
          label: 'Search Artifacts', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Pencarian Artefak Dwarf...",
              tips: [
                "Artefak kuno tersebar di seluruh kerajaan.",
                "Setiap artefak memiliki kekuatan tersembunyi.",
                "Catat setiap penemuan Anda."
              ],
              farewell: "Semoga penemuan besar menanti Anda!"
            });
          }
        }
      ]
    },
    'Elven Kingdom': {
      description: 'The mysterious Elven Kingdom guarding the 8 sacred relics.',
      options: [
        { 
          icon: '🏰', 
          label: 'Enter Palace', 
          disabled: !obtainedRelics.every(relic => relic),
          action: () => {
            setShowVisitMenu(false);
            if (obtainedRelics.every(relic => relic)) {
              setShowGameCompletion(true);
            } else {
              setShowDialog(true);
              setDialogContent({
                greeting: "Selamat datang di Istana Peri!",
                tips: [
                  "Istana ini hanya terbuka bagi yang telah mengumpulkan semua relik.",
                  "Rahasia besar menanti di dalam.",
                  "Buktikan kelayakan Anda."
                ],
                farewell: "Takdir Anda menanti di dalam istana!"
              });
            }
          }
        },
        { 
          icon: '📜', 
          label: 'Ask About Relics', 
          action: () => {
            setShowVisitMenu(false);
            setShowDialog(true);
            setDialogContent({
              greeting: "Tentang Relik Suci...",
              tips: [
                "8 relik suci tersebar di seluruh Elendor.",
                "Setiap relik memiliki kekuatan unik.",
                "Kumpulkan semuanya untuk membuka rahasia terbesar.",
                `Relik yang telah Anda kumpulkan: ${obtainedRelics.filter(r => r).length}/8`
              ],
              farewell: "Lanjutkan pencarian Anda!"
            });
          }
        }
      ]
    }
  };

  // Handle visit menu interaction
  const handleInteract = () => {
    if (currentLocation && !showVisitMenu) {
      setShowVisitMenu(true);
      setContainerContent('visit');
    }
  };

  // Handle quest completion
  const handleQuestComplete = () => {
    const locationIndex = {
      'Lakers City': 0,
      'Woodville City': 1,
      'Managarmr Central City': 2,
      'Wheatlived Village': 3,
      'Fishmell Village': 4,
      'Stonedust Castle': 5,
      'Beautiful Harbor': 6,
      'Wizard Tower': 7
    }[currentLocation];

    console.log('Quest completed at location:', currentLocation, 'index:', locationIndex);
    const newRelics = [...obtainedRelics];
    newRelics[locationIndex] = true;
    setObtainedRelics(newRelics);
    
    // Update character stats to reflect relic obtained
    const relicNames = [
      'Majapahit Relic',
      'Kutai Relic',
      'Sriwijaya Relic',
      'Mataram Kuno Relic',
      'Samudra Pasai Relic',
      'Demak Relic',
      'Mataram Islam Relic',
      'Gowa-Tallo Relic'
    ];
    
    setCharacterStats(previous => ({
      ...previous,
      relics: newRelics.map((obtained, idx) => obtained ? relicNames[idx] : null).filter(Boolean)
    }));
  };

  // Add loading screen
  if (isLoading || !position || !selectedCharacter) {
    return (
      <WorldContainer>
        <div style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          color: '#ffd700',
          fontSize: '24px',
          textShadow: '2px 2px 4px rgba(0, 0, 0, 0.5)',
          background: '#2c1810'
        }}>
          Loading...
        </div>
      </WorldContainer>
    );
  }

  // Add shop items
  const shopItems = {
    lakersGeneral: [
      {
        id: 'leatherHelm',
        name: 'Leather Cap',
        icon: '🪖',
        type: 'helmet',
        price: 80,
        durability: 100,
        stats: {
          defense: 3,
          hp: 8
        }
      },
      {
        id: 'leatherArmor',
        name: 'Leather Vest',
        icon: '🦺',
        type: 'armor',
        price: 150,
        durability: 100,
        stats: {
          defense: 7,
          hp: 15
        }
      },
      {
        id: 'waterBoots',
        name: 'Water Boots',
        icon: '👢',
        type: 'armor',
        price: 100,
        durability: 100,
        stats: {
          defense: 4,
          hp: 5,
          speed: 1
        }
      }
    ],
    lakersFood: [
      {
        id: 'grilledCarp',
        name: 'Grilled Carp',
        icon: '🐟',
        type: 'food',
        price: 30,
        stats: { 
          hunger: 40,
          hp: 12
        }
      },
      {
        id: 'fishStew',
        name: 'Lakers Fish Stew',
        icon: '🥘',
        type: 'food',
        price: 45,
        stats: {
          hunger: 55,
          hp: 18
        }
      },
      {
        id: 'seaweedSoup',
        name: 'Seaweed Soup',
        icon: '🍜',
        type: 'food',
        stats: {
          hunger: 45,
          hp: 15,
          damage: 10,
          speed: 1
        }
      }
    ],
    woodworking: [
      { 
        id: 'axe1', 
        name: 'Steel Axe', 
        icon: '🪓',
        type: 'weapon', 
        price: 150, 
        stats: { 
          damage: 7 
        } 
      },
      { 
        id: 'shield1', 
        name: 'Wooden Shield', 
        icon: '🛡️',
        type: 'shield', 
        price: 120, 
        stats: { 
          defense: 5 
        } 
      }
    ],
    lakersFishing: [
      {
        id: 'bambooRod',
        name: 'Bamboo Fishing Rod',
        icon: '🎣',
        type: 'weapon',
        price: 90,
        durability: 100,
        stats: {
          damage: 4,
          speed: 1
        }
      },
      {
        id: 'harpoon',
        name: 'Fishing Harpoon',
        icon: '🔱',
        type: 'weapon',
        price: 140,
        durability: 100,
        stats: {
          damage: 8
        }
      },
      {
        id: 'fishNet',
        name: 'Large Fishing Net',
        icon: '🕸️',
        type: 'weapon',
        price: 160,
        durability: 100,
        stats: {
          damage: 6,
          speed: 2
        }
      }
    ],
    hunting: [
      {
        id: 'bow',
        name: 'Longbow',
        icon: '🏹',
        type: 'weapon',
        price: 100,
        durability: 100,
        stats: {
          damage: 5,
          speed: 1
        }
      },
      {
        id: 'quiver',
        name: 'Quiver of Arrows',
        icon: '🏹',
        type: 'weapon',
        price: 50,
        durability: 100,
        stats: {
          damage: 2,
          speed: 1
        }
      },
      {
        id: 'huntingKnife',
        name: 'Hunting Knife',
        icon: '🔪',
        type: 'weapon',
        price: 70,
        durability: 100,
        stats: {
          damage: 3,
          speed: 1
        }
      }
    ],
    food: [
      {
        id: 'venison',
        name: 'Venison Steak',
        icon: '🥩',
        type: 'food',
        price: 40,
        stats: {
          hunger: 50,
          hp: 20
        }
      },
      {
        id: 'wildBoar',
        name: 'Wild Boar Roast',
        icon: '🍖',
        type: 'food',
        price: 35,
        stats: {
          hunger: 45,
          hp: 18,
          damage: 5
        }
      },
      {
        id: 'rabbitStew',
        name: 'Rabbit Stew',
        icon: '🥘',
        type: 'food',
        price: 25,
        stats: {
          hunger: 35,
          hp: 15,
          speed: 1
        }
      },
      {
        id: 'berryPie',
        name: 'Forest Berry Pie',
        icon: '🥧',
        type: 'food',
        price: 20,
        stats: {
          hunger: 30,
          hp: 12,
          stamina: 20
        }
      }
    ],
    managarmrWeapons: [
      {
        id: 'excalibur',
        name: 'Excalibur',
        icon: '⚔️',
        type: 'weapon',
        price: 1000,
        durability: 100,
        stats: {
          damage: 50,
          hp: 30
        }
      },
      {
        id: 'mjolnir',
        name: 'Mjolnir',
        icon: '🔨',
        type: 'weapon',
        price: 800,
        durability: 100,
        stats: {
          damage: 40,
          defense: 10
        }
      }
    ],
    managarmrArmor: [
      {
        id: 'dragonPlate',
        name: 'Dragon Plate',
        icon: '🛡️',
        type: 'armor',
        price: 1200,
        durability: 100,
        stats: {
          defense: 40,
          hp: 50
        }
      },
      {
        id: 'mythrilHelm',
        name: 'Mythril Helm',
        icon: '🪖',
        type: 'helmet',
        price: 600,
        durability: 100,
        stats: {
          defense: 25,
          hp: 30
        }
      }
    ],
    wheatMarket: [
      {
        id: 'wheat',
        name: 'Fresh Wheat',
        icon: '🌾',
        type: 'material',
        price: 10,
        stats: {
          hunger: 5,
          stamina: 3
        }
      },
      {
        id: 'flour',
        name: 'Wheat Flour',
        icon: '🌾',
        type: 'material',
        price: 15,
        stats: {
          hunger: 3
        }
      }
    ],
    wheatBakery: [
      {
        id: 'bread',
        name: 'Fresh Bread',
        icon: '🍞',
        type: 'food',
        price: 25,
        stats: {
          hunger: 30,
          hp: 10
        }
      },
      {
        id: 'cake',
        name: 'Wheat Cake',
        icon: '🍰',
        type: 'food',
        price: 40,
        stats: {
          hunger: 45,
          hp: 15,
          stamina: 20
        }
      }
    ],
    fishMarket: [
      {
        id: 'rawFish',
        name: 'Fresh Fish',
        icon: '🐟',
        type: 'food',
        price: 20,
        stats: {
          hunger: 25,
          hp: 8
        }
      },
      {
        id: 'fishSoup',
        name: 'Fish Soup',
        icon: '🍜',
        type: 'food',
        price: 35,
        stats: {
          hunger: 40,
          hp: 15
        }
      }
    ],
    fishingShop: [
      {
        id: 'fishingRod',
        name: 'Fishing Rod',
        icon: '🎣',
        type: 'tool',
        price: 100,
        durability: 100
      },
      {
        id: 'fishingNet',
        name: 'Fishing Net',
        icon: '🕸️',
        type: 'tool',
        price: 150,
        durability: 100
      }
    ],
    militaryArmory: [
      {
        id: 'steelSword',
        name: 'Steel Sword',
        icon: '⚔️',
        type: 'weapon',
        price: 300,
        durability: 100,
        stats: {
          damage: 25,
          defense: 5
        }
      },
      {
        id: 'steelArmor',
        name: 'Steel Armor',
        icon: '🛡️',
        type: 'armor',
        price: 400,
        durability: 100,
        stats: {
          defense: 30,
          hp: 25
        }
      }
    ],
    importMarket: [
      {
        id: 'spices',
        name: 'Exotic Spices',
        icon: '🌶️',
        type: 'material',
        price: 50,
        stats: {
          stamina: 10,
          speed: 1
        }
      },
      {
        id: 'silk',
        name: 'Fine Silk',
        icon: '🧵',
        type: 'material',
        price: 75
      }
    ],
    potionShop: [
      {
        id: 'healthPotion',
        name: 'Health Potion',
        icon: '🧪',
        type: 'consumable',
        price: 100,
        stats: {
          hp: 50
        }
      },
      {
        id: 'manaPotion',
        name: 'Mana Potion',
        icon: '🧪',
        type: 'consumable',
        price: 120,
        stats: {
          mp: 50
        }
      }
    ]
  };

  // Add function to handle buying items
  const handleBuyItem = async (item) => {
    try {
      console.log('Attempting to buy item:', item);
      console.log('Current inventory:', inventory);
      console.log('Current gold:', playerGold);

      // Set purchase in progress
      setPurchaseInProgress(true);
      setPurchaseMessage('Processing purchase...');

      if (playerGold < item.price) {
        setPurchaseMessage('Not enough gold!');
        setTimeout(() => setPurchaseMessage(''), 2000);
        return;
      }

      // Find first empty slot in main inventory
      const emptySlotIndex = inventory.main.findIndex(slot => !slot?.id);
      console.log('Empty slot found at:', emptySlotIndex);

      if (emptySlotIndex === -1) {
        setPurchaseMessage('Inventory is full!');
        setTimeout(() => setPurchaseMessage(''), 2000);
        return;
      }

      // Create new inventory object
      const newInventory = {
        ...inventory,
        main: [...inventory.main]
      };
      
      // Add item to inventory
      newInventory.main[emptySlotIndex] = {
        id: `${item.id}_${Date.now()}`,
        name: item.name,
        icon: item.icon,
        type: item.type,
        durability: item.durability || 100,
        stats: item.stats || {},
        count: 1
      };
      
      console.log('New inventory:', newInventory);
      
      // Update state with a small delay to show animation
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Update state
      setInventory(newInventory);
      setPlayerGold(prevGold => {
        const newGold = prevGold - item.price;
        console.log('Updating gold from', prevGold, 'to', newGold);
        return newGold;
      });

      setPurchaseMessage('Purchase successful!');
      setTimeout(() => {
        setPurchaseMessage('');
        // Close shop
        setShowShop(false);
        setShowVisitMenu(true);
        setContainerContent('visit');
      }, 1000);

    } catch (error) {
      console.error('Error during purchase:', error);
      setPurchaseMessage('Purchase failed!');
      setTimeout(() => setPurchaseMessage(''), 2000);
    } finally {
      setPurchaseInProgress(false);
    }
  };

  // Add function to handle resting at lodge
  const handleRest = () => {
    if (restInProgress) return;
    if (playerGold >= 50) {
      setRestInProgress(true);
      setPurchaseMessage('Character is going to sleep...');
      
      setTimeout(() => {
        setPlayerGold(prev => prev - 50);
        setCurrentStats(prev => ({ ...prev, hp: prev.maxHp }));
        setCurrentStamina(characterStats.stamina);
        setCurrentHunger(100);
        
        // Add 6 hours to game time
        setGameTime(prevTime => {
          let newHours = (prevTime.hours + 6) % 24;
          return {
            hours: newHours,
            minutes: prevTime.minutes
          };
        });

        // Update time of day based on new hours
        setTimeOfDay(prevTime => {
          const newHours = (prevTime.hours + 6) % 24;
          return (newHours >= 18 || newHours < 6) ? 'night' : 'day';
        });
        
        // Show completion message with formatted time
        const newHours = (gameTime.hours + 6) % 24;
        const timeString = `${String(newHours).padStart(2, '0')}:${String(gameTime.minutes).padStart(2, '0')}`;
        setPurchaseMessage(`Rest complete. Time is now ${timeString}`);
        
        // Clear message after 2 seconds
        setTimeout(() => {
          setPurchaseMessage('');
          setRestInProgress(false);
          setShowLodge(false);
          setShowVisitMenu(true);
          setContainerContent('visit');
        }, 2000);
      }, 1500);
    } else {
      setPurchaseMessage('Not enough gold to rest!');
      setTimeout(() => setPurchaseMessage(''), 2000);
    }
  };

  const handleUseItem = (item) => {
    if (!item) return;
    
    let effectMessage = '';
    
    // Update stats based on item type and stats
    if (item.type === 'food' || item.type === 'consumable' || item.type === 'material') {
      // Apply HP effect
      if (item.stats?.hp) {
        setCurrentStats(prev => {
          const newHp = Math.min(prev.maxHp, prev.hp + item.stats.hp);
          return { ...prev, hp: newHp };
        });
        effectMessage += `+${item.stats.hp} HP `;
      }

      // Apply hunger effect (food and some materials)
      if (item.stats?.hunger) {
        setCurrentHunger(prev => Math.min(100, prev + item.stats.hunger));
        effectMessage += `+${item.stats.hunger} Hunger `;
      }

      // Apply stamina effect
      if (item.stats?.stamina) {
        setCurrentStamina(prev => Math.min(characterStats.stamina, prev + item.stats.stamina));
        effectMessage += `+${item.stats.stamina} Stamina `;
      }

      // Apply mana effect
      if (item.stats?.mp) {
        setCurrentStats(prev => ({
          ...prev,
          mp: Math.min(prev.maxMp || 100, (prev.mp || 0) + item.stats.mp)
        }));
        effectMessage += `+${item.stats.mp} MP `;
      }

      // Keep timed bonuses separate from permanent/equipment stats. Loading a
      // save ends food buffs and clears their timers, rather than making them permanent.
      for (const stat of ['damage', 'speed']) {
        if (!item.stats?.[stat]) continue;
        const bonus = item.stats[stat];
        setTemporaryBonuses(previous => ({ ...previous, [stat]: previous[stat] + bonus }));
        effectMessage += `+${bonus} ${stat} `;
        const timer = setTimeout(() => {
          setTemporaryBonuses(previous => ({ ...previous, [stat]: Math.max(0, previous[stat] - bonus) }));
          temporaryBuffTimers.current = temporaryBuffTimers.current.filter(id => id !== timer);
        }, 300000);
        temporaryBuffTimers.current.push(timer);
      }

      // Remove item from inventory
      const newInventory = [...inventory.main];
      const itemIndex = newInventory.findIndex(i => i === item);
      if (itemIndex !== -1) {
        if (item.count > 1) {
          newInventory[itemIndex] = {
            ...item,
            count: item.count - 1
          };
        } else {
          newInventory[itemIndex] = null;
        }
        setInventory({
          ...inventory,
          main: newInventory
        });
      }

      // Show effect message
      setUseItemMessage(`Used ${item.name}: ${effectMessage}`);
      setTimeout(() => setUseItemMessage(''), 2000);
    }
    
    setSelectedItem(null);
  };

  const handleLoadGame = (savedData) => {
    const { characterStats, obtainedRelics, inventory, position } = savedData;
    const restored = savedData.worldState;
    temporaryBuffTimers.current.forEach(clearTimeout);
    temporaryBuffTimers.current = [];
    setTemporaryBonuses({ damage: 0, speed: 0 });
    previousContextStats.current = characterStats;
    legacyMaxHp.current = characterStats.maxHp ?? characterStats.hp;
    setCharacterStats(characterStats);
    setObtainedRelics(obtainedRelics);
    setInventory(inventory);
    setPosition(position);
    setCameraPosition(cameraForPosition(position));
    setCurrentLocation(locationManager.checkLocation(position.x, position.y));
    closeLocationPanels();
    releaseMovement();
    setShowSaveLoadMenu(false);
    setIsPaused(false);
    // Older saves have no worldState; restore their original base-stat format.
    const slots = restored?.equipmentSlots ?? { helmet: null, bodyArmor: null, weapon: null, shield: null };
    setEquipmentSlots(slots);
    const restoredBonuses = calculateEquipmentBonuses(slots);
    setEquipmentBonuses(restoredBonuses);
    setCurrentStats({ ...(restored?.currentStats ?? {
      ...characterStats, defense: characterStats.armor,
      maxHp: characterStats.maxHp ?? characterStats.hp
    }), damage: characterStats.damage + restoredBonuses.damage,
      defense: characterStats.armor + restoredBonuses.defense, speed: characterStats.speed
    });
    setCurrentStamina(restored?.currentStamina ?? characterStats.stamina);
    setCurrentHunger(restored?.currentHunger ?? characterStats.hunger);
    setPlayerGold(restored?.playerGold ?? characterStats.gold);
    setBattleProgress(restored?.battleProgress ?? { xp: 0, victories: 0 });
  };

  return (
    <WorldContainer>
      <Header>
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Elendor - {playerName}</span>
        <BattleLaunchButton onClick={startBattle}
          disabled={isPaused || showMap || showBattle || restInProgress || purchaseInProgress || currentStats.hp <= 0}
          title={currentStats.hp <= 0 ? 'Rest at a lodge to restore HP before battle' : 'Choose a turn-based encounter'}>
          Battle
        </BattleLaunchButton>
      </Header>
      <GameArea>
        <MapFrame ref={mapFrameRef} data-testid="map-frame">
          <LocationNotification $show={currentLocation !== null}>
            {currentLocation}
          </LocationNotification>
          <GameplayContainer $scale={viewportScale} data-testid="gameplay-viewport">
            <ViewportContainer>
              <ViewportFrame>
                <MapContainer>
                  <Map 
                    data-testid="world-map"
                    $cameraX={cameraPosition.x}
                    $cameraY={cameraPosition.y}
                    style={{
                      backgroundImage: `url('/assets/map/Elendor.png')`
                    }}
                  >
                    <DayNightOverlay 
                      $isNight={isNight}
                      style={{ backgroundImage: `url('/assets/map/ElendorNight.png')` }}
                    />
                    {position && (
                    <Character
                      data-testid="player"
                      ref={characterRef}
                      x={position.x}
                      y={position.y}
                      style={{
                        backgroundImage: `url("${getCharacterSprite()}")`,
                      }}
                    />
                    )}
                    {showDebug && position && (
                      <CollisionDebugBox
                        x={position.x + COLLISION_OFFSET.x}
                        y={position.y + COLLISION_OFFSET.y}
                      />
                    )}
                  </Map>
                </MapContainer>
              </ViewportFrame>
            </ViewportContainer>
          </GameplayContainer>
        
        <ContainerShown data-testid="game-panels" $isVisible={Boolean(showInventory || showDetailedStats || (showVisitMenu && currentLocation) || showShop || showLodge || showDialog || showQuest)}>
          {showInventory && (
            <MenuPanel 
              data-testid="inventory-panel"
              $isVisible={showInventory} 
              $isStacked={showDetailedStats || showVisitMenu || showShop || showLodge || showDialog}
              style={{ order: containerContent === 'inventory' ? 0 : 1 }}
            >
              <CloseButton aria-label="Close inventory panel" onClick={() => {
                setShowInventory(false);
              }}>×</CloseButton>
              <InventoryTitle>Inventory</InventoryTitle>
              
              {useItemMessage && (
                <div style={{
                  padding: '10px',
                  margin: '10px',
                  textAlign: 'center',
                  color: '#4CAF50',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: '5px'
                }}>
                  {useItemMessage}
                </div>
              )}
              
              <ArmorAndPlayerSection>
                <ArmorGrid>
                  {Object.entries(equipmentSlots).map(([slotName, item], index) => (
                    <InventorySlot 
                      key={`armor-${index}`}
                      onClick={() => handleSlotClick('armor', index)}
                    >
                      {item && (
                        <>
                          <span style={{ fontSize: '24px' }}>{item.icon}</span>
                          {item.durability < 100 && (
                            <DurabilityBar $durability={item.durability} />
                          )}
                          <ItemTooltip>
                            {item.name}
                            {item.durability < 100 && ` (${item.durability}%)`}
                            {item.stats && Object.entries(item.stats).map(([stat, value]) => {
                              let displayStat = stat;
                              switch(stat) {
                                case 'damage':
                                  displayStat = 'Damage';
                                  break;
                                case 'defense':
                                  displayStat = 'Defense';
                                  break;
                                case 'hp':
                                  displayStat = 'HP';
                                  break;
                                default:
                                  displayStat = stat.charAt(0).toUpperCase() + stat.slice(1);
                              }
                              return <div key={stat}>{displayStat}: +{value}</div>;
                            })}
                          </ItemTooltip>
                        </>
                      )}
                    </InventorySlot>
                  ))}
                </ArmorGrid>

                <PlayerPreview>
                  <img src={getCharacterSprite()} alt="Player" />
                </PlayerPreview>
              </ArmorAndPlayerSection>

              <InventoryGrid>
                {inventory.main.map((item, index) => (
                  <InventorySlot 
                    key={`main-${index}`}
                    onClick={() => handleSlotClick('main', index)}
                  >
                    {item && (
                      <>
                        <span style={{ fontSize: '24px' }}>{item.icon}</span>
                        {item.count > 1 && <ItemCount>{item.count}</ItemCount>}
                        {item.durability < 100 && (
                          <DurabilityBar $durability={item.durability} />
                        )}
                        <ItemTooltip>
                          {item.name}
                          {item.durability < 100 && ` (${item.durability}%)`}
                          {item.stats && Object.entries(item.stats).map(([stat, value]) => {
                            let displayStat = stat;
                            switch(stat) {
                              case 'damage':
                                displayStat = 'Damage';
                                break;
                              case 'defense':
                                displayStat = 'Defense';
                                break;
                              case 'hp':
                                displayStat = 'HP';
                                break;
                              default:
                                displayStat = stat.charAt(0).toUpperCase() + stat.slice(1);
                            }
                            return <div key={stat}>{displayStat}: +{value}</div>;
                          })}
                        </ItemTooltip>
                        {selectedItem === item && (
                          <ItemPopup>
                            {Object.keys(equipmentSlots).map(slotName => (
                              canEquipInSlot(item, slotName) && (
                                <PopupButton 
                                  key={slotName}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleEquipItem(item, slotName);
                                  }}
                                >
                                  Equip as {slotName}
                                </PopupButton>
                              )
                            ))}
                            {(item.type === 'food' || item.type === 'consumable' || (item.type === 'material' && item.stats)) && (
                              <PopupButton
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleUseItem(item);
                                }}
                              >
                                Use
                              </PopupButton>
                            )}
                            <PopupButton 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDiscardItem(item);
                              }}
                              style={{ color: '#ff4444' }}
                            >
                              Discard
                            </PopupButton>
                          </ItemPopup>
                        )}
                      </>
                    )}
                  </InventorySlot>
                ))}
              </InventoryGrid>
            </MenuPanel>
          )}
          
          {showDetailedStats && (
            <MenuPanel 
              data-testid="stats-panel"
              $isVisible={showDetailedStats} 
              $isStacked={showInventory || showVisitMenu || showShop || showLodge || showDialog}
              style={{ order: containerContent === 'stats' ? 0 : 1 }}
            >
              <CloseButton aria-label="Close stats panel" onClick={() => {
                setShowDetailedStats(false);
              }}>×</CloseButton>

              <CharacterHeader>
                <CharacterTitle>{playerName}</CharacterTitle>
                <CharacterSubtitle>{selectedCharacter.name} Class</CharacterSubtitle>
              </CharacterHeader>

              <RelicSection>
                <RelicTitle>Sacred Relics</RelicTitle>
                <RelicContainer>
                  {obtainedRelics.map((obtained, index) => (
                    <RelicBox 
                      key={index} 
                      $obtained={obtained}
                      title={`Relic ${index + 1}`}
                    />
                  ))}
                </RelicContainer>
              </RelicSection>

              <CharacterStatsSection>
                <StatRow>
                  <StatLabel>Battle rank</StatLabel>
                  <StatValue>{Math.min(10, 1 + Math.floor(battleProgress.xp / 100))} · {battleProgress.xp} XP</StatValue>
                </StatRow>
                <StatRow>
                  <StatLabel>Victories</StatLabel>
                  <StatValue>{battleProgress.victories}</StatValue>
                </StatRow>
              <StatRow>
                  <StatLabel>HP</StatLabel>
                  <StatValue>{currentStats.hp}/{currentStats.maxHp}</StatValue>
              </StatRow>
              
              <StatRow>
                  <StatLabel>Hunger</StatLabel>
                  <StatValue>{currentHunger}/100</StatValue>
              </StatRow>
              
              <StatRow>
                  <StatLabel>Stamina</StatLabel>
                  <StatValue>{currentStamina}/100</StatValue>
              </StatRow>

                <StatRow>
                  <StatLabel>Speed</StatLabel>
                  <StatValue>
                    {selectedCharacter.stats.speed === 2.5 ? 'Fast' : 'Normal'}
                  </StatValue>
                </StatRow>

                <StatRow>
                  <StatLabel>Damage</StatLabel>
                  <StatValue>{currentStats.damage}</StatValue>
                </StatRow>

                <StatRow>
                  <StatLabel>Defense</StatLabel>
                  <StatValue>{currentStats.defense}</StatValue>
                </StatRow>

                <StatRow>
                  <StatLabel>Gold</StatLabel>
                  <StatValue>{playerGold} G</StatValue>
                </StatRow>
              </CharacterStatsSection>
            </MenuPanel>
          )}

          {showVisitMenu && currentLocation && (
            <MenuPanel 
              data-testid="visit-panel"
              $isVisible={showVisitMenu} 
              $isStacked={showInventory || showDetailedStats || showShop || showLodge || showDialog}
              style={{ 
                order: containerContent === 'visit' ? 0 : 1,
                pointerEvents: 'auto',
                zIndex: containerContent === 'visit' ? 2 : 1
              }}
            >
              <CloseButton aria-label="Close location panel" onClick={() => {
                setShowVisitMenu(false);
              }}>×</CloseButton>
              <VisitMenuTitle>{currentLocation}</VisitMenuTitle>
              <VisitMenuDescription>
                {locationOptions[currentLocation]?.description}
              </VisitMenuDescription>
              <VisitOptionList>
                <VisitOption onClick={startBattle} disabled={currentStats.hp <= 0 || restInProgress || purchaseInProgress}>
                  <VisitOptionIcon aria-hidden="true">⚔</VisitOptionIcon>
                  Battle nearby enemies
                </VisitOption>
                {locationOptions[currentLocation]?.options.map((option, index) => (
                  <VisitOption
                    key={index}
                    onClick={option.action}
                    disabled={option.disabled}
                  >
                    <VisitOptionIcon>{option.icon}</VisitOptionIcon>
                    {option.label}
                  </VisitOption>
                ))}
              </VisitOptionList>
            </MenuPanel>
          )}

          {showShop && (
            <MenuPanel 
              data-testid="shop-panel"
              $isVisible={showShop} 
              $isStacked={showInventory || showDetailedStats || showVisitMenu || showLodge || showDialog}
              style={{ 
                order: containerContent === 'shop' ? 0 : 1,
                pointerEvents: 'auto',
                zIndex: containerContent === 'shop' ? 2 : 1
              }}
            >
              <CloseButton aria-label="Close shop panel" onClick={() => {
                setShowShop(false);
                setShowVisitMenu(true);
                setContainerContent('visit');
              }}>×</CloseButton>
              <VisitMenuTitle>
                {currentShop === 'hunting' && "Weapons Shop"}
                {currentShop === 'woodworking' && "Woodworking Tools Shop"}
                {currentShop === 'food' && "Forest Meat House"}
              </VisitMenuTitle>
              {purchaseMessage && (
                <div style={{
                  padding: '10px',
                  margin: '10px',
                  textAlign: 'center',
                  color: purchaseMessage.includes('successful') ? '#4CAF50' : '#f44336',
                  backgroundColor: 'rgba(0,0,0,0.5)',
                  borderRadius: '5px'
                }}>
                  {purchaseMessage}
                </div>
              )}
              <VisitOptionList>
                {shopItems[currentShop]?.map((item, index) => (
                  <VisitOption
                    key={index}
                    onClick={() => !purchaseInProgress && handleBuyItem(item)}
                    disabled={playerGold < item.price || purchaseInProgress}
                    style={{
                      opacity: purchaseInProgress ? 0.5 : 1,
                      cursor: purchaseInProgress ? 'not-allowed' : playerGold < item.price ? 'not-allowed' : 'pointer'
                    }}
                  >
                    <VisitOptionIcon>🏷️</VisitOptionIcon>
                    {item.name} - {item.price}G
                    {item.stats && (
                      <span style={{ marginLeft: '10px', fontSize: '0.8em', color: '#aaa' }}>
                        {Object.entries(item.stats).map(([stat, value]) => `${stat}: +${value}`).join(', ')}
                      </span>
                    )}
                  </VisitOption>
                ))}
              </VisitOptionList>
            </MenuPanel>
          )}

          {showLodge && (
            <MenuPanel 
              data-testid="lodge-panel"
              $isVisible={showLodge} 
              $isStacked={showInventory || showDetailedStats || showVisitMenu || showShop || showDialog}
              style={{ 
                order: containerContent === 'lodge' ? 0 : 1,
                pointerEvents: 'auto',
                zIndex: containerContent === 'lodge' ? 2 : 1
              }}
            >
              <CloseButton aria-label="Close lodge panel" onClick={() => {
                setShowLodge(false);
                setShowVisitMenu(true);
                setContainerContent('visit');
              }}>×</CloseButton>
              <VisitMenuTitle>Wooden Lodge Inn</VisitMenuTitle>
              <VisitMenuDescription>
                Rest and recover your health, stamina, and hunger (50G)
              </VisitMenuDescription>
              <VisitOption
                onClick={handleRest}
                disabled={playerGold < 50 || restInProgress}
              >
                <VisitOptionIcon>🛏️</VisitOptionIcon>
                Rest - 50G
              </VisitOption>
            </MenuPanel>
          )}

          {showDialog && (
            <MenuPanel 
              data-testid="dialog-panel"
              $isVisible={showDialog} 
              $isStacked={showInventory || showDetailedStats || showVisitMenu || showShop || showLodge}
              style={{ 
                order: containerContent === 'dialog' ? 0 : 1,
                pointerEvents: 'auto',
                zIndex: containerContent === 'dialog' ? 2 : 1
              }}
            >
              <CloseButton aria-label="Close conversation panel" onClick={() => {
                setShowDialog(false);
                setShowVisitMenu(true);
                setContainerContent('visit');
              }}>×</CloseButton>
              <VisitMenuTitle>Elf Advisor</VisitMenuTitle>
              <VisitMenuDescription>{dialogContent?.greeting}</VisitMenuDescription>
              <VisitOptionList>
                {dialogContent?.tips.map((tip, index) => (
                  <div key={index} style={{ padding: '10px', color: '#d4af37' }}>
                    {tip}
                  </div>
                ))}
                <div style={{ padding: '10px', color: '#ffd700', fontStyle: 'italic' }}>
                  {dialogContent?.farewell}
                </div>
              </VisitOptionList>
            </MenuPanel>
          )}

          {showQuest && (
            <MenuPanel 
              data-testid="quest-panel"
              $isVisible={showQuest} 
              $isStacked={showInventory || showDetailedStats || showVisitMenu || showShop || showLodge || showDialog}
              style={{ 
                order: containerContent === 'quest' ? 0 : 1,
                pointerEvents: 'auto',
                zIndex: containerContent === 'quest' ? 2 : 1
              }}
            >
              <CloseButton aria-label="Close quest panel" onClick={() => {
                setShowQuest(false);
                setShowVisitMenu(true);
                setContainerContent('visit');
              }}>×</CloseButton>
              <QuestDialog 
                location={currentLocation}
                onDamage={damage => setCurrentStats(stats => ({ ...stats, hp: Math.max(0, stats.hp - damage) }))}
                onClose={() => {
                  setShowQuest(false);
                  setShowVisitMenu(true);
                  setContainerContent('visit');
                }}
                onComplete={handleQuestComplete}
              />
            </MenuPanel>
          )}
        </ContainerShown>
        </MapFrame>

        <UIContainer data-testid="game-hud">
          <StatsPanel>
            <TimeDisplay>
              {String(gameTime.hours).padStart(2, '0')}:{String(gameTime.minutes).padStart(2, '0')}
            </TimeDisplay>
            <div>
              <div>HP</div>
              <StatBar value={(currentStats.hp / currentStats.maxHp) * 100} color="#ff4444" />
            </div>
            <div>
              <div>Hunger</div>
              <StatBar value={(currentHunger / 100) * 100} color="#ffaa44" />
            </div>
            <div>
              <div>Stamina</div>
              <StatBar value={(currentStamina / characterStats.stamina) * 100} color="#44ff44" />
            </div>
          </StatsPanel>

          <ControlsPanel>
            <MovementDPadContainer>
              <MovementDPadButton 
                className="up"
                aria-label="Move up"
                {...dPadHandlers('up')}
              >
                ↑
              </MovementDPadButton>
              <MovementDPadButton 
                className="left"
                aria-label="Move left"
                {...dPadHandlers('left')}
              >
                ←
              </MovementDPadButton>
              <DPadCenter />
              <MovementDPadButton 
                className="right"
                aria-label="Move right"
                {...dPadHandlers('right')}
              >
                →
              </MovementDPadButton>
              <MovementDPadButton 
                className="down"
                aria-label="Move down"
                {...dPadHandlers('down')}
              >
                ↓
              </MovementDPadButton>
            </MovementDPadContainer>

            <ActionButtonGrid>
              <ActionButtonWrapper>
                <ActionButton aria-label="Interact with location" onClick={() => {
                  if (currentLocation && !showVisitMenu) {
                    setShowVisitMenu(true);
                    setContainerContent('visit');
                  }
                }}>
                  E
                </ActionButton>
                <ButtonLabel>Interact</ButtonLabel>
              </ActionButtonWrapper>
              <ActionButtonWrapper>
                <ActionButton aria-label={showInventory ? 'Close inventory' : 'Open inventory'} onClick={() => {
                  if (showInventory) {
                    setShowInventory(false);
                  } else {
                    setShowInventory(true);
                    setContainerContent('inventory');
                  }
                }}>
                  I
                </ActionButton>
                <ButtonLabel>Inventory {showInventory ? '(ON)' : '(OFF)'}</ButtonLabel>
              </ActionButtonWrapper>
              <ActionButtonWrapper>
                <ActionButton aria-label={showDetailedStats ? 'Close stats' : 'Open stats'} onClick={() => {
                  if (showDetailedStats) {
                    setShowDetailedStats(false);
                  } else {
                    setShowDetailedStats(true);
                    setContainerContent('stats');
                  }
                }}>
                  T
                </ActionButton>
                <ButtonLabel>Stats {showDetailedStats ? '(ON)' : '(OFF)'}</ButtonLabel>
              </ActionButtonWrapper>
              <ActionButtonWrapper>
                <ActionButton aria-label="Toggle world map" onClick={() => setShowMap(prev => !prev)}>
                  M
                </ActionButton>
                <ButtonLabel>Map {showMap ? '(ON)' : '(OFF)'}</ButtonLabel>
              </ActionButtonWrapper>
              <ActionButtonWrapper>
                <ActionButton 
                  aria-label="Toggle running"
                  onClick={toggleRun}
                  className={isRunToggled ? 'active' : ''}
                  disabled={isSprintCooldown || currentStamina <= STAMINA_THRESHOLD}
                >
                  R
                  {isSprintCooldown && <CooldownOverlay $progress={100 - cooldownProgress} />}
                </ActionButton>
                <ButtonLabel>
                  Run {isRunToggled ? '(ON)' : '(OFF)'}
                  {isSprintCooldown && ` (${Math.ceil((SPRINT_COOLDOWN - (cooldownProgress / 100 * SPRINT_COOLDOWN)) / 1000)}s)`}
                </ButtonLabel>
              </ActionButtonWrapper>
              <ActionButtonWrapper>
                <ActionButton aria-label="Pause game" onClick={togglePause}>
                  P
                </ActionButton>
                <ButtonLabel>Pause</ButtonLabel>
              </ActionButtonWrapper>
            </ActionButtonGrid>
          </ControlsPanel>
        </UIContainer>



        <MapOverlay $show={showMap} />
        <MapPopup $show={showMap} role="dialog" aria-label="World map">
          <CloseMapButton aria-label="Close world map" onClick={() => setShowMap(false)}>×</CloseMapButton>
          <div className="map-container">
            <img src="/assets/map/ElendorCompass.png" alt="World Map" />
            {position && (
            <PlayerLocationMarker 
              data-testid="map-marker"
              $x={position.x}
              $y={position.y}
            />
            )}
          </div>
        </MapPopup>
      </GameArea>
      {showBattle && (
        <BattleDialog character={selectedCharacter} stats={{ ...currentStats, stamina: characterStats.stamina }}
          stamina={currentStamina} playerName={playerName} location={currentLocation || 'Elendor wilds'}
          level={Math.min(10, 1 + Math.floor(battleProgress.xp / 100))} onComplete={finishBattle} />
      )}
      {showGameCompletion && (
        <>
          <MapOverlay $show={true} />
          <GameCompletionPopup>
            <GameCompletionTitle>Selamat! Anda telah menyelesaikan Game!</GameCompletionTitle>
            <GameCompletionText>
              Anda telah berhasil mengumpulkan semua 8 Relik Suci dan membuka rahasia terbesar Elendor!
            </GameCompletionText>
            <GameCompletionText>
              Perjalanan Anda telah membuktikan bahwa Anda adalah pahlawan sejati yang memahami sejarah Indonesia.
            </GameCompletionText>
            <GameCompletionText>
              Total Gold yang dikumpulkan: {playerGold}
            </GameCompletionText>
            <GameCompletionText>
              Relik yang dikumpulkan:
              <ul style={{ textAlign: 'left', marginTop: '10px' }}>
                <li>Majapahit Relic - Kekuatan Kerajaan Terbesar Nusantara</li>
                <li>Kutai Relic - Warisan Kerajaan Hindu Tertua</li>
                <li>Sriwijaya Relic - Kejayaan Maritim Nusantara</li>
                <li>Mataram Kuno Relic - Peninggalan Budaya Jawa Kuno</li>
                <li>Samudra Pasai Relic - Cahaya Islam di Nusantara</li>
                <li>Demak Relic - Kesultanan Islam Tanah Jawa</li>
                <li>Mataram Islam Relic - Kejayaan Islam di Pulau Jawa</li>
                <li>Gowa-Tallo Relic - Kerajaan Maritim Sulawesi</li>
              </ul>
            </GameCompletionText>
            <GameCompletionButton onClick={handleExitToMainMenu}>
              Kembali ke Menu Utama
            </GameCompletionButton>
          </GameCompletionPopup>
        </>
      )}
      
      {isPaused && (
        <>
          <PauseOverlay />
          <PauseMenu
            onResume={togglePause}
            onRestart={handleRestart}
            onExit={handleExitToMainMenu}
            onSaveLoad={() => setShowSaveLoadMenu(true)}
          />
          {showSaveLoadMenu && (
            <SaveLoadMenu
              characterStats={characterStats}
              obtainedRelics={obtainedRelics}
              inventory={inventory}
              position={position}
              worldState={{ currentStats, currentStamina, currentHunger, playerGold, equipmentSlots, battleProgress }}
              onLoad={handleLoadGame}
              onClose={() => setShowSaveLoadMenu(false)}
              setUseItemMessage={setUseItemMessage}
            />
          )}
        </>
      )}
    </WorldContainer>
  );
};

export default World;
