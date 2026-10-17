import React, { useState, useEffect, useCallback } from 'react';
import styled from 'styled-components';
import { useGame } from '../context/GameContext';

const QuestContainer = styled.div`
  padding: 20px;
  color: #ffd700;
`;

const QuestionContainer = styled.div`
  margin-bottom: 20px;
`;

const Question = styled.h3`
  color: #ffd700;
  margin-bottom: 15px;
`;

const OptionsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
`;

const Option = styled.button`
  background: rgba(139, 69, 19, 0.2);
  border: 1px solid #8b4513;
  padding: 10px;
  color: #d4af37;
  text-align: left;
  cursor: pointer;
  transition: all 0.2s ease;
  border-radius: 5px;

  &:hover {
    background: rgba(139, 69, 19, 0.4);
    transform: translateX(5px);
  }

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
    transform: none;
  }
`;

const WaveInfo = styled.div`
  color: #ffd700;
  margin-bottom: 15px;
  font-size: 1.2em;
  text-align: center;
`;

const ResultMessage = styled.div`
  color: ${props => props.$isCorrect ? '#4CAF50' : '#f44336'};
  text-align: center;
  margin: 15px 0;
  font-size: 1.2em;
`;

const questionsData = {
  'Lakers City': [
    {
      question: "Siapakah raja pertama Kerajaan Majapahit?",
      options: ["Raden Wijaya", "Hayam Wuruk", "Gajah Mada", "Ken Arok"],
      correctAnswer: 0,
      reward: 100,
      damage: 5
    },
    {
      question: "Pada tahun berapa Kerajaan Majapahit berdiri?",
      options: ["1293", "1350", "1400", "1478"],
      correctAnswer: 0,
      reward: 150,
      damage: 10
    },
    {
      question: "Siapa nama pendiri Kerajaan Singasari?",
      options: ["Ken Arok", "Ken Dedes", "Ken Umang", "Ken Angrok"],
      correctAnswer: 0,
      reward: 200,
      damage: 15
    },
    {
      question: "Apa nama kitab yang ditulis oleh Mpu Prapanca?",
      options: ["Negarakertagama", "Sutasoma", "Arjunawiwaha", "Pararaton"],
      correctAnswer: 0,
      reward: 250,
      damage: 20
    },
    {
      question: "Siapa patih yang terkenal dari Kerajaan Majapahit?",
      options: ["Gajah Mada", "Tribhuwana Tunggadewi", "Jayanegara", "Kertanegara"],
      correctAnswer: 0,
      reward: 300,
      damage: 25
    }
  ],
  'Woodville City': [
    {
      question: "Kerajaan Hindu tertua di Indonesia adalah...",
      options: ["Kutai", "Tarumanegara", "Sriwijaya", "Mataram Kuno"],
      correctAnswer: 0,
      reward: 100,
      damage: 5
    },
    {
      question: "Siapa raja Kutai yang pertama memeluk agama Hindu?",
      options: ["Mulawarman", "Aswawarman", "Kudungga", "Purnawarman"],
      correctAnswer: 2,
      reward: 150,
      damage: 10
    },
    {
      question: "Prasasti tertua di Indonesia ditemukan di...",
      options: ["Kutai", "Tarumanegara", "Sriwijaya", "Majapahit"],
      correctAnswer: 0,
      reward: 200,
      damage: 15
    },
    {
      question: "Kerajaan Kutai terletak di provinsi...",
      options: ["Kalimantan Timur", "Kalimantan Barat", "Kalimantan Selatan", "Kalimantan Utara"],
      correctAnswer: 0,
      reward: 250,
      damage: 20
    },
    {
      question: "Prasasti Yupa ditulis dalam bahasa...",
      options: ["Sanskerta", "Melayu Kuno", "Jawa Kuno", "Pallawa"],
      correctAnswer: 0,
      reward: 300,
      damage: 25
    }
  ],
  'Managarmr Central City': [
    {
      question: "Kerajaan Sriwijaya adalah kerajaan yang bercorak...",
      options: ["Buddha", "Hindu", "Islam", "Animisme"],
      correctAnswer: 0,
      reward: 100,
      damage: 5
    },
    {
      question: "Pusat Kerajaan Sriwijaya berada di...",
      options: ["Palembang", "Jambi", "Riau", "Bengkulu"],
      correctAnswer: 0,
      reward: 150,
      damage: 10
    },
    {
      question: "Kerajaan Sriwijaya mencapai puncak kejayaan pada masa raja...",
      options: ["Balaputradewa", "Dapunta Hyang", "Dharmasetu", "Dharanindra"],
      correctAnswer: 0,
      reward: 200,
      damage: 15
    },
    {
      question: "Sriwijaya dijuluki sebagai kerajaan maritim karena...",
      options: ["Menguasai perdagangan laut", "Memiliki armada laut terbesar", "Terletak di tepi laut", "Semua benar"],
      correctAnswer: 3,
      reward: 250,
      damage: 20
    },
    {
      question: "Prasasti yang menyebutkan sumpah calon prajurit Sriwijaya adalah...",
      options: ["Telaga Batu", "Kedukan Bukit", "Talang Tuwo", "Kota Kapur"],
      correctAnswer: 0,
      reward: 300,
      damage: 25
    }
  ],
  'Wheatlived Village': [
    {
      question: "Kerajaan Mataram Kuno didirikan oleh...",
      options: ["Sanjaya", "Samaratungga", "Pikatan", "Balitung"],
      correctAnswer: 0,
      reward: 100,
      damage: 5
    },
    {
      question: "Candi Borobudur dibangun pada masa dinasti...",
      options: ["Sailendra", "Sanjaya", "Isyana", "Warmadewa"],
      correctAnswer: 0,
      reward: 150,
      damage: 10
    },
    {
      question: "Prasasti Canggal menceritakan tentang...",
      options: ["Pendirian Mataram Kuno", "Pembangunan Borobudur", "Pembangunan Prambanan", "Perpindahan keraton"],
      correctAnswer: 0,
      reward: 200,
      damage: 15
    },
    {
      question: "Dinasti Sailendra menganut agama...",
      options: ["Buddha", "Hindu", "Islam", "Animisme"],
      correctAnswer: 0,
      reward: 250,
      damage: 20
    },
    {
      question: "Candi terbesar yang dibangun pada masa Mataram Kuno adalah...",
      options: ["Borobudur", "Prambanan", "Mendut", "Pawon"],
      correctAnswer: 0,
      reward: 300,
      damage: 25
    }
  ],
  'Fishmell Village': [
    {
      question: "Kerajaan Islam pertama di Indonesia adalah...",
      options: ["Samudra Pasai", "Demak", "Malaka", "Aceh"],
      correctAnswer: 0,
      reward: 100,
      damage: 5
    },
    {
      question: "Sultan pertama Kerajaan Samudra Pasai adalah...",
      options: ["Malik Al-Saleh", "Sultan Iskandar Muda", "Sultan Agung", "Sultan Hasanuddin"],
      correctAnswer: 0,
      reward: 150,
      damage: 10
    },
    {
      question: "Kerajaan Samudra Pasai terletak di...",
      options: ["Aceh", "Sumatera Utara", "Riau", "Sumatera Barat"],
      correctAnswer: 0,
      reward: 200,
      damage: 15
    },
    {
      question: "Samudra Pasai menjadi pusat penyebaran agama...",
      options: ["Islam", "Hindu", "Buddha", "Kristen"],
      correctAnswer: 0,
      reward: 250,
      damage: 20
    },
    {
      question: "Marco Polo pernah singgah di Samudra Pasai pada tahun...",
      options: ["1292", "1300", "1350", "1400"],
      correctAnswer: 0,
      reward: 300,
      damage: 25
    }
  ],
  'Stonedust Castle': [
    {
      question: "Kerajaan Demak didirikan oleh...",
      options: ["Raden Patah", "Sultan Trenggono", "Sunan Ampel", "Sunan Giri"],
      correctAnswer: 0,
      reward: 100,
      damage: 5
    },
    {
      question: "Masjid Agung Demak dibangun oleh...",
      options: ["Walisongo", "Raden Patah", "Sultan Trenggono", "Sunan Kalijaga"],
      correctAnswer: 0,
      reward: 150,
      damage: 10
    },
    {
      question: "Kerajaan Demak adalah kelanjutan dari kerajaan...",
      options: ["Majapahit", "Singasari", "Kediri", "Mataram"],
      correctAnswer: 0,
      reward: 200,
      damage: 15
    },
    {
      question: "Tokoh yang berperan dalam penyebaran Islam di Demak adalah...",
      options: ["Walisongo", "Syekh Siti Jenar", "Ki Ageng Selo", "Semua benar"],
      correctAnswer: 3,
      reward: 250,
      damage: 20
    },
    {
      question: "Kerajaan Demak mencapai puncak kejayaan pada masa...",
      options: ["Sultan Trenggono", "Raden Patah", "Pati Unus", "Sultan Hadlirin"],
      correctAnswer: 0,
      reward: 300,
      damage: 25
    }
  ],
  'Beautiful Harbor': [
    {
      question: "Kerajaan Mataram Islam didirikan oleh...",
      options: ["Panembahan Senopati", "Sultan Agung", "Amangkurat I", "Ki Ageng Pemanahan"],
      correctAnswer: 0,
      reward: 100,
      damage: 5
    },
    {
      question: "Perjanjian Giyanti tahun 1755 membagi Mataram menjadi...",
      options: ["Surakarta dan Yogyakarta", "Surakarta dan Mangkunegaran", "Yogyakarta dan Pakualaman", "Surakarta dan Demak"],
      correctAnswer: 0,
      reward: 150,
      damage: 10
    },
    {
      question: "Sultan Agung menyerang Batavia pada tahun...",
      options: ["1628", "1636", "1645", "1650"],
      correctAnswer: 0,
      reward: 200,
      damage: 15
    },
    {
      question: "Sistem kalender Jawa Islam diciptakan oleh...",
      options: ["Sultan Agung", "Panembahan Senopati", "Amangkurat I", "Sultan Hamengkubuwono I"],
      correctAnswer: 0,
      reward: 250,
      damage: 20
    },
    {
      question: "Pusat Kerajaan Mataram Islam pertama kali berada di...",
      options: ["Kotagede", "Plered", "Kartasura", "Surakarta"],
      correctAnswer: 0,
      reward: 300,
      damage: 25
    }
  ],
  'Wizard Tower': [
    {
      question: "Kerajaan Gowa-Tallo terletak di...",
      options: ["Sulawesi Selatan", "Sulawesi Tengah", "Sulawesi Utara", "Sulawesi Tenggara"],
      correctAnswer: 0,
      reward: 100,
      damage: 5
    },
    {
      question: "Sultan Hasanuddin mendapat gelar...",
      options: ["Ayam Jantan dari Timur", "Macan dari Timur", "Elang dari Timur", "Rajawali dari Timur"],
      correctAnswer: 0,
      reward: 150,
      damage: 10
    },
    {
      question: "Perjanjian Bongaya ditandatangani pada tahun...",
      options: ["1667", "1669", "1671", "1675"],
      correctAnswer: 1,
      reward: 200,
      damage: 15
    },
    {
      question: "Kerajaan Gowa-Tallo menerima Islam pada tahun...",
      options: ["1605", "1610", "1615", "1620"],
      correctAnswer: 0,
      reward: 250,
      damage: 20
    },
    {
      question: "Benteng pertahanan Kerajaan Gowa-Tallo adalah...",
      options: ["Benteng Rotterdam", "Benteng Vredeburg", "Benteng Marlborough", "Benteng Victoria"],
      correctAnswer: 0,
      reward: 300,
      damage: 25
    }
  ]
};

const QuestDialog = ({ location, onClose, onComplete, onDamage }) => {
  const { characterStats, setCharacterStats } = useGame();
  const [currentWave, setCurrentWave] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState(null);
  const [showResult, setShowResult] = useState(false);
  const [isCorrect, setIsCorrect] = useState(false);
  const [totalGold, setTotalGold] = useState(0);
  const [questComplete, setQuestComplete] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentQuestion = questionsData[location][currentWave];

  const processAnswer = useCallback(async (correct) => {
    if (correct) {
      if (currentWave >= 4) {
        setQuestComplete(true);
        onComplete();
      } else {
        setCurrentWave(wave => wave + 1);
      }
    }
    setShowResult(false);
    setSelectedAnswer(null);
    setIsProcessing(false);
  }, [currentWave, onComplete]);

  const handleAnswerSelect = useCallback(async (answerIndex) => {
    if (isProcessing || selectedAnswer !== null) {
      return;
    }

    setIsProcessing(true);
    setSelectedAnswer(answerIndex);
    
    const correct = answerIndex === currentQuestion.correctAnswer;
    setShowResult(true);
    setIsCorrect(correct);

    if (correct) {
      const newGold = currentQuestion.reward;
      setTotalGold(prev => prev + newGold);
      setCharacterStats({
        ...characterStats,
        gold: characterStats.gold + newGold
      });
    } else {
      const damage = currentQuestion.damage;
      if (onDamage) {
        onDamage(damage);
      } else {
        setCharacterStats({
          ...characterStats,
          hp: Math.max(0, characterStats.hp - damage)
        });
      }
    }

    // Wait for result animation
    await new Promise(resolve => setTimeout(resolve, 2000));
    await processAnswer(correct);
  }, [currentQuestion, isProcessing, selectedAnswer, characterStats, setCharacterStats, processAnswer, onDamage]);

  // Debug current wave changes
  useEffect(() => {
    console.log('Wave changed to:', currentWave);
  }, [currentWave]);

  return (
    <QuestContainer>
      {!questComplete ? (
        <>
          <WaveInfo>Gelombang {currentWave + 1}/5 | Gold diperoleh: {totalGold}</WaveInfo>
          <QuestionContainer>
            <Question>{currentQuestion.question}</Question>
            <OptionsContainer>
              {currentQuestion.options.map((option, index) => (
                <Option
                  key={`${currentWave}-${index}`}
                  onClick={() => !isProcessing && !selectedAnswer && handleAnswerSelect(index)}
                  disabled={isProcessing || selectedAnswer !== null}
                >
                  {String.fromCharCode(65 + index)}. {option}
                </Option>
              ))}
            </OptionsContainer>
          </QuestionContainer>
          {showResult && (
            <ResultMessage $isCorrect={isCorrect}>
              {isCorrect 
                ? `Benar! +${currentQuestion.reward} gold` 
                : `Salah! -${currentQuestion.damage} HP`}
            </ResultMessage>
          )}
        </>
      ) : (
        <div style={{ textAlign: 'center' }}>
          <h2>Selamat!</h2>
          <p>Anda telah menyelesaikan semua gelombang!</p>
          <p>Total gold yang diperoleh: {totalGold}</p>
        </div>
      )}
    </QuestContainer>
  );
};

export default QuestDialog;
