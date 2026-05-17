import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────

const TOTAL_QUESTIONS = 10
const INITIAL_LIVES = 3

// Swiss Lehrplan 21: Cycle 1 = Grades 1-2 (up to 100), Cycle 2 = Grades 3-6 (up to 10 000+)
const GRADE = {
  1: {
    label: '1. Klasse',
    emoji: '🐣',
    mascot: '🐄',
    description: 'Zahlen bis 20',
    hint: 'Tippe auf die richtige Antwort!',
    color: '#E74C3C',
    colorLight: '#FADBD8',
    colorDark: '#C0392B',
    bg: 'linear-gradient(160deg, #FFECD2 0%, #FCB69F 100%)',
    cardBg: '#FFF8F5',
    maxNum: 20,
    mode: 'choice',
  },
  2: {
    label: '2. Klasse',
    emoji: '🐥',
    mascot: '🦋',
    description: 'Zahlen bis 100',
    hint: 'Tippe auf die richtige Antwort!',
    color: '#E67E22',
    colorLight: '#FDEBD0',
    colorDark: '#CA6F1E',
    bg: 'linear-gradient(160deg, #FDE8D8 0%, #F5CBA7 100%)',
    cardBg: '#FFF9F5',
    maxNum: 100,
    mode: 'choice',
  },
  3: {
    label: '3. Klasse',
    emoji: '🌱',
    mascot: '🦫',
    description: 'Zahlen bis 1 000',
    hint: 'Tippe die Antwort ein und drücke ✓!',
    color: '#27AE60',
    colorLight: '#D5F5E3',
    colorDark: '#1E8449',
    bg: 'linear-gradient(160deg, #D5F5E3 0%, #ABEBC6 100%)',
    cardBg: '#F0FFF5',
    maxNum: 1000,
    mode: 'input',
  },
  4: {
    label: '4. Klasse',
    emoji: '🏕️',
    mascot: '🦌',
    description: 'Zahlen bis 10 000',
    hint: 'Tippe die Antwort ein und drücke ✓!',
    color: '#8E44AD',
    colorLight: '#E8DAEF',
    colorDark: '#6C3483',
    bg: 'linear-gradient(160deg, #E8DAEF 0%, #D2B4DE 100%)',
    cardBg: '#FAF0FF',
    maxNum: 10000,
    mode: 'input',
  },
  5: {
    label: '5. Klasse',
    emoji: '🦅',
    mascot: '🏔️',
    description: 'Zahlen bis 100 000',
    hint: 'Tippe die Antwort ein und drücke ✓!',
    color: '#2980B9',
    colorLight: '#D6EAF8',
    colorDark: '#1A5276',
    bg: 'linear-gradient(160deg, #A8EDEA 0%, #7EC8E3 100%)',
    cardBg: '#F0F8FF',
    maxNum: 100000,
    mode: 'input',
  },
}

// ─────────────────────────────────────────────────────────────
//  MATH ENGINE  (Lehrplan 21 aligned)
// ─────────────────────────────────────────────────────────────

// Lehrplan 21 aligned number ranges per grade
const GRADE_RANGES = {
  1: { addMax: 10,    sumMax: 20,     minMin: 6,     minMax: 20,     spread: 4   },
  2: { addMax: 50,    sumMax: 100,    minMin: 20,    minMax: 100,    spread: 8   },
  3: { addMax: 500,   sumMax: 1000,   minMin: 200,   minMax: 1000,   spread: 40  },
  4: { addMax: 5000,  sumMax: 10000,  minMin: 2000,  minMax: 10000,  spread: 300 },
  5: { addMax: 50000, sumMax: 100000, minMin: 20000, minMax: 100000, spread: 2000},
}

