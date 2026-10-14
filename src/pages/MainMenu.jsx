import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import CharacterCard from '../components/CharacterCard';
import '../styles/MainMenu.css';
import { useGame } from '../context/GameContext';
import styled from 'styled-components';

const relics = [
  {
    id: 1,
    name: 'Celurit',
    image: '/assets/relic/Celurit.png',
    description: 'The Celurit (also known as clurit) is a traditional curved blade weapon originating from Madura, an island in East Java, Indonesia. It is often associated with the Madurese people and holds both cultural and symbolic significance.'
  },
  {
    id: 2,
    name: 'Gambus',
    image: '/assets/relic/Gambus.png',
    description: 'The Gambus is a traditional stringed instrument with roots in Middle Eastern music, but over centuries, it has evolved into a unique cultural expression in Indonesia and Malaysia — especially in regions with strong Islamic influence.'
  },
  {
    id: 3,
    name: 'Keris',
    image: '/assets/relic/Keris.png',
    description: 'The Keris is a traditional asymmetrical dagger from Indonesia, recognized for its distinctive wavy blade and deep spiritual symbolism. It is a revered cultural artifact with roots in ancient Javanese traditions.'
  },
  {
    id: 4,
    name: 'Kujang',
    image: '/assets/relic/Kujang.png',
    description: 'The Kujang is a traditional weapon from West Java, Indonesia, especially associated with the Sundanese people. With its unique, curved blade resembling a buffalo horn or sickle, the Kujang serves not only as a weapon but also as a symbol of wisdom, strength, and spiritual power.'
  },
  {
    id: 5,
    name: 'Parang',
    image: '/assets/relic/Parang.png',
    description: 'The Parang is a traditional bladed tool and weapon widely used across Indonesia, Malaysia, and the Philippines. In Indonesia, it\'s especially associated with rural and tribal communities, where it plays a vital role in daily life.'
  },
  {
    id: 6,
    name: 'Topeng Barong',
    image: '/assets/relic/Topeng-barong.png',
    description: 'The Topeng Barong is a traditional Balinese mask representing Barong, the king of spirits and a symbol of goodness in Balinese mythology. Barong is often depicted as a lion-like creature with a vibrant, elaborately decorated mask used in dramatic performances known as the Barong dance.'
  },
  {
    id: 7,
    name: 'Topeng Ondel',
    image: '/assets/relic/topeng-ondel.png',
    description: 'Ondel-Ondel is a large puppet figure and a key part of Betawi (native Jakarta) cultural performances. The Topeng (mask) on Ondel-Ondel represents protective spirits, traditionally used to ward off evil and bring blessings to the community.'
  },
  {
    id: 8,
    name: 'Wayang Gunungan',
    image: '/assets/relic/Wayang-gunungan.png',
    description: 'The Gunungan is a symbolic element in Wayang (shadow puppet) performances from Indonesia, especially Java and Bali. It represents the beginning and end of a story, and serves as a divider between scenes or worlds — the spiritual and the physical.'
  }
];

const CharacterDetailsExpanded = styled.div`
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  background: rgba(44, 24, 16, 0.95);
  border: 4px solid #8b4513;
  border-radius: 15px;
  padding: 50px clamp(12px, 4vw, 30px) 20px;
  color: #ffd700;
  z-index: 1001;
  width: min(680px, calc(100vw - 24px));
  min-width: 0;
  max-height: calc(100vh - 24px);
  max-height: calc(100dvh - 24px);
  overflow-y: auto;
  overscroll-behavior: contain;
  opacity: 0;
  transition: opacity 0.3s ease;
  
  &.show {
    opacity: 1;
  }
`;

const BackButton = styled.button`
  position: absolute;
  top: 20px;
  left: 20px;
  background: #2c1810;
  color: #ffd700;
  border: 2px solid #8b4513;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  font-family: 'MedievalSharp', cursive;
  z-index: 1001;
  transition: all 0.2s ease;

  &:hover {
    background: #3d2315;
    box-shadow: 0 0 10px rgba(255, 215, 0, 0.3);
  }
`;

