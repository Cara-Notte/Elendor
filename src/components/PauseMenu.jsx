import React from 'react';
import styled from 'styled-components';

const PauseMenuContainer = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background-color: rgba(0, 0, 0, 0.9);
  padding: clamp(12px, 4vw, 32px);
  width: min(360px, calc(100vw - 24px));
  max-height: calc(100vh - 24px);
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  overscroll-behavior: contain;
  border-radius: 10px;
  border: 2px solid #ed2024;
  color: white;
  z-index: 999;
  display: flex;
  flex-direction: column;
  gap: 1rem;
  min-width: 200px;
`;

const PauseButton = styled.button`
  padding: 0.8rem 1.5rem;
  background-color: ${props => props.$color || '#2196F3'};
  color: white;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 1rem;
  transition: all 0.3s ease;

  &:hover {
    opacity: 0.9;
    transform: scale(1.02);
  }
`;

const PauseMenu = ({ onResume, onRestart, onExit, onSaveLoad }) => {
  return (
    <PauseMenuContainer role="dialog" aria-label="Pause menu">
      <h2 style={{ textAlign: 'center', color: '#ed2024', marginBottom: '1rem' }}>Game Paused</h2>
      <PauseButton onClick={onResume}>
        Resume Game
      </PauseButton>
      <PauseButton onClick={onSaveLoad} $color="#4CAF50">
        Save/Load Game
      </PauseButton>
      <PauseButton onClick={onRestart} $color="#FF9800">
        Restart Game
      </PauseButton>
      <PauseButton onClick={onExit} $color="#f44336">
        Exit to Main Menu
      </PauseButton>
    </PauseMenuContainer>
  );
};

export default PauseMenu;