function generateQ(grade) {
  const isAdd = Math.random() > 0.5
  const r = GRADE_RANGES[grade]
  if (isAdd) {
    const a = Math.floor(Math.random() * r.addMax) + 1
    const maxB = r.sumMax - a
    const b = Math.floor(Math.random() * Math.min(r.addMax, maxB)) + 1
    return { a, b, op: '+', answer: a + b }
  } else {
    const a = Math.floor(Math.random() * (r.minMax - r.minMin)) + r.minMin
    const b = Math.floor(Math.random() * (a - 1)) + 1
    return { a, b, op: '−', answer: a - b }
  }
}

function makeChoices(correct, grade) {
  const spread = GRADE_RANGES[grade].spread
  const pool = new Set([correct])
  let tries = 0
  while (pool.size < 4 && tries < 120) {
    tries++
    const delta = Math.floor(Math.random() * (spread * 2 + 1)) - spread
    const v = correct + delta
    if (v >= 0 && v !== correct) pool.add(v)
  }
  return [...pool].sort(() => Math.random() - 0.5)
}

function buildQuestions(grade) {
  return Array.from({ length: TOTAL_QUESTIONS }, () => {
    const q = generateQ(grade)
    if (GRADE[grade].mode === 'choice') q.choices = makeChoices(q.answer, grade)
    return q
  })
}

// ─────────────────────────────────────────────────────────────
//  AUDIO  (Web Audio API – simple beeps)
// ─────────────────────────────────────────────────────────────

function beep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const play = (freq, t, dur, vol = 0.22, wave = 'sine') => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = wave
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = freq
      gain.gain.setValueAtTime(vol, ctx.currentTime + t)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur)
      osc.start(ctx.currentTime + t)
      osc.stop(ctx.currentTime + t + dur)
    }
    if (type === 'correct') {
      play(523, 0, 0.12); play(659, 0.1, 0.12); play(784, 0.2, 0.22)
    } else if (type === 'wrong') {
      play(300, 0, 0.1, 0.2, 'sawtooth'); play(220, 0.12, 0.22, 0.2, 'sawtooth')
    } else if (type === 'win') {
      ;[523, 659, 784, 1047].forEach((f, i) => play(f, i * 0.14, 0.28))
    } else if (type === 'streak') {
      play(700, 0, 0.08); play(900, 0.1, 0.12); play(1100, 0.22, 0.16)
    } else if (type === 'click') {
      play(440, 0, 0.06, 0.1)
    }
  } catch (_) { /* audio blocked by browser */ }
}

// ─────────────────────────────────────────────────────────────
//  HELPER COMPONENTS
// ─────────────────────────────────────────────────────────────

function Lives({ count }) {
  return (
    <div className="lives">
      {[1, 2, 3].map(i => (
        <span key={i} className={i <= count ? 'heart-on' : 'heart-off'}>
          {i <= count ? '❤️' : '🖤'}
        </span>
      ))}
    </div>
  )
}

function ProgressBar({ current, total, color }) {
  return (
    <div className="progress-bar">
      <div
        className="progress-fill"
        style={{ width: `${(current / total) * 100}%`, background: color }}
      />
    </div>
  )
}

function Stars({ count }) {
  return (
    <div className="stars-row">
      {[1, 2, 3].map(i => (
        <span
          key={i}
          className={`star-icon ${i <= count ? 'star-lit' : 'star-dim'}`}
          style={i <= count ? { animationDelay: `${(i - 1) * 0.2}s` } : {}}
        >
          ★
        </span>
      ))}
    </div>
  )
}