const MainMenu = () => {
  const { setPlayerName: setGamePlayerName, setSelectedCharacter: setGameCharacter, setCharacterStats } = useGame();
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [showRules, setShowRules] = useState(false);
  const [showRelics, setShowRelics] = useState(false);
  const [selectedCharacter, setSelectedCharacter] = useState(0);
  const [playerName, setPlayerName] = useState('');
  const [selectedRelic, setSelectedRelic] = useState(null);
  const [currentTime, setCurrentTime] = useState(new Date());
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [showCharacterDetails, setShowCharacterDetails] = useState(false);
  const [flippedCard, setFlippedCard] = useState(false);
  const [backgroundImage, setBackgroundImage] = useState('');
  const [isChanging, setIsChanging] = useState(false);
  const [slideDirection, setSlideDirection] = useState('');
  const [isAnimating, setIsAnimating] = useState(false);
  const navigate = useNavigate();
  const menuRef = useRef(null);

  useEffect(() => {
    // Set initial background based on current time
    const hours = new Date().getHours();
    setBackgroundImage(hours >= 6 && hours < 18 ? '/assets/map/Elendor.png' : '/assets/map/ElendorNight.png');

    // Loading animation
    const progressInterval = setInterval(() => {
      setLoadingProgress(prev => {
        if (prev >= 100) {
          clearInterval(progressInterval);
          setTimeout(() => setIsLoading(false), 500);
          return 100;
        }
        return prev + 2;
      });
    }, 50);

    // Play intro audio
    const introAudio = document.getElementById('introAudio');
    if (introAudio) {
      introAudio.play().catch(() => {
        console.log('Audio autoplay was prevented');
      });
    }

    return () => {
      clearInterval(progressInterval);
    };
  }, []);

  useEffect(() => {
    const clockTimer = setInterval(() => {
      const newTime = new Date();
      setCurrentTime(newTime);
      
      // Update background based on time
      const hours = newTime.getHours();
      const minutes = newTime.getMinutes();
      const seconds = newTime.getSeconds();
      
      // Check for day/night transition
      if ((hours === 6 && minutes === 0 && seconds === 0) || 
          (hours === 18 && minutes === 0 && seconds === 0)) {
        const newBackground = hours === 6 ? '/assets/map/Elendor.png' : '/assets/map/ElendorNight.png';
        setBackgroundImage(newBackground);
      }
    }, 1000);

    return () => clearInterval(clockTimer);
  }, []);

  // Add click outside handler
  useEffect(() => {
    function handleClickOutside(event) {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const formatTime = (date) => {
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true
    });
  };

  const handlePrevCharacter = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setSlideDirection('slide-out-right');
    
    setTimeout(() => {
      setSelectedCharacter((prev) => (prev - 1 + characters.length) % characters.length);
      setSlideDirection('slide-in-right');
      
      setTimeout(() => {
        setSlideDirection('');
        setIsAnimating(false);
      }, 300);
    }, 300);
  };

  const handleNextCharacter = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setSlideDirection('slide-out-left');
    
    setTimeout(() => {
      setSelectedCharacter((prev) => (prev + 1) % characters.length);
      setSlideDirection('slide-in-left');
      
      setTimeout(() => {
        setSlideDirection('');
        setIsAnimating(false);
      }, 300);
    }, 300);
  };

  const handleCardFlip = (isFlipped) => {
    setFlippedCard(isFlipped);
  };

  const handleCharacterSelect = () => {
    setShowConfirmation(true);
  };

  const handleConfirmCharacter = () => {
    setShowConfirmation(false);
    setShowCharacterDetails(true);
  };

  const handleStartGame = () => {
    if (playerName.trim()) {
      const selectedChar = characters[selectedCharacter];
      const initialStats = { ...selectedChar.stats };

      // Apply character bonus
      switch (selectedChar.bonus.effect) {
        case 'hp':
          initialStats.hp += selectedChar.bonus.value;
          break;
        case 'armor':
          initialStats.armor = Math.round(initialStats.armor * (1 + selectedChar.bonus.value / 100));
          break;
        case 'speed':
          initialStats.speed = Math.round(initialStats.speed * (1 + selectedChar.bonus.value / 100));
          break;
        case 'stamina_regen':
          break;
      }

      // Update game context
      setGamePlayerName(playerName);
      setGameCharacter(selectedChar);
      setCharacterStats(initialStats);

      // Navigate to world
      navigate('/world');
    }
  };

  const characters = [
    { 
      name: 'Mage', 
      image: '/assets/MagePC/MageIdle/idle5.png',
      description: 'A powerful spellcaster from the Academy of Arcane Arts in Elendor. Specializes in elemental magic and can summon devastating area attacks. Weaker in physical combat but excels in solving ancient puzzles.',
      stats: {
        hp: 70,
        hunger: 80,
        stamina: 80,
        damage: 18,
        speed: 1,
        armor: 10,
        gold: 50
      },
      bonus: {
        stat: "Intelligence",
        description: "Magic studies grant +25 HP points",
        effect: "hp",
        value: 25
      }
    },
    { 
      name: 'Mercenary', 
      image: '/assets/MercenaryPC/MercenaryIdle/idle5.png',
      description: 'A battle-hardened warrior who has served in countless conflicts across the Archipelago. Excellent in melee combat with tremendous physical strength. Can withstand heavy damage and excels in close-quarter fights.',
      stats: {
        hp: 100,
        hunger: 75,
        stamina: 85,
        damage: 22,
        speed: 1,
        armor: 25,
        gold: 100
      },
      bonus: {
        stat: "Strength",
        description: "Combat training grants +15% damage resistance",
        effect: "armor",
        value: 15
      }
    },
    { 
      name: 'Ranger', 
      image: '/assets/RangerPC/RangerIdle/idle5.png',
      description: 'A skilled hunter from the forests of Eastern Elendor. Masters of stealth and ranged combat. Exceptional mobility allows them to traverse difficult terrain with ease. Keen survival instincts help track hidden treasures.',
      stats: {
        hp: 80,
        hunger: 90,
        stamina: 100,
        damage: 16,
        speed: 2.5,
        armor: 15,
        gold: 75
      },
      bonus: {
        stat: "Agility",
        description: "Wilderness skills grant +10% movement speed",
        effect: "speed",
        value: 10
      }
    },
    { 
      name: 'Soldier', 
      image: '/assets/SoldierPC/SoldierIdle/idle5.png',
      description: 'A disciplined warrior trained in the Royal Army of Elendor. Well-balanced in combat with strong defensive capabilities. Excellent endurance and tactical knowledge make them reliable in extended missions.',
      stats: {
        hp: 90,
        hunger: 100,
        stamina: 90,
        damage: 25,
        speed: 1,
        armor: 20,
        gold: 60
      },
      bonus: {
        stat: "Endurance",
        description: "Military training grants +20% stamina regeneration",
        effect: "stamina_regen",
        value: 20
      }
    }
  ];

  return (
    <div 
      className="main-menu-container" 
      style={{ 
        backgroundImage: `url(${backgroundImage})`,
        backgroundColor: '#000' // Fallback color while image loads
      }}
    >
      {isLoading ? (
        <div className="loading-screen">
          <div className="loading-content">
            <h1 className="loading-title">Elendor</h1>
            <div className="loading-progress">
              <div className="loading-bar-container">
                <div className="loading-line"></div>
                <div className="grow-line" style={{ width: `${loadingProgress}%` }}></div>
              </div>
              <div className="loading-percentage">{loadingProgress}%</div>
            </div>
            <div className="loading-tips">
              <p className="tip-text">
                {loadingProgress < 33 && "Loading game assets..."}
                {loadingProgress >= 33 && loadingProgress < 66 && "Preparing world of Elendor..."}
                {loadingProgress >= 66 && "Gathering ancient relics..."}
              </p>
            </div>
            <h3 className="loading-credits">Made by R.E.P.O</h3>
            <audio id="introAudio" src="/assets/sound/temp.mp3"></audio>
          </div>
          <div className="loading-decoration">
            <div className="decoration-line left"></div>
            <div className="decoration-line right"></div>
          </div>
        </div>
      ) : (
        <>
          <div className="navbar">
            <div className="menu-container" ref={menuRef}>
              <button 
                className={`menu-btn ${isMenuOpen ? 'active' : ''}`}
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                aria-label="Menu"
                aria-expanded={isMenuOpen}
              >
                ☰
              </button>
              <div className={`dropdown ${isMenuOpen ? 'show' : ''}`}>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  setShowRules(true);
                  setIsMenuOpen(false);
                }}>Read me</a>
                <a href="#" onClick={(e) => {
                  e.preventDefault();
                  setShowRelics(true);
                  setIsMenuOpen(false);
                }}>Relics</a>
              </div>
            </div>
          </div>

          <div id="clock">
            {formatTime(currentTime)}
          </div>

          {!showCharacterDetails && (
            <>
              <h1 className="selection-title">Choose Your Hero</h1>
              <div className="floating-card-container">
                <button 
                  className="nav-button" 
                  onClick={handlePrevCharacter}
                  disabled={isAnimating}
                >
                  <img src="/assets/Prevbtn.png" alt="Previous" />
                </button>
                
                <CharacterCard
                  character={characters[selectedCharacter]}
                  onClick={handleCharacterSelect}
                  className={slideDirection}
                />

                <button 
                  className="nav-button" 
                  onClick={handleNextCharacter}
                  disabled={isAnimating}
                >
                  <img src="/assets/Nextbtn.png" alt="Next" />
                </button>
              </div>
            </>
          )}

          {showRules && (
            <div className="rules-box show">
              <button 
                className="close-btn" 
                onClick={() => setShowRules(false)}
                aria-label="Close rules"
              >×</button>
              <h2 className="rules-title">Game Guide</h2>
              <ul>
                <li><b>• 1 minute in-game means 1 second in real life.</b></li>
                <li><b>• There are 7 statuses that you need to know, namely: HP, Hunger, Stamina, Attack, Speed, Armor, and Gold.</b></li>
                <li><b>• HP can be reduced and restored on many occassions during the game, but HP touches 0, you will die and forced to reset your progress.</b></li>
                <li><b>• Hunger will decrease overtime, keep your hunger bar high as otherwise it will start depeleting your HP.</b></li>
                <li><b>• There are 3 types of movement to move in this game, namely: WASD keys, On-screen D-pad, and Touch the map.</b></li>
                <li><b>• Press shift to run, but it will deplete your stamina bar.</b></li>
                <li><b>• Press M to open the map to figure out where you are.</b></li>
                <li><b>• Press E to interact with locations.</b></li>
                <li><b>• Press esc to open the pause menu.</b></li>
                <li><b>• The Actions D-pad is used for E(Interact), M(Map), R(Run), P(Pause), and S(Status).</b></li>
              </ul>
            </div>
          )}

          {showRelics && (
            <div className="Relic-box show">
              <button 
                className="closed-btn" 
                onClick={() => {
                  setShowRelics(false);
                  setSelectedRelic(null);
                }}
                aria-label="Close relics"
              >×</button>
              <h2 className="relic-title">Sacred Relics of Nusantara</h2>
              <div className="relic-grid">
                {relics.map((relic) => (
                  <div
                    key={relic.id}
                    className={`relic-card ${selectedRelic === relic.id ? 'selected' : ''}`}
                    onClick={() => setSelectedRelic(relic.id)}
                  >
                    <img src={relic.image} alt={relic.name} className="relic-thumbnail" />
                    <h3 className="relic-name">{relic.name}</h3>
                  </div>
                ))}
              </div>
              
              {selectedRelic && (
                <div className="relic-details show">
                  <div className="relic-image-container">
                    <img 
                      src={relics[selectedRelic - 1].image} 
                      alt={relics[selectedRelic - 1].name}
                      className="relic-image" 
                    />
                  </div>
                  <h3 className="relic-detail-name">{relics[selectedRelic - 1].name}</h3>
                  <p className="relic-description"><b>{relics[selectedRelic - 1].description}</b></p>
                </div>
              )}
            </div>
          )}

          {showConfirmation && (
            <div className="confirmation-popup show">
              <div className="confirmation-content">
                <h2 className="confirmation-title">Choose {characters[selectedCharacter].name}?</h2>
                <p>Are you sure you want to embark on your journey as a {characters[selectedCharacter].name}?</p>
                <div className="confirmation-buttons">
                  <button className="confirm-btn" onClick={handleConfirmCharacter}>Yes, I'm sure</button>
                  <button className="cancel-btn" onClick={() => setShowConfirmation(false)}>No, go back</button>
                </div>
              </div>
            </div>
          )}

          {showCharacterDetails && (
            <>
              <div className="character-details-backdrop show" />
              <CharacterDetailsExpanded className="show">
                <BackButton onClick={() => {
                  setShowCharacterDetails(false);
                  setShowConfirmation(false);
                }}>
                  ← Back
                </BackButton>
                <div className="character-header">
                  <h2 className="character-name">{characters[selectedCharacter].name}</h2>
                  <p className="character-description">{characters[selectedCharacter].description}</p>
                </div>

                <div className="character-info">
                  <div className="stats-section">
                    <h3 className="section-title">Character Stats</h3>
                    <div className="char-stats">
                      <div className="stat">
                        <span className="stat-label">HP</span>
                        <div className="stat-bar">
                          <div className="stat-fill" id="hp-fill" style={{ width: `${characters[selectedCharacter].stats.hp}%` }}></div>
                        </div>
                        <span className="stat-value">{characters[selectedCharacter].stats.hp}/100</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Hunger</span>
                        <div className="stat-bar">
                          <div className="stat-fill" id="hunger-fill" style={{ width: `${characters[selectedCharacter].stats.hunger}%` }}></div>
                        </div>
                        <span className="stat-value">{characters[selectedCharacter].stats.hunger}/100</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Stamina</span>
                        <div className="stat-bar">
                          <div className="stat-fill" id="stamina-fill" style={{ width: `${characters[selectedCharacter].stats.stamina}%` }}></div>
                        </div>
                        <span className="stat-value">{characters[selectedCharacter].stats.stamina}/100</span>
                      </div>
                      <div className="stat">
                        <span className="stat-label">Damage</span>
                        <div className="stat-bar">
                          <div className="stat-fill" id="damage-fill" style={{ width: `${characters[selectedCharacter].stats.damage * 4}%` }}></div>
                        </div>
                        <span className="stat-value">{characters[selectedCharacter].stats.damage}</span>
                      </div>
                      <div className="stat no-bar">
                        <span className="stat-label">Speed</span>
                        <span className="stat-value-large">
                          {characters[selectedCharacter].stats.speed === 2.5 ? 'Fast' : 'Normal'}
                        </span>
                      </div>
                      <div className="stat no-bar">
                        <span className="stat-label">Defense</span>
                        <span className="stat-value-large">{characters[selectedCharacter].stats.armor}</span>
                      </div>
                      <div className="stat no-bar">
                        <span className="stat-label">Gold</span>
                        <span className="stat-value-large">{characters[selectedCharacter].stats.gold} G</span>
                      </div>
                    </div>
                  </div>

                  <div className="char-bonus">
                    <h3 className="section-title">Special Trait: {characters[selectedCharacter].bonus.stat}</h3>
                    <p className="bonus-description">{characters[selectedCharacter].bonus.description}</p>
                  </div>
                </div>

                <div className="input-container">
                  <label htmlFor="playerName" className="input-label">Enter Your Name, Hero</label>
                  <input 
                    type="text" 
                    id="playerName"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    placeholder="Type your name here..."
                    className={!playerName.trim() ? 'empty' : ''}
                  />
                  <button 
                    id="startBtn" 
                    type="submit" 
                    onClick={handleStartGame}
                    disabled={!playerName.trim()}
                    className={!playerName.trim() ? 'disabled' : ''}
                  >
                    <b>Start Your Journey!</b>
                  </button>
                  {!playerName.trim() && (
                    <p className="input-warning">Please enter your name to begin the adventure</p>
                  )}
                </div>
              </CharacterDetailsExpanded>
            </>
          )}
        </>
      )}
    </div>
  );
};

export default MainMenu;
