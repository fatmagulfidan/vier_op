import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import './App.css'

// ─────────────────────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────────────────────

const TOTAL_QUESTIONS = 10
const INITIAL_LIVES    = 3

// ─────────────────────────────────────────────────────────────
//  GRADE CONFIG
// ─────────────────────────────────────────────────────────────

const GRADE = {
  1: { label: '1. Klasse', emoji: '🐣', mascot: '🐄', description: 'Zahlen bis 20',      color: '#E74C3C', colorLight: '#FADBD8', bg: 'linear-gradient(160deg,#FFECD2,#FCB69F)', cardBg: '#FFF8F5', mode: 'choice' },
  2: { label: '2. Klasse', emoji: '🐥', mascot: '🦋', description: 'Zahlen bis 100',     color: '#E67E22', colorLight: '#FDEBD0', bg: 'linear-gradient(160deg,#FDE8D8,#F5CBA7)', cardBg: '#FFF9F5', mode: 'choice' },
  3: { label: '3. Klasse', emoji: '🌱', mascot: '🦫', description: 'Zahlen bis 1 000',   color: '#27AE60', colorLight: '#D5F5E3', bg: 'linear-gradient(160deg,#D5F5E3,#ABEBC6)', cardBg: '#F0FFF5', mode: 'input'  },
  4: { label: '4. Klasse', emoji: '🏕️', mascot: '🦌', description: 'Zahlen bis 10 000',  color: '#8E44AD', colorLight: '#E8DAEF', bg: 'linear-gradient(160deg,#E8DAEF,#D2B4DE)', cardBg: '#FAF0FF', mode: 'input'  },
  5: { label: '5. Klasse', emoji: '🦅', mascot: '🏔️', description: 'Zahlen bis 100 000', color: '#2980B9', colorLight: '#D6EAF8', bg: 'linear-gradient(160deg,#A8EDEA,#7EC8E3)', cardBg: '#F0F8FF', mode: 'input'  },
}

// Grade-1 exercise modes (Schweizer Zahlenbuch 1 / Lehrplan 21)
const EXERCISE_MODES = {
  basic: {
    label: 'Rechnen',
    desc: 'Plus und Minus',
    emoji: '🧮',
    color: '#E74C3C',
    hint: 'Welche Antwort ist richtig?',
  },
  zahlenmauer: {
    label: 'Zahlenmauer',
    desc: 'Oberer Stein = Summe der unteren',
    emoji: '🧱',
    color: '#8E44AD',
    hint: 'Welcher Stein fehlt?',
  },
  zahlenhaus: {
    label: 'Zahlenhaus',
    desc: 'Zwei Zahlen ergeben das Dach',
    emoji: '🏠',
    color: '#E67E22',
    hint: 'Was gehört ins Haus?',
  },
}

// ─────────────────────────────────────────────────────────────
//  MATH ENGINE   (Lehrplan 21 aligned)
// ─────────────────────────────────────────────────────────────

const RANGES = {
  1: { addMax: 10,    sumMax: 20,     minMin: 6,     minMax: 20,     spread: 4    },
  2: { addMax: 50,    sumMax: 100,    minMin: 20,    minMax: 100,    spread: 8    },
  3: { addMax: 500,   sumMax: 1000,   minMin: 200,   minMax: 1000,   spread: 40   },
  4: { addMax: 5000,  sumMax: 10000,  minMin: 2000,  minMax: 10000,  spread: 300  },
  5: { addMax: 50000, sumMax: 100000, minMin: 20000, minMax: 100000, spread: 2000 },
}

function rnd(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min }

function choices(correct, spread) {
  const pool = new Set([correct])
  let t = 0
  while (pool.size < 4 && t++ < 200) {
    const v = correct + rnd(-spread, spread)
    if (v >= 0 && v !== correct) pool.add(v)
  }
  return [...pool].sort(() => Math.random() - 0.5)
}

// Standard +/− question
function basicQ(grade) {
  const r = RANGES[grade]
  if (Math.random() > 0.5) {
    const a = rnd(1, r.addMax)
    const b = rnd(1, Math.min(r.addMax, r.sumMax - a))
    return { type: 'basic', a, b, op: '+', answer: a + b }
  } else {
    const a = rnd(r.minMin, r.minMax)
    const b = rnd(1, a - 1)
    return { type: 'basic', a, b, op: '−', answer: a - b }
  }
}

