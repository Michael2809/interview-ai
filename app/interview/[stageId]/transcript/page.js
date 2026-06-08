'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
  ChevronRight,
  Pause,
} from 'lucide-react'

function scoreColor(score) {
  if (score >= 7) return 'bg-green-100 text-green-700'
  if (score >= 4) return 'bg-yellow-100 text-yellow-700'
  return 'bg-red-100 text-red-700'
}

function initials(name) {
  return (name || '?').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()
}

export default function TranscriptPage() {
  const params = useParams()
  const stageId = params.stageId
  const router = useRouter()
  const supabase = createClient()

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
      const urlParams = new URLSearchParams(window.location.search)
      const urlCandidate = urlParams.get('candidate')
      if (urlCandidate && names.includes(urlCandidate)) {
        setSelected(urlCandidate)
      } else if (names.length > 0) {
        setSelected(names[0])
      }
    }

    const { data: scoreData } = await supabase
      .from('scores').select().eq('stage_id', stageId)
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
    return lines.filter((l) =>
      l.candidate_name === name &&
      l.speaker !== 'video' &&
      l.speaker !== 'invite' &&
      l.speaker !== 'analysis' &&
      l.speaker !== 'audio'
    )
  }

  async function scoreCandidate(name) {
    const candidateLines = getTranscriptForCandidate(name)
    setScoring((prev) => ({ ...prev, [name]: true }))
    const response = await fetch('/api/score-interview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ transcript: candidateLines, stageName: stage?.name }),
    })
    const result = await response.json()
    setScoring((prev) => ({ ...prev, [name]: false }))
    if (result.error) {
      setScores((prev) => ({ ...prev, [name]: { error: result.error } }))
      return
    }
    const newScore = { score: result.score, summary: result.summary, status: result.status || 'on-hold' }
    setScores((prev) => ({ ...prev, [name]: newScore }))
    await supabase.from('scores').upsert({
      stage_id: stageId,
      candidate_name: name,
      score: result.score,
      summary: result.summary,
      status: result.status || 'on-hold',
    }, { onConflict: 'stage_id,candidate_name' })
  }

  async function setStatus(name, status) {
    setUpdatingStatus((prev) => ({ ...prev, [name]: true }))
    await supabase.from('scores')
      .update({ status })
      .eq('stage_id', stageId)
      .eq('candidate_name', name)
    setScores((prev) => ({ ...prev, [name]: { ...prev[name], status } }))
    setUpdatingStatus((prev) => ({ ...prev, [name]: false }))
  }

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const analysis = selected ? getAnalysisForCandidate(selected) : null
  const transcriptLines = selected ? getTranscriptForCandidate(selected) : []
  const video = selected ? getVideoForCandidate(selected) : null
  const currentScore = selected ? scores[selected] : null

  return (
    <div className="min-h-screen bg-gray-50 flex">

      {/* Desktop Sidebar - App Nav */}
      <aside className="hidden md:flex w-64 bg-white border-r border-gray-soft flex-col shrink-0">
        <div className="p-6 border-b border-gray-soft">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-ink rounded-lg flex items-center justify-center">
              <ScanFace className="text-yellow" size={18} />
            </div>
            <span className="font-heading font-bold text-lg text-ink">Recrewt AI</span>
          </Link>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link href="/roles" className="flex items-center gap-3 px-3 py-2 rounded-lg bg-lavender text-ink font-medium text-sm">
            <Briefcase size={18} /> Roles
          </Link>
          <Link href="/candidates" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
            <Users size={18} /> Candidates
          </Link>
          <Link href="/settings" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
            <Settings size={18} /> Settings
          </Link>
        </nav>
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
            <nav className="flex-1 p-4 space-y-1">
              <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <LayoutDashboard size={18} /> Dashboard
              </Link>
              <Link href="/roles" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-lavender text-ink font-medium text-sm">
                <Briefcase size={18} /> Roles
              </Link>
              <Link href="/candidates" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <Users size={18} /> Candidates
              </Link>
              <Link href="/settings" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <Settings size={18} /> Settings
              </Link>
            </nav>
            <div className="p-4 border-t border-gray-soft">
              <button onClick={handleLogout} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
                <LogOut size={18} /> Logout
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main area with candidate sidebar */}
      <main className="flex-1 min-w-0 flex flex-col">

        {/* Mobile top bar */}
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

        <div className="flex flex-1 min-h-0">

          {/* Candidate sidebar */}
          <div className="hidden sm:flex w-60 bg-white border-r border-gray-soft flex-col shrink-0">
            <div className="p-4 border-b border-gray-soft">
              <Link href="/roles" className="inline-flex items-center gap-1 text-xs text-gray-mid hover:text-ink mb-3 block">
                <ArrowLeft size={12} /> Back to roles
              </Link>
              <p className="font-heading font-semibold text-sm text-ink">{stage?.name || 'Stage'}</p>
              <p className="text-xs text-gray-mid mt-0.5">{candidates.length} candidate{candidates.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {candidates.length === 0 ? (
                <p className="text-xs text-gray-mid text-center py-8">No completed interviews yet.</p>
              ) : candidates.map((name) => (
                <button
                  key={name}
                  onClick={() => setSelected(name)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-colors ${
                    selected === name ? 'bg-lavender' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="w-8 h-8 rounded-full bg-violet/10 text-violet font-semibold text-xs flex items-center justify-center shrink-0">
                    {initials(name)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-ink truncate">{name}</p>
                    {scores[name]?.status && scores[name].status !== 'pending' && (
                      <p className={`text-xs mt-0.5 ${
                        scores[name].status === 'shortlisted' ? 'text-green-600' :
                        scores[name].status === 'on-hold' ? 'text-yellow-600' : 'text-red-500'
                      }`}>
                        {scores[name].status === 'shortlisted' ? 'Shortlisted' :
                         scores[name].status === 'on-hold' ? 'On Hold' : 'Rejected'}
                      </p>
                    )}
                  </div>
                  {scores[name]?.score != null && (
                    <span className={`text-xs font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${scoreColor(scores[name].score)}`}>
                      {scores[name].score}/10
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Transcript content */}
          <div className="flex-1 min-w-0 overflow-y-auto p-6 lg:p-8">

            {/* Mobile back link */}
            <Link href="/roles" className="sm:hidden inline-flex items-center gap-1 text-xs text-gray-mid hover:text-ink mb-4">
              <ArrowLeft size={12} /> Back to roles
            </Link>

            {!selected ? (
              <div className="flex items-center justify-center h-64">
                <p className="text-gray-mid text-sm">No candidates have completed this stage yet.</p>
              </div>
            ) : (
              <div className="max-w-3xl space-y-6">

                {/* Header card — name, score, status buttons */}
                <div className="bg-white rounded-2xl border border-gray-soft p-5 flex items-center gap-4 flex-wrap">
                  <div className="w-11 h-11 rounded-full bg-lavender text-violet font-heading font-bold text-sm flex items-center justify-center shrink-0">
                    {initials(selected)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="font-heading font-bold text-lg text-ink">{selected}</h1>
                    <p className="text-xs text-gray-mid">{stage?.name}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap shrink-0">
                    {currentScore?.score != null && (
                      <span className={`text-sm font-bold px-3 py-1.5 rounded-full ${scoreColor(currentScore.score)}`}>
                        {currentScore.score}/10
                      </span>
                    )}
                    {currentScore?.score && (
                      <>
                        <button
                          onClick={() => setStatus(selected, 'shortlisted')}
                          disabled={updatingStatus[selected]}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                            currentScore?.status === 'shortlisted'
                              ? 'bg-green-600 text-white border-green-600'
                              : 'border-green-600 text-green-700 hover:bg-green-50'
                          }`}
                        >
                          <ThumbsUp size={12} /> Shortlist
                        </button>
                        <button
                          onClick={() => setStatus(selected, 'on-hold')}
                          disabled={updatingStatus[selected]}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                            currentScore?.status === 'on-hold'
                              ? 'bg-yellow-500 text-white border-yellow-500'
                              : 'border-yellow-500 text-yellow-700 hover:bg-yellow-50'
                          }`}
                        >
                          <Pause size={12} /> On Hold
                        </button>
                        <button
                          onClick={() => setStatus(selected, 'rejected')}
                          disabled={updatingStatus[selected]}
                          className={`inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg border transition-colors ${
                            currentScore?.status === 'rejected'
                              ? 'bg-red-600 text-white border-red-600'
                              : 'border-red-600 text-red-700 hover:bg-red-50'
                          }`}
                        >
                          <ThumbsDown size={12} /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* AI Summary */}
                {currentScore?.summary && (
                  <div className="bg-lavender border border-violet/20 rounded-xl px-4 py-3">
                    <p className="text-xs font-semibold text-violet uppercase tracking-wide mb-1">AI Summary</p>
                    <p className="text-sm text-ink">{currentScore.summary}</p>
                  </div>
                )}

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

                {/* Transcript chat bubbles */}
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

                {/* AI Score section */}
                <div className="bg-white rounded-2xl border border-gray-soft p-6">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <h3 className="font-heading font-semibold text-ink">AI score</h3>
                    <button
                      onClick={() => scoreCandidate(selected)}
                      disabled={scoring[selected]}
                      className="inline-flex items-center gap-2 bg-violet text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-violet-dark transition-colors disabled:opacity-60"
                    >
                      <Sparkles size={14} />
                      {scoring[selected] ? 'Scoring…' : currentScore?.score ? 'Re-score' : 'Score this candidate'}
                    </button>
                  </div>

                  {currentScore && !currentScore.error && currentScore.score && (
                    <div className="rounded-xl bg-lavender p-5 mb-4">
                      <div className="font-heading font-bold text-3xl text-ink">
                        {currentScore.score}<span className="text-base text-gray-mid font-normal">/10</span>
                      </div>
                      <p className="mt-2 text-sm text-ink leading-relaxed">{currentScore.summary}</p>
                    </div>
                  )}

                  {currentScore?.error && (
                    <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{currentScore.error}</p>
                  )}

                  {currentScore?.score && (
                    <div>
                      <p className="text-sm text-gray-mid mb-3">Move this candidate to:</p>
                      <div className="flex gap-2 flex-wrap">
                        <button
                          onClick={() => setStatus(selected, 'shortlisted')}
                          disabled={updatingStatus[selected]}
                          className={`inline-flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg border transition-colors ${
                            currentScore?.status === 'shortlisted'
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
                            currentScore?.status === 'on-hold'
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
                            currentScore?.status === 'rejected'
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
        </div>
      </main>
    </div>
  )
}