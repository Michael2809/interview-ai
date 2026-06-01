'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import {
  ScanFace,
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  LogOut,
  Menu,
  X,
  ArrowLeft,
  Gauge,
  MessageSquare,
  Mic,
  Smile,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Minus,
} from 'lucide-react'

export default function TranscriptPage() {
  const params = useParams()
  const stageId = params.stageId
  const router = useRouter()
  const authClient = createClient()

  const [stage, setStage] = useState(null)
  const [lines, setLines] = useState([])
  const [scores, setScores] = useState({})
  const [scoring, setScoring] = useState({})
  const [selected, setSelected] = useState(null)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState({})

  async function loadData() {
    const { data: stageData } = await supabase.from('stages').select().eq('id', stageId).single()
    if (stageData) setStage(stageData)

    const { data: lineData } = await supabase
      .from('interviews').select().eq('stage_id', stageId).order('created_at', { ascending: true })
    if (lineData) {
      setLines(lineData)
      const names = [...new Set(lineData.map((l) => l.candidate_name).filter(Boolean))]
      if (names.length > 0) setSelected(names[0])
    }

    // Load saved scores from DB
    const { data: scoreData } = await supabase
      .from('scores')
      .select()
      .eq('stage_id', stageId)
    if (scoreData) {
      const scoreMap = {}
      scoreData.forEach((s) => {
        scoreMap[s.candidate_name] = { score: s.score, summary: s.summary, status: s.status }
      })
      setScores(scoreMap)
    }
  }

  useEffect(() => { loadData() }, [])

  const candidates = [...new Set(lines.map((l) => l.candidate_name).filter(Boolean))]

  function getVideoForCandidate(name) {
    const v = lines.find((l) => l.candidate_name === name && l.speaker === 'video')
    return v ? v.video_url : null
  }
  function getAnalysisForCandidate(name) {
    const a = lines.find((l) => l.candidate_name === name && l.speaker === 'analysis')
    if (!a) return null
    try { return JSON.parse(a.content) } catch { return null }
  }
  function getTranscriptForCandidate(name) {
    return lines.filter((l) => l.candidate_name === name && l.speaker !== 'video' && l.speaker !== 'invite' && l.speaker !== 'analysis' && l.speaker !== 'audio')
  }

  async function scoreCandidate(name) {
    const candidateLines = getTranscriptForCandidate(name)
    setScoring({ ...scoring, [name]: true })
    const response = await fetch('/api/score-interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: candidateLines, stageName: stage?.name }),
    })
    const result = await response.json()
    setScoring({ ...scoring, [name]: false })
    if (result.error) {
      setScores({ ...scores, [name]: { error: result.error } })
      return
    }

    const newScore = { score: result.score, summary: result.summary, status: result.status || 'on-hold' }
    setScores({ ...scores, [name]: newScore })

    // Save to DB — upsert so re-scoring updates existing row
    await supabase.from('scores').upsert({
      stage_id: stageId,
      candidate_name: name,
      score: result.score,
      summary: result.summary,
      status: result.status || 'on-hold',
    }, { onConflict: 'stage_id,candidate_name' })
  }

  async function setStatus(name, status) {
    setUpdatingStatus({ ...updatingStatus, [name]: true })
    await supabase.from('scores')
      .update({ status })
      .eq('stage_id', stageId)
      .eq('candidate_name', name)
    setScores((prev) => ({
      ...prev,
      [name]: { ...prev[name], status },
    }))
    setUpdatingStatus({ ...updatingStatus, [name]: false })
  }

  async function handleLogout() {
    await authClient.auth.signOut()
    router.push('/login')
  }

  function initials(name) {
    return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase()
  }

  function statusBadge(status) {
    if (status === 'shortlisted') return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700">✓ Shortlisted</span>
   if (status === 'on-hold') return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">~ On Hold</span>
    if (status === 'rejected') return <span className="inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full bg-red-100 text-red-700">✕ Rejected</span>
    return null
  }

  const navLinks = (
    <>
      <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
        <LayoutDashboard size={18} /> Dashboard
      </Link>
      <Link href="/roles" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-lavender text-ink font-medium text-sm">
        <Briefcase size={18} /> Roles
      </Link>
      <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
        <Users size={18} /> Candidates
      </Link>
      <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
        <Settings size={18} /> Settings
      </Link>
    </>
  )

  const analysis = selected ? getAnalysisForCandidate(selected) : null
  const transcriptLines = selected ? getTranscriptForCandidate(selected) : []
  const video = selected ? getVideoForCandidate(selected) : null

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Desktop Sidebar */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-soft flex-col">
        <div className="p-6 border-b border-gray-soft">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
              <ScanFace className="text-yellow" size={18} />
            </div>
            <span className="font-heading font-bold text-lg text-ink">Recrewt AI</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">{navLinks}</nav>
        <div className="p-4 border-t border-gray-soft">
          <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Mobile slide-out */}
      {mobileNavOpen && (
        <div className="md:hidden fixed inset-0 z-40">
          <div className="absolute inset-0 bg-ink/40" onClick={() => setMobileNavOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-white border-r border-gray-soft flex flex-col">
            <div className="p-6 border-b border-gray-soft flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
                  <ScanFace className="text-yellow" size={18} />
                </div>
                <span className="font-heading font-bold text-lg text-ink">Recrewt AI</span>
              </div>
              <button onClick={() => setMobileNavOpen(false)} className="text-gray-mid"><X size={20} /></button>
            </div>
            <nav className="flex-1 p-4 space-y-1">{navLinks}</nav>
            <div className="p-4 border-t border-gray-soft">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <LogOut size={18} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <main className="flex-1 min-w-0">
        <div className="md:hidden flex items-center justify-between p-4 bg-white border-b border-gray-soft">
          <button onClick={() => setMobileNavOpen(true)} className="text-ink"><Menu size={22} /></button>
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 bg-ink rounded-lg flex items-center justify-center">
              <ScanFace className="text-yellow" size={16} />
            </div>
            <span className="font-heading font-bold text-ink">Recrewt AI</span>
          </div>
          <div className="w-6" />
        </div>

        <div className="p-6 lg:p-10 max-w-6xl">
          <Link href="/roles" className="inline-flex items-center gap-1 text-sm text-gray-mid hover:text-ink transition-colors">
            <ArrowLeft size={14} /> Back to roles
          </Link>

          <h1 className="font-heading font-bold text-2xl md:text-3xl text-ink mt-3">
            {stage ? stage.name : 'Transcripts'}
          </h1>
          <p className="text-sm text-gray-mid mt-1">Review candidate interviews, transcripts, speech analysis, and AI scores.</p>

          {/* Candidate selector */}
          <div className="mt-8">
            <h2 className="font-heading font-semibold text-sm text-gray-mid uppercase tracking-wide mb-3">Candidates</h2>
            {candidates.length === 0 ? (
              <div className="bg-white rounded-2xl border border-dashed border-gray-soft p-10 text-center">
                <p className="font-medium text-ink">No interviews yet</p>
                <p className="text-sm text-gray-mid mt-1">Once a candidate completes their interview, they'll appear here.</p>
              </div>
            ) : (
              <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
                {candidates.map((name) => (
                  <button
                    key={name}
                    onClick={() => setSelected(name)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-xl border whitespace-nowrap text-sm transition-colors ${
                      selected === name
                        ? 'bg-ink text-white border-ink'
                        : 'bg-white text-ink border-gray-soft hover:border-violet'
                    }`}
                  >
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-semibold ${
                      selected === name ? 'bg-white/15 text-white' : 'bg-lavender text-violet'
                    }`}>
                      {initials(name)}
                    </span>
                    {name}
                    {scores[name]?.status && scores[name].status !== 'pending' && (
                      <span className={`w-2 h-2 rounded-full ${
                        scores[name]?.status === 'shortlisted' ? 'bg-green-500' :
scores[name]?.status === 'on-hold' ? 'bg-yellow-400' : 'bg-red-400'
                      }`} />
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          {selected && (
            <div className="mt-8 space-y-6">
              {/* Candidate header */}
              <div className="bg-white rounded-2xl border border-gray-soft p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-lavender text-violet font-heading font-semibold flex items-center justify-center">
                  {initials(selected)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-heading font-semibold text-lg text-ink truncate">{selected}</div>
                  <div className="text-sm text-gray-mid">{stage?.name} interview</div>
                </div>
                {scores[selected]?.status && statusBadge(scores[selected].status)}
              </div>

              {/* Video */}
              {video && (
                <div className="bg-white rounded-2xl border border-gray-soft p-6">
                  <h3 className="font-heading font-semibold text-ink mb-3">Recording</h3>
                  <video src={video} controls className="w-full rounded-xl bg-ink" />
                </div>
              )}

              {/* Speech Analysis */}
              {analysis && (
                <div className="bg-white rounded-2xl border border-gray-soft p-6">
                  <h3 className="font-heading font-semibold text-ink mb-4">Speech analysis</h3>
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="flex items-center gap-2 text-xs text-gray-mid"><Gauge size={14} /> Speaking pace</div>
                      <div className="font-heading font-bold text-2xl text-ink mt-2">{analysis.wordsPerMinute} <span className="text-sm text-gray-mid font-normal">wpm</span></div>
                      <div className="text-xs text-gray-mid mt-1">Normal: 120–160 wpm</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="flex items-center gap-2 text-xs text-gray-mid"><MessageSquare size={14} /> Filler words</div>
                      <div className="font-heading font-bold text-2xl text-ink mt-2">{analysis.fillerWordCount}</div>
                      <div className="text-xs text-gray-mid mt-1">um, uh, like, you know</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="flex items-center gap-2 text-xs text-gray-mid"><Mic size={14} /> Clarity</div>
                      <div className="font-heading font-bold text-2xl text-ink mt-2">{analysis.avgPronunciationConfidence}<span className="text-sm text-gray-mid font-normal">%</span></div>
                      <div className="text-xs text-gray-mid mt-1">Speech confidence</div>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                      <div className="flex items-center gap-2 text-xs text-gray-mid"><Smile size={14} /> Sentiment</div>
                      <div className="font-heading font-bold text-lg text-ink mt-2">
                        {analysis.sentimentBreakdown.positive}<span className="text-xs text-gray-mid">P</span>{' / '}
                        {analysis.sentimentBreakdown.neutral}<span className="text-xs text-gray-mid">N</span>{' / '}
                        {analysis.sentimentBreakdown.negative}<span className="text-xs text-gray-mid">Neg</span>
                      </div>
                      <div className="text-xs text-gray-mid mt-1">Positive / Neutral / Negative</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Transcript */}
              <div className="bg-white rounded-2xl border border-gray-soft p-6">
                <h3 className="font-heading font-semibold text-ink mb-4">Transcript</h3>
                {transcriptLines.length === 0 ? (
                  <p className="text-sm text-gray-mid">No transcript available.</p>
                ) : (
                  <div className="space-y-4">
                    {transcriptLines.map((line) => {
                      const isInterviewer = line.speaker === 'interviewer'
                      return (
                        <div key={line.id} className={`flex ${isInterviewer ? 'justify-start' : 'justify-end'}`}>
                          <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${isInterviewer ? 'bg-gray-50 text-ink' : 'bg-lavender text-ink'}`}>
                            <div className="text-xs font-medium uppercase tracking-wide mb-1 text-gray-mid">
                              {isInterviewer ? 'Interviewer' : selected}
                            </div>
                            <p className="text-sm leading-relaxed">{line.content}</p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Score + Shortlisting */}
              <div className="bg-white rounded-2xl border border-gray-soft p-6">
                <div className="flex items-center justify-between gap-3 mb-4">
                  <h3 className="font-heading font-semibold text-ink">AI score</h3>
                  <button
                    onClick={() => scoreCandidate(selected)}
                    disabled={scoring[selected]}
                    className="inline-flex items-center gap-2 bg-violet text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-violet-dark transition-colors disabled:opacity-60"
                  >
                    <Sparkles size={14} />
                    {scoring[selected] ? 'Scoring…' : scores[selected]?.score ? 'Re-score' : 'Score this candidate'}
                  </button>
                </div>

                {scores[selected] && !scores[selected].error && (
                  <div className="rounded-xl bg-lavender p-5 mb-4">
                    <div className="font-heading font-bold text-3xl text-ink">
                      {scores[selected].score}<span className="text-base text-gray-mid font-normal">/10</span>
                    </div>
                    <p className="mt-2 text-sm text-ink leading-relaxed">{scores[selected].summary}</p>
                  </div>
                )}

                {scores[selected]?.error && (
                  <p className="mb-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{scores[selected].error}</p>
                )}

                {/* Shortlisting buttons — only show once scored */}
                {scores[selected]?.score && (
                  <div>
                    <p className="text-sm text-gray-mid mb-3">Move this candidate to:</p>
                    <div className="flex gap-2 flex-wrap">
                      <button
                        onClick={() => setStatus(selected, 'shortlisted')}
                        disabled={updatingStatus[selected]}
                        className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${
                          scores[selected]?.status === 'shortlisted'
                            ? 'bg-green-600 text-white border-green-600'
                            : 'bg-white text-green-700 border-green-300 hover:bg-green-50'
                        }`}
                      >
                        <ThumbsUp size={14} /> Shortlisted
                      </button>
                      <button
                        onClick={() => setStatus(selected, 'on-hold')}
                        disabled={updatingStatus[selected]}
                        className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${
                          scores[selected]?.status === 'on-hold'
                            ? 'bg-yellow-400 text-ink border-yellow-400'
                            : 'bg-white text-yellow-700 border-yellow-300 hover:bg-yellow-50'
                        }`}
                      >
                        <Minus size={14} /> On Hold
                      </button>
                      <button
                        onClick={() => setStatus(selected, 'rejected')}
                        disabled={updatingStatus[selected]}
                        className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${
                          scores[selected]?.status === 'rejected'
                            ? 'bg-red-500 text-white border-red-500'
                            : 'bg-white text-red-600 border-red-300 hover:bg-red-50'
                        }`}
                      >
                        <ThumbsDown size={14} /> Rejected
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}