// Zahlenmauer: 3-stone base → 2 middle → 1 top
function zahlenmauernQ() {
  // small numbers so sums stay ≤ 20
  const base = [rnd(1, 5), rnd(1, 5), rnd(1, 5)]
  const mid  = [base[0] + base[1], base[1] + base[2]]
  const top  = mid[0] + mid[1]

  // All 6 stone positions; pick one to hide
  const all = [
    { layer: 0, idx: 0, val: base[0] },
    { layer: 0, idx: 1, val: base[1] },
    { layer: 0, idx: 2, val: base[2] },
    { layer: 1, idx: 0, val: mid[0]  },
    { layer: 1, idx: 1, val: mid[1]  },
    { layer: 2, idx: 0, val: top     },
  ]
  const m = all[rnd(0, 5)]
  return {
    type: 'zahlenmauer',
    base, mid, top,
    missing: m,
    answer: m.val,
    choices: choices(m.val, 3),
  }
}

// Zahlenhaus: roof number split into 3 floor pairs
function zahlenhausQ() {
  const roof = rnd(6, 12)  // needs ≥3 distinct pairs

  // All pairs (i, roof−i) with i ≤ roof−i
  const pairs = []
  for (let i = 1; i <= Math.floor(roof / 2); i++) pairs.push([i, roof - i])
  pairs.sort(() => Math.random() - 0.5)
  const floors = pairs.slice(0, 3).map(([l, r]) => ({ left: l, right: r }))

  // One floor, one side missing
  const fi = rnd(0, floors.length - 1)
  const hideRight = Math.random() > 0.5
  const ans = hideRight ? floors[fi].right : floors[fi].left

  return {
    type: 'zahlenhaus',
    roof, floors,
    questionFloor: fi,
    hideRight,
    answer: ans,
    choices: choices(ans, 3),
  }
}

function buildQuestions(grade, mode) {
  if (grade !== 1 || mode === 'basic') {
    return Array.from({ length: TOTAL_QUESTIONS }, () => {
      const q = basicQ(grade)
      if (GRADE[grade].mode === 'choice') q.choices = choices(q.answer, RANGES[grade].spread)
      return q
    })
  }
  const gen = mode === 'zahlenmauer' ? zahlenmauernQ : zahlenhausQ
  return Array.from({ length: TOTAL_QUESTIONS }, gen)
}

// ─────────────────────────────────────────────────────────────
//  AUDIO
// ─────────────────────────────────────────────────────────────

function beep(type) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const play = (freq, t, dur, vol = 0.22, wave = 'sine') => {
      const osc = ctx.createOscillator(), g = ctx.createGain()
      osc.type = wave; osc.connect(g); g.connect(ctx.destination)
      osc.frequency.value = freq
      g.gain.setValueAtTime(vol, ctx.currentTime + t)
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + t + dur)
      osc.start(ctx.currentTime + t); osc.stop(ctx.currentTime + t + dur)
    }
    if (type === 'correct') { play(523,0,.12); play(659,.1,.12); play(784,.2,.22) }
    else if (type === 'wrong') { play(300,0,.1,.2,'sawtooth'); play(220,.12,.22,.2,'sawtooth') }
    else if (type === 'win') { [523,659,784,1047].forEach((f,i) => play(f,i*.14,.28)) }
    else if (type === 'streak') { play(700,0,.08); play(900,.1,.12); play(1100,.22,.16) }
    else if (type === 'click') { play(440,0,.06,.1) }
  } catch(_) {}
}

// ─────────────────────────────────────────────────────────────
//  SHARED COMPONENTS
// ─────────────────────────────────────────────────────────────

function Lives({ count }) {
  return (
    <div className="lives">
      {[1,2,3].map(i =>
        <span key={i} className={i <= count ? 'heart-on' : 'heart-off'}>
          {i <= count ? '❤️' : '🖤'}
        </span>
      )}
    </div>
  )
}

