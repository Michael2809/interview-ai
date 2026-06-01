'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ScanFace,
  LayoutDashboard,
  Briefcase,
  Users,
  Settings,
  LogOut,
  Plus,
  Menu,
  X,
  ArrowLeft,
  Sparkles,
  Send,
  FileText,
  Check,
  Upload,
} from 'lucide-react'

export default function RoleDetailPage() {
  const params = useParams()
  const roleId = params.id
  const router = useRouter()
  const authClient = createClient()

  const [role, setRole] = useState(null)
  const [stages, setStages] = useState([])
  const [questions, setQuestions] = useState([])

  const [name, setName] = useState('')
  const [level, setLevel] = useState('easy')
  const [topics, setTopics] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [busyStageId, setBusyStageId] = useState(null)
  const [uploadingStageId, setUploadingStageId] = useState(null)
  const [origin, setOrigin] = useState('')
  const [inviteEmail, setInviteEmail] = useState({})
  const [mobileNavOpen, setMobileNavOpen] = useState(false)

  const fileInputRefs = useRef({})

  useEffect(() => {
    setOrigin(window.location.origin)
  }, [])

  async function loadRole() {
    const { data } = await supabase.from('roles').select().eq('id', roleId).single()
    if (data) setRole(data)
  }

  async function loadStages() {
    const { data } = await supabase
      .from('stages')
      .select()
      .eq('role_id', roleId)
      .order('position', { ascending: true })
    if (data) setStages(data)
  }

  async function loadQuestions() {
    const { data } = await supabase.from('questions').select()
    if (data) setQuestions(data)
  }

  useEffect(() => {
    loadRole()
    loadStages()
    loadQuestions()
  }, [])

  function flashError(msg) { setMessage(''); setError(msg) }
  function flashMessage(msg) { setError(''); setMessage(msg) }

  async function saveStage() {
    if (!name) return flashError('Please type a stage name first.')
    const nextPosition = stages.length + 1
    const { error: err } = await supabase.from('stages').insert({
      role_id: roleId,
      name, level,
      position: nextPosition,
      topics,
    })
    if (err) return flashError('Something went wrong: ' + err.message)
    flashMessage('Stage added.')
    setName(''); setTopics(''); setLevel('easy')
    loadStages()
  }

  async function draftQuestions(stage) {
    setBusyStageId(stage.id)
    flashMessage('Drafting questions for ' + stage.name + '...')

    await supabase
      .from('questions')
      .delete()
      .eq('stage_id', stage.id)
      .eq('approved', false)

    const response = await fetch('/api/generate-questions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageName: stage.name, level: stage.level, topics: stage.topics }),
    })
    const result = await response.json()
    setBusyStageId(null)
    if (result.error) return flashError('AI error: ' + result.error)
    const rows = result.questions.map((q) => ({ stage_id: stage.id, text: q, approved: false }))
    const { error: err } = await supabase.from('questions').insert(rows)
    if (err) return flashError('Could not save questions: ' + err.message)
    flashMessage('Fresh questions drafted for ' + stage.name + '.')
    loadQuestions()
  }

  async function uploadResume(stage, file) {
    if (!file) return

    setUploadingStageId(stage.id)
    flashMessage('Reading document and drafting questions for ' + stage.name + '...')

    await supabase
      .from('questions')
      .delete()
      .eq('stage_id', stage.id)
      .eq('approved', false)

    const formData = new FormData()
    formData.append('resume', file)
    formData.append('stageName', stage.name)
    formData.append('level', stage.level)
    formData.append('topics', stage.topics || '')

    const response = await fetch('/api/generate-questions-from-resume', {
      method: 'POST',
      body: formData,
    })
    const result = await response.json()
    setUploadingStageId(null)

    if (result.error) return flashError('Resume error: ' + result.error)

    const rows = result.questions.map((q) => ({ stage_id: stage.id, text: q, approved: false }))
    const { error: err } = await supabase.from('questions').insert(rows)
    if (err) return flashError('Could not save questions: ' + err.message)
    flashMessage('Personalized questions drafted from document for ' + stage.name + '.')
    loadQuestions()
  }

  function triggerFileUpload(stageId) {
    const input = fileInputRefs.current[stageId]
    if (input) {
      input.value = ''
      input.click()
    }
  }

  async function toggleApprove(question) {
    await supabase.from('questions').update({ approved: !question.approved }).eq('id', question.id)
    loadQuestions()
  }

  async function sendInvite(stageId) {
    const email = inviteEmail[stageId]
    if (!email) return flashError('Please enter a candidate email.')
    flashMessage('Sending invite...')
    const response = await fetch('/api/send-invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stageId, candidateEmail: email, origin }),
    })
    const result = await response.json()
    if (result.error) return flashError('Error: ' + result.error)
    flashMessage('Invite sent to ' + email)
    setInviteEmail({ ...inviteEmail, [stageId]: '' })
  }

  async function handleLogout() {
    await authClient.auth.signOut()
    router.push('/login')
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

        <div className="p-6 lg:p-10 max-w-4xl">
          <Link href="/roles" className="inline-flex items-center gap-1 text-sm text-gray-mid hover:text-ink transition-colors">
            <ArrowLeft size={14} /> Back to roles
          </Link>

          <h1 className="font-heading font-bold text-2xl md:text-3xl text-ink mt-3">
            {role ? role.title : 'Loading…'}
          </h1>
          <p className="text-sm text-gray-mid mt-1">Create interview stages, draft AI questions, and invite candidates.</p>

          {(error || message) && (
            <div className="mt-4">
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
              {message && <p className="text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{message}</p>}
            </div>
          )}

          <h2 className="font-heading font-semibold text-lg text-ink mt-10 mb-4">Interview stages</h2>

          {stages.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-soft p-10 text-center mb-8">
              <p className="font-medium text-ink">No stages yet</p>
              <p className="text-sm text-gray-mid mt-1">Add your first stage below.</p>
            </div>
          ) : (
            <div className="space-y-4 mb-8">
              {stages.map((stage) => {
                const stageQuestions = questions.filter((q) => q.stage_id === stage.id)
                const isUploading = uploadingStageId === stage.id
                const isDrafting = busyStageId === stage.id
                return (
                  <div key={stage.id} className="bg-white rounded-2xl border border-gray-soft p-6">
                    <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                      <div>
                        <h3 className="font-heading font-semibold text-ink">
                          {stage.position}. {stage.name}
                        </h3>
                        <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-mid">
                          <span className="bg-lavender text-violet font-medium px-2 py-0.5 rounded-full capitalize">{stage.level}</span>
                          <span>{stage.topics ? `Topics: ${stage.topics}` : 'No topics'}</span>
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0 flex-wrap">
                        <input
                          ref={(el) => { fileInputRefs.current[stage.id] = el }}
                          type="file"
                          accept=".pdf,.docx,.doc,.txt"
                          className="hidden"
                          onChange={(e) => uploadResume(stage, e.target.files[0])}
                        />
                        <button
                          onClick={() => triggerFileUpload(stage.id)}
                          disabled={isUploading || isDrafting}
                          className="inline-flex items-center gap-2 bg-white border border-violet text-violet text-sm font-medium px-3 py-2 rounded-lg hover:bg-lavender transition-colors disabled:opacity-60"
                        >
                          <Upload size={14} />
                          {isUploading ? 'Reading…' : 'From Document'}
                        </button>
                        <button
                          onClick={() => draftQuestions(stage)}
                          disabled={isDrafting || isUploading}
                          className="inline-flex items-center gap-2 bg-violet text-white text-sm font-medium px-3 py-2 rounded-lg hover:bg-violet-dark transition-colors disabled:opacity-60"
                        >
                          <Sparkles size={14} />
                          {isDrafting ? 'Drafting…' : 'Draft with AI'}
                        </button>
                      </div>
                    </div>

                    {stageQuestions.length > 0 && (
                      <div className="mt-4 space-y-2">
                        {stageQuestions.map((q) => (
                          <label key={q.id} className="flex items-start gap-2 p-3 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={q.approved}
                              onChange={() => toggleApprove(q)}
                              className="mt-1 accent-violet"
                            />
                            <span className="text-sm text-ink flex-1">{q.text}</span>
                            {q.approved && (
                              <span className="inline-flex items-center gap-1 text-xs text-green-700 bg-green-50 px-2 py-0.5 rounded-full shrink-0">
                                <Check size={12} /> Approved
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    )}

                    <div className="mt-4 pt-4 border-t border-gray-soft flex flex-col sm:flex-row gap-2">
                      <input
                        type="email"
                        placeholder="Candidate email"
                        value={inviteEmail[stage.id] || ''}
                        onChange={(e) => setInviteEmail({ ...inviteEmail, [stage.id]: e.target.value })}
                        className="flex-1 rounded-lg border border-gray-soft px-3 py-2 text-sm text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                      />
                      <button
                        onClick={() => sendInvite(stage.id)}
                        className="inline-flex items-center justify-center gap-2 bg-ink text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-ink/90 transition-colors"
                      >
                        <Send size={14} /> Send invite
                      </button>
                    </div>

                    <Link
                      href={'/interview/' + stage.id + '/transcript'}
                      className="mt-4 inline-flex items-center gap-1 text-sm text-violet font-medium hover:text-violet-dark"
                    >
                      <FileText size={14} /> View transcript
                    </Link>
                  </div>
                )
              })}
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-soft p-6">
            <h2 className="font-heading font-semibold text-lg text-ink mb-4">Add a stage</h2>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Stage name</label>
                <input
                  type="text"
                  placeholder="e.g. Screening Call"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Difficulty</label>
                <select
                  value={level}
                  onChange={(e) => setLevel(e.target.value)}
                  className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink bg-white focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                >
                  <option value="easy">Easy</option>
                  <option value="intermediate">Intermediate</option>
                  <option value="hard">Hard</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Topics</label>
                <input
                  type="text"
                  placeholder="e.g. communication, basic skills"
                  value={topics}
                  onChange={(e) => setTopics(e.target.value)}
                  className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                />
              </div>
              <button
                onClick={saveStage}
                className="inline-flex items-center gap-2 bg-violet text-white font-medium px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors"
              >
                <Plus size={16} /> Add Stage
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}