function Confetti({ show }) {
  const pieces = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        left: `${Math.random() * 100}%`,
        color: ['#DC143C','#FFD700','#4ECDC4','#45B7D1','#FF6B6B','#96CEB4','#FFEAA7','#DDA0DD'][i % 8],
        dur: `${0.9 + Math.random() * 1.4}s`,
        delay: `${Math.random() * 0.6}s`,
        size: `${7 + Math.random() * 7}px`,
        round: Math.random() > 0.5,
      })),
    []
  )
  if (!show) return null
  return (
    <div className="confetti-stage">
      {pieces.map((p, i) => (
        <div
          key={i}
          className="confetti-bit"
          style={{
            left: p.left,
            backgroundColor: p.color,
            animationDuration: p.dur,
            animationDelay: p.delay,
            width: p.size,
            height: p.size,
            borderRadius: p.round ? '50%' : '2px',
          }}
        />
      ))}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  WELCOME SCREEN
// ─────────────────────────────────────────────────────────────

function WelcomeScreen({ onSelect }) {
  return (
    <div className="screen welcome-screen">
      <div className="welcome-sky">
        <div className="cloud cloud-1">☁️</div>
        <div className="cloud cloud-2">☁️</div>
        <div className="cloud cloud-3">☁️</div>
      </div>

      <div className="welcome-header">
        <div className="logo-mountain">🏔️</div>
        <h1 className="app-title">MathAlps</h1>
        <p className="app-sub">Das Mathe-Abenteuer der Schweiz</p>
        <div className="swiss-flags">🇨🇭 &nbsp; 🇨🇭</div>
      </div>

      <div className="mountains-bg">
        <svg viewBox="0 0 480 120" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <polygon points="0,120 80,20 160,120" fill="#5C9470" />
          <polygon points="60,120 180,0 300,120" fill="#4A7C59" />
          <polygon points="200,120 310,30 420,120" fill="#3A6349" />
          <polygon points="340,120 420,50 480,120" fill="#5C9470" />
          <polygon points="160,120 220,55 280,120" fill="#FFFFFF" opacity="0.4" />
          <polygon points="255,120 310,60 365,120" fill="#FFFFFF" opacity="0.35" />
        </svg>
      </div>

      <p className="choose-label">Wer möchte spielen?</p>

      <div className="grade-cards">
        {[1, 2, 3, 4, 5].map(g => {
          const cfg = GRADE[g]
          return (
            <button
              key={g}
              className="grade-card"
              onClick={() => { beep('click'); onSelect(g) }}
              style={{ '--c': cfg.color, '--cl': cfg.colorLight }}
            >
              <span className="grade-mascot">{cfg.mascot}</span>
              <div className="grade-text">
                <strong>{cfg.label}</strong>
                <span>{cfg.description}</span>
              </div>
              <div className="grade-badge" style={{ background: cfg.color }}>
                {cfg.emoji}
              </div>
            </button>
          )
        })}
      </div>

      <p className="welcome-footer">
        Lehrplan 21 · Addition &amp; Subtraktion
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  GAME SCREEN
// ─────────────────────────────────────────────────────────────

function GameScreen({
  grade, questions, currentQ, score, lives, streak,
  feedback, inputValue, onChoice, onInput, onSubmit, onKeyDown,
}) {
  const cfg = GRADE[grade]
  const q = questions[currentQ]
  const inputRef = useRef(null)

  useEffect(() => {
    if (cfg.mode === 'input' && !feedback && inputRef.current) {
      inputRef.current.focus()
    }
  }, [currentQ, feedback, cfg.mode])

  if (!q) return null

  return (
    <div className="screen game-screen" style={{ background: cfg.bg }}>
      {/* ── Header ── */}
      <div className="game-header">
        <Lives count={lives} />
        <div className="q-counter">
          <span className="q-cur">{currentQ + 1}</span>
          <span className="q-sep">/</span>
          <span className="q-tot">{TOTAL_QUESTIONS}</span>
        </div>
        <div className="score-pill" style={{ color: cfg.color }}>
          ⭐ {score}
        </div>
      </div>

      <ProgressBar current={currentQ + (feedback ? 1 : 0)} total={TOTAL_QUESTIONS} color={cfg.color} />

      {/* ── Streak badge ── */}
      {streak >= 3 && (
        <div className="streak-badge">
          🔥 {streak}× Kombo! {streak >= 5 ? '🚀' : ''}
        </div>
      )}

      {/* ── Question card ── */}
      <div
        className={[
          'question-card',
          feedback === 'correct' ? 'q-correct' : '',
          feedback === 'wrong' ? 'q-wrong' : '',
        ].join(' ')}
        style={{ background: cfg.cardBg }}
      >
        <span className="q-mascot">{cfg.mascot}</span>

        <div className="question-expr">
          <span className="q-num">{q.a}</span>
          <span className="q-op" style={{ color: cfg.color }}>{q.op}</span>
          <span className="q-num">{q.b}</span>
          <span className="q-op" style={{ color: cfg.color }}>=</span>
          <span className="q-blank">?</span>
        </div>

        {feedback && (
          <div className={`feedback-strip ${feedback === 'correct' ? 'fs-correct' : 'fs-wrong'}`}>
            {feedback === 'correct'
              ? `✓ Super! +${streak >= 3 ? 20 : 10} Punkte${streak >= 3 ? ' 🔥' : ''}`
              : `✗ Richtig: ${q.answer}`}
          </div>
        )}
      </div>

      {/* ── Answer area ── */}
      {cfg.mode === 'choice' ? (
        <div className="choices-grid">
          {q.choices.map((ch, i) => (
            <button
              key={i}
              className={[
                'choice-btn',
                feedback && ch === q.answer ? 'ch-correct' : '',
                feedback && ch !== q.answer ? 'ch-dim' : '',
              ].join(' ')}
              style={{ '--cc': cfg.color, '--ccl': cfg.colorLight }}
              onClick={() => !feedback && onChoice(ch)}
              disabled={!!feedback}
            >
              {ch}
            </button>
          ))}
        </div>
      ) : (
        <div className="input-row">
          <input
            ref={inputRef}
            type="number"
            className="answer-input"
            style={{ '--ic': cfg.color }}
            value={inputValue}
            onChange={e => onInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="?"
            disabled={!!feedback}
          />
          <button
            className="submit-btn"
            style={{ background: cfg.color }}
            onClick={onSubmit}
            disabled={!!feedback || inputValue === ''}
          >
            ✓
          </button>
        </div>
      )}

      <p className="hint">{cfg.hint}</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  RESULT SCREEN
// ─────────────────────────────────────────────────────────────

function ResultScreen({ grade, score, correct, lives, onReplay, onHome }) {
  const cfg = GRADE[grade]
  const starCount = correct >= 9 ? 3 : correct >= 7 ? 2 : correct >= 4 ? 1 : 0
  const survived = lives > 0

  const headline =
    starCount === 3 ? ['Ausgezeichnet! 🎉', 'Perfekt! 🏆', 'Fantastisch! 🌟'][Math.floor(Math.random() * 3)]
    : starCount === 2 ? ['Sehr gut! 👏', 'Gut gemacht! 💪', 'Weiter so! 🎯'][Math.floor(Math.random() * 3)]
    : starCount === 1 ? ['Gut versucht! 🤗', 'Üb weiter! 📚', 'Fast! 🌈'][Math.floor(Math.random() * 3)]
    : 'Nicht aufgeben! 💙'

  return (
    <div className="screen result-screen" style={{ background: cfg.bg }}>
      <Confetti show={starCount === 3 && survived} />

      <div className="result-mascot">{cfg.mascot}</div>
      <h2 className="result-headline">{headline}</h2>

      <Stars count={starCount} />

      <div className="result-stats">
        <div className="stat-tile">
          <span className="stat-lbl">Richtig</span>
          <span className="stat-val" style={{ color: '#27AE60' }}>
            {correct} / {TOTAL_QUESTIONS}
          </span>
        </div>
        <div className="stat-tile">
          <span className="stat-lbl">Punkte</span>
          <span className="stat-val" style={{ color: cfg.color }}>⭐ {score}</span>
        </div>
        <div className="stat-tile">
          <span className="stat-lbl">Leben</span>
          <span className="stat-val">{['💔','❤️','❤️❤️','❤️❤️❤️'][Math.max(0, lives)]}</span>
        </div>
      </div>

      {starCount < 3 && (
        <p className="result-tip">
          {correct < 4
            ? `Schau dir ${cfg.label} Mathe nochmal an – du schaffst das! 💪`
            : `Noch ein bisschen üben und du bekommst 3 Sterne! ⭐⭐⭐`}
        </p>
      )}

      <div className="result-actions">
        <button
          className="btn-primary"
          style={{ background: cfg.color }}
          onClick={() => { beep('click'); onReplay() }}
        >
          🔄 Nochmal spielen
        </button>
        <button className="btn-secondary" onClick={() => { beep('click'); onHome() }}>
          🏠 Spieler wechseln
        </button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  MAIN APP
// ─────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState('welcome')   // welcome | game | result
  const [grade, setGrade] = useState(null)
  const [questions, setQuestions] = useState([])
  const [currentQ, setCurrentQ] = useState(0)
  const [score, setScore] = useState(0)
  const [lives, setLives] = useState(INITIAL_LIVES)
  const [streak, setStreak] = useState(0)
  const [correct, setCorrect] = useState(0)
  const [feedback, setFeedback] = useState(null)    // null | 'correct' | 'wrong'
  const [inputValue, setInputValue] = useState('')

  const timer = useRef(null)

  const startGame = useCallback((g) => {
    clearTimeout(timer.current)
    setGrade(g)
    setQuestions(buildQuestions(g))
    setCurrentQ(0)
    setScore(0)
    setLives(INITIAL_LIVES)
    setStreak(0)
    setCorrect(0)
    setFeedback(null)
    setInputValue('')
    setScreen('game')
  }, [])

  // advance to next question or result screen after feedback delay
  const advance = useCallback((isCorrect, nextLives, nextCorrect) => {
    timer.current = setTimeout(() => {
      setFeedback(null)
      setInputValue('')
      const nextQ = currentQ + 1
      if (nextLives <= 0 || nextQ >= TOTAL_QUESTIONS) {
        if (isCorrect && nextQ >= TOTAL_QUESTIONS) beep('win')
        setScreen('result')
      } else {
        setCurrentQ(nextQ)
      }
    }, 1300)
  }, [currentQ])

  const handleAnswer = useCallback((raw) => {
    if (feedback) return
    clearTimeout(timer.current)

    const answer = parseInt(raw, 10)
    const q = questions[currentQ]
    const isCorrect = answer === q.answer

    if (isCorrect) {
      const newStreak = streak + 1
      const pts = newStreak >= 3 ? 20 : 10
      if (newStreak === 3 || newStreak === 5 || newStreak === 7) beep('streak')
      else beep('correct')
      setStreak(newStreak)
      setScore(s => s + pts)
      setCorrect(c => {
        advance(true, lives, c + 1)
        return c + 1
      })
      setFeedback('correct')
    } else {
      beep('wrong')
      const newLives = lives - 1
      setStreak(0)
      setLives(newLives)
      setFeedback('wrong')
      advance(false, newLives, correct)
    }
  }, [feedback, questions, currentQ, streak, lives, correct, advance])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Enter' && inputValue !== '') handleAnswer(inputValue)
  }, [inputValue, handleAnswer])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className="app-root">
      {screen === 'welcome' && (
        <WelcomeScreen onSelect={startGame} />
      )}
      {screen === 'game' && grade && questions.length > 0 && (
        <GameScreen
          grade={grade}
          questions={questions}
          currentQ={currentQ}
          score={score}
          lives={lives}
          streak={streak}
          feedback={feedback}
          inputValue={inputValue}
          onChoice={handleAnswer}
          onInput={setInputValue}
          onSubmit={() => inputValue !== '' && handleAnswer(inputValue)}
          onKeyDown={handleKeyDown}
        />
      )}
      {screen === 'result' && grade && (
        <ResultScreen
          grade={grade}
          score={score}
          correct={correct}
          lives={lives}
          onReplay={() => startGame(grade)}
          onHome={() => setScreen('welcome')}
        />
      )}
    </div>
  )
}