function ProgressBar({ pct, color }) {
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

function Stars({ count }) {
  return (
    <div className="stars-row">
      {[1,2,3].map(i =>
        <span key={i} className={`star-icon ${i <= count ? 'star-lit' : 'star-dim'}`}
          style={i <= count ? { animationDelay: `${(i-1)*.2}s` } : {}}>★</span>
      )}
    </div>
  )
}

function Confetti({ show }) {
  const pieces = useMemo(() =>
    Array.from({ length: 60 }, (_, i) => ({
      left: `${Math.random()*100}%`,
      color: ['#DC143C','#FFD700','#4ECDC4','#45B7D1','#FF6B6B','#96CEB4','#FFEAA7','#DDA0DD'][i%8],
      dur: `${.9+Math.random()*1.4}s`, delay: `${Math.random()*.6}s`,
      size: `${7+Math.random()*7}px`, round: Math.random()>.5,
    })), [])
  if (!show) return null
  return (
    <div className="confetti-stage">
      {pieces.map((p,i) =>
        <div key={i} className="confetti-bit" style={{
          left: p.left, backgroundColor: p.color,
          animationDuration: p.dur, animationDelay: p.delay,
          width: p.size, height: p.size, borderRadius: p.round?'50%':'2px',
        }}/>
      )}
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  ZAHLENMAUER  (Number Wall)
// ─────────────────────────────────────────────────────────────

function Zahlenmauer({ q, feedback }) {
  const { base, mid, top, missing } = q

  const show = (layer, idx) => {
    if (missing.layer === layer && missing.idx === idx) return null
    return layer === 0 ? base[idx] : layer === 1 ? mid[idx] : top
  }

  const Stone = ({ layer, idx }) => {
    const val = show(layer, idx)
    const isEmpty = val === null
    return (
      <div className={`stone ${isEmpty ? 'stone-empty' : ''} ${feedback && isEmpty ? `stone-fb-${feedback}` : ''}`}>
        {isEmpty ? '?' : val}
      </div>
    )
  }

  return (
    <div className="zahlenmauer">
      <div className="zm-row">
        <Stone layer={2} idx={0}/>
      </div>
      <div className="zm-row">
        <Stone layer={1} idx={0}/>
        <Stone layer={1} idx={1}/>
      </div>
      <div className="zm-row">
        <Stone layer={0} idx={0}/>
        <Stone layer={0} idx={1}/>
        <Stone layer={0} idx={2}/>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  ZAHLENHAUS  (Number House)
// ─────────────────────────────────────────────────────────────

function Zahlenhaus({ q, feedback }) {
  const { roof, floors, questionFloor, hideRight } = q

  return (
    <div className="zahlenhaus">
      {/* Roof */}
      <div className="zh-roof">
        <div className="zh-roof-triangle"/>
        <span className="zh-roof-num">{roof}</span>
      </div>
      {/* Floors */}
      <div className="zh-body">
        {floors.map((fl, i) => {
          const isQ = i === questionFloor
          return (
            <div key={i} className={`zh-floor ${isQ ? 'zh-floor-active' : ''}`}>
              <div className={`zh-cell ${isQ && !hideRight ? `zh-empty ${feedback ? `zh-fb-${feedback}` : ''}` : ''}`}>
                {isQ && !hideRight ? '?' : fl.left}
              </div>
              <div className="zh-divider"/>
              <div className={`zh-cell ${isQ && hideRight ? `zh-empty ${feedback ? `zh-fb-${feedback}` : ''}` : ''}`}>
                {isQ && hideRight ? '?' : fl.right}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  WELCOME SCREEN
// ─────────────────────────────────────────────────────────────

function WelcomeScreen({ onSelect }) {
  return (
    <div className="screen welcome-screen">
      {/* Animated sky */}
      <div className="sky">
        {[1,2,3,4].map(i => <span key={i} className={`cloud c${i}`}>☁️</span>)}
      </div>

      <div className="welcome-top">
        <div className="app-mountain">🏔️</div>
        <h1 className="app-title">MathAlps</h1>
        <p className="app-tagline">Das Mathe-Abenteuer der Schweiz 🇨🇭</p>
      </div>

      {/* SVG mountain silhouette */}
      <div className="mountain-scene">
        <svg viewBox="0 0 480 130" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none">
          <polygon points="0,130 90,18 180,130"  fill="#5C9470"/>
          <polygon points="70,130 200,0 330,130"  fill="#3A6349"/>
          <polygon points="220,130 330,28 440,130" fill="#4A7C59"/>
          <polygon points="360,130 430,55 480,130" fill="#5C9470"/>
          {/* Snow caps */}
          <polygon points="160,130 200,50 240,130"  fill="#fff" opacity=".5"/>
          <polygon points="275,130 330,58 385,130"  fill="#fff" opacity=".45"/>
          {/* Ground */}
          <rect x="0" y="118" width="480" height="12" fill="#3A6349"/>
        </svg>
      </div>

      <p className="choose-label">Welche Klasse bist du? 👇</p>

      <div className="grade-cards">
        {[1,2,3,4,5].map(g => {
          const c = GRADE[g]
          return (
            <button key={g} className="grade-card" onClick={() => { beep('click'); onSelect(g) }}
              style={{ '--gc': c.color, '--gl': c.colorLight }}>
              <span className="gc-mascot">{c.mascot}</span>
              <div className="gc-info">
                <strong>{c.label}</strong>
                <span>{c.description}</span>
              </div>
              <div className="gc-chip" style={{ background: c.color }}>{c.emoji}</div>
            </button>
          )
        })}
      </div>

      <p className="footer-note">Lehrplan 21 · Addition &amp; Subtraktion</p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  MODE SELECT  (Grade 1 only)
// ─────────────────────────────────────────────────────────────

function ModeSelectScreen({ onSelect, onBack }) {
  return (
    <div className="screen mode-screen">
      <button className="back-btn" onClick={() => { beep('click'); onBack() }}>← Zurück</button>

      <div className="mode-mascot-wrap">
        <span className="mode-big-mascot">🐄</span>
        <div className="speech-bubble">Was möchtest du üben?</div>
      </div>

      <p className="mode-grade-label">1. Klasse · Zahlen bis 20</p>

      <div className="mode-cards">
        {Object.entries(EXERCISE_MODES).map(([key, m]) => (
          <button key={key} className="mode-card" onClick={() => { beep('click'); onSelect(key) }}
            style={{ '--mc': m.color }}>
            <span className="mc-emoji">{m.emoji}</span>
            <div className="mc-text">
              <strong>{m.label}</strong>
              <span>{m.desc}</span>
            </div>
            <span className="mc-arrow">→</span>
          </button>
        ))}
      </div>

      {/* Quick explanations */}
      <div className="mode-tips">
        <div className="tip-box">
          <span>🧱</span>
          <p>Oberer Stein = linker + rechter Stein</p>
        </div>
        <div className="tip-box">
          <span>🏠</span>
          <p>Alle Paare im Haus ergeben die Dach-Zahl</p>
        </div>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  GAME SCREEN
// ─────────────────────────────────────────────────────────────

function GameScreen({ grade, exerciseMode, questions, currentQ, score, lives, streak, feedback, inputValue, onChoice, onInput, onSubmit, onKeyDown, onExit }) {
  const cfg   = GRADE[grade]
  const q     = questions[currentQ]
  const iRef  = useRef(null)
  const modeCfg = EXERCISE_MODES[exerciseMode] || {}

  useEffect(() => {
    if (cfg.mode === 'input' && !feedback && iRef.current) iRef.current.focus()
  }, [currentQ, feedback, cfg.mode])

  if (!q) return null

  const isChoice = q.type !== 'basic' || cfg.mode === 'choice'

  return (
    <div className="screen game-screen" style={{ background: cfg.bg }}>

      {/* ─ Header ─ */}
      <div className="game-header">
        <button className="exit-btn" onClick={onExit} title="Beenden">🏠</button>
        <div className="qcount">
          <span className="qc-now">{currentQ+1}</span>
          <span className="qc-sep">/</span>
          <span className="qc-tot">{TOTAL_QUESTIONS}</span>
        </div>
        <div className="score-chip" style={{ color: cfg.color }}>⭐ {score}</div>
      </div>
      <Lives count={lives}/>

      <ProgressBar pct={((currentQ + (feedback?1:0)) / TOTAL_QUESTIONS) * 100} color={cfg.color}/>

      {streak >= 3 && (
        <div className="streak-badge">
          🔥 {streak}× Kombo! {streak >= 5 ? '🚀' : streak >= 7 ? '⚡' : ''}
        </div>
      )}

      {/* ─ Question card ─ */}
      <div className={`question-card ${feedback==='correct'?'qc-correct':feedback==='wrong'?'qc-wrong':''}`}
        style={{ background: cfg.cardBg }}>

        <div className="qc-top">
          <span className="qc-mascot">{cfg.mascot}</span>
          {exerciseMode !== 'basic' && (
            <span className="qc-mode-badge" style={{ background: modeCfg.color }}>
              {modeCfg.emoji} {modeCfg.label}
            </span>
          )}
        </div>

        {q.type === 'basic' && (
          <div className="basic-expr">
            <span className="be-num">{q.a}</span>
            <span className="be-op" style={{ color: cfg.color }}>{q.op}</span>
            <span className="be-num">{q.b}</span>
            <span className="be-op" style={{ color: cfg.color }}>=</span>
            <span className="be-blank">?</span>
          </div>
        )}

        {q.type === 'zahlenmauer' && <Zahlenmauer q={q} feedback={feedback}/>}
        {q.type === 'zahlenhaus'  && <Zahlenhaus  q={q} feedback={feedback}/>}

        {feedback && (
          <div className={`fb-strip ${feedback==='correct'?'fb-ok':'fb-err'}`}>
            {feedback === 'correct'
              ? `✓ Richtig! +${streak>=3?20:10} Punkte${streak>=3?' 🔥':''}`
              : `✗ Richtig wäre: ${q.answer}`}
          </div>
        )}
      </div>

      {/* ─ Answer area ─ */}
      {isChoice ? (
        <div className="choices-grid">
          {q.choices.map((ch,i) => (
            <button key={i}
              className={`choice-btn ${feedback&&ch===q.answer?'cb-correct':''} ${feedback&&ch!==q.answer?'cb-dim':''}`}
              style={{ '--cc': cfg.color }}
              onClick={() => !feedback && onChoice(ch)}
              disabled={!!feedback}>
              {ch}
            </button>
          ))}
        </div>
      ) : (
        <div className="input-row">
          <input ref={iRef} type="number" className="ans-input" style={{ '--ic': cfg.color }}
            value={inputValue} onChange={e => onInput(e.target.value)}
            onKeyDown={onKeyDown} placeholder="?" disabled={!!feedback}/>
          <button className="ans-submit" style={{ background: cfg.color }}
            onClick={onSubmit} disabled={!!feedback||!inputValue}>✓</button>
        </div>
      )}

      <p className="game-hint">
        {q.type==='basic' ? (isChoice ? 'Tippe auf die richtige Antwort!' : 'Tippe die Antwort ein!') :
         q.type==='zahlenmauer' ? '🧱 Welcher Stein fehlt in der Mauer?' :
         '🏠 Was gehört ins Haus? (links + rechts = Dach)'}
      </p>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  RESULT SCREEN
// ─────────────────────────────────────────────────────────────

function ResultScreen({ grade, exerciseMode, score, correct, lives, onReplay, onHome }) {
  const cfg = GRADE[grade]
  const stars = correct >= 9 ? 3 : correct >= 7 ? 2 : correct >= 4 ? 1 : 0
  const MSGS = {
    3: ['Ausgezeichnet! 🎉','Perfekt! 🏆','Fantastisch! 🌟'],
    2: ['Sehr gut! 👏','Gut gemacht! 💪','Weiter so! 🎯'],
    1: ['Gut versucht! 🤗','Üb weiter! 📚','Fast! 🌈'],
    0: ['Nicht aufgeben! 💙','Nochmal versuchen! 🌱','Du schaffst das! 🤝'],
  }
  const msg = MSGS[stars][rnd(0, 2)]

  return (
    <div className="screen result-screen" style={{ background: cfg.bg }}>
      <Confetti show={stars===3 && lives>0}/>

      <div className="rs-mascot">{cfg.mascot}</div>
      <h2 className="rs-msg">{msg}</h2>
      <Stars count={stars}/>

      <div className="result-stats">
        <div className="stat-tile">
          <span className="st-lbl">Richtig</span>
          <span className="st-val" style={{ color:'#27AE60' }}>{correct}/{TOTAL_QUESTIONS}</span>
        </div>
        <div className="stat-tile">
          <span className="st-lbl">Punkte</span>
          <span className="st-val" style={{ color: cfg.color }}>⭐ {score}</span>
        </div>
        <div className="stat-tile">
          <span className="st-lbl">Leben</span>
          <span className="st-val">{['💔','❤️','❤️❤️','❤️❤️❤️'][Math.max(0,lives)]}</span>
        </div>
      </div>

      {stars < 3 && (
        <p className="rs-tip">
          {correct < 4
            ? 'Üb weiter – du schaffst das! 💪'
            : 'Noch ein bisschen mehr und du bekommst 3 Sterne! ⭐⭐⭐'}
        </p>
      )}

      <div className="result-actions">
        <button className="btn-primary" style={{ background: cfg.color }}
          onClick={() => { beep('click'); onReplay() }}>🔄 Nochmal spielen</button>
        <button className="btn-secondary"
          onClick={() => { beep('click'); onHome() }}>🏠 Spieler wechseln</button>
      </div>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────
//  APP ROOT
// ─────────────────────────────────────────────────────────────

export default function App() {
  const [screen,       setScreen]       = useState('welcome')
  const [grade,        setGrade]        = useState(null)
  const [exerciseMode, setExerciseMode] = useState('basic')
  const [questions,    setQuestions]    = useState([])
  const [currentQ,     setCurrentQ]     = useState(0)
  const [score,        setScore]        = useState(0)
  const [lives,        setLives]        = useState(INITIAL_LIVES)
  const [streak,       setStreak]       = useState(0)
  const [correct,      setCorrect]      = useState(0)
  const [feedback,     setFeedback]     = useState(null)
  const [inputValue,   setInputValue]   = useState('')

  const timer = useRef(null)

  const startGame = useCallback((g, mode) => {
    clearTimeout(timer.current)
    setExerciseMode(mode)
    setQuestions(buildQuestions(g, mode))
    setCurrentQ(0); setScore(0); setLives(INITIAL_LIVES)
    setStreak(0); setCorrect(0); setFeedback(null); setInputValue('')
    setScreen('game')
  }, [])

  const selectGrade = useCallback((g) => {
    setGrade(g)
    g === 1 ? setScreen('modeSelect') : startGame(g, 'basic')
  }, [startGame])

  const advance = useCallback((isCorrect, nextLives) => {
    timer.current = setTimeout(() => {
      setFeedback(null); setInputValue('')
      const nq = currentQ + 1
      if (nextLives <= 0 || nq >= TOTAL_QUESTIONS) {
        if (isCorrect && nq >= TOTAL_QUESTIONS) beep('win')
        setScreen('result')
      } else {
        setCurrentQ(nq)
      }
    }, 1300)
  }, [currentQ])

  const handleAnswer = useCallback((raw) => {
    if (feedback) return
    clearTimeout(timer.current)
    const ans = parseInt(raw, 10)
    const q   = questions[currentQ]
    const ok  = ans === q.answer

    if (ok) {
      const ns = streak + 1
      const pts = ns >= 3 ? 20 : 10
      if (ns === 3 || ns === 5 || ns === 7) beep('streak'); else beep('correct')
      setStreak(ns); setScore(s => s + pts)
      setCorrect(c => { advance(true, lives); return c + 1 })
      setFeedback('correct')
    } else {
      beep('wrong')
      const nl = lives - 1
      setStreak(0); setLives(nl); setFeedback('wrong')
      advance(false, nl)
    }
  }, [feedback, questions, currentQ, streak, lives, advance])

  const handleKey = useCallback((e) => {
    if (e.key === 'Enter' && inputValue) handleAnswer(inputValue)
  }, [inputValue, handleAnswer])

  useEffect(() => () => clearTimeout(timer.current), [])

  return (
    <div className="app-root">
      {screen === 'welcome'    && <WelcomeScreen onSelect={selectGrade}/>}
      {screen === 'modeSelect' && (
        <ModeSelectScreen
          onSelect={mode => startGame(grade, mode)}
          onBack={() => setScreen('welcome')}
        />
      )}
      {screen === 'game' && grade && questions.length > 0 && (
        <GameScreen
          grade={grade} exerciseMode={exerciseMode}
          questions={questions} currentQ={currentQ}
          score={score} lives={lives} streak={streak}
          feedback={feedback} inputValue={inputValue}
          onChoice={handleAnswer} onInput={setInputValue}
          onSubmit={() => inputValue && handleAnswer(inputValue)}
          onKeyDown={handleKey}
          onExit={() => { clearTimeout(timer.current); setScreen('welcome') }}
        />
      )}
      {screen === 'result' && grade && (
        <ResultScreen
          grade={grade} exerciseMode={exerciseMode}
          score={score} correct={correct} lives={lives}
          onReplay={() => startGame(grade, exerciseMode)}
          onHome={() => setScreen('welcome')}
        />
      )}
    </div>
  )
}
