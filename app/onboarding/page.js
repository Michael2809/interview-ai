'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ScanFace, ArrowRight, CheckCircle2, Loader } from 'lucide-react'

export default function OnboardingPage() {
  const supabase = createClient()
  const router = useRouter()

  const [step, setStep] = useState(1)
  const [jobTitle, setJobTitle] = useState('')
  const [questions, setQuestions] = useState([])
  const [candidateEmail, setCandidateEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [roleId, setRoleId] = useState(null)
  const [stageId, setStageId] = useState(null)

  // ── Step 1: Create role + generate questions ──────────────────────────────
  async function handleGenerateQuestions() {
    if (!jobTitle.trim()) return
    setError('')
    setLoading(true)

    try {
      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Create role
      const { data: role, error: roleError } = await supabase
        .from('roles')
        .insert({ title: jobTitle, user_id: user.id })
        .select()
        .single()
      if (roleError) throw roleError
      setRoleId(role.id)

      // Create stage
      const { data: stage, error: stageError } = await supabase
        .from('stages')
        .insert({ role_id: role.id, name: 'Screening', level: 'entry', position: 1 })
        .select()
        .single()
      if (stageError) throw stageError
      setStageId(stage.id)

      // Generate questions
      const res = await fetch('/api/onboarding-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobTitle }),
      })
      const result = await res.json()
      if (result.error) throw new Error(result.error)

      // Save questions to DB
      const questionRows = result.questions.map((text) => ({
        stage_id: stage.id,
        text,
        approved: true,
      }))
      await supabase.from('questions').insert(questionRows)

      setQuestions(result.questions)
      setStep(2)

    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // ── Step 3: Send invite + mark onboarding complete ────────────────────────
  async function handleSendInvite() {
    if (!candidateEmail.trim()) return
    setError('')
    setLoading(true)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { router.push('/login'); return }

      // Create invite row
      await supabase.from('interviews').insert({
        stage_id: stageId,
        speaker: 'invite',
        content: 'Interview invitation',
        candidate_email: candidateEmail.toLowerCase(),
        status: 'invited',
        invited_at: new Date().toISOString(),
      })

      // Send invite email via existing API
      await fetch('/api/send-invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          candidateEmail,
          stageId,
          roleTitle: jobTitle,
        }),
      }).catch(() => {}) // don't block if email fails

      // Mark onboarding complete
      await supabase
        .from('settings')
        .update({ onboarding_completed: true })
        .eq('user_id', user.id)

      router.push('/dashboard?onboarded=true')

    } catch (err) {
      console.error(err)
      setError('Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-lavender flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-lg">

        {/* Logo */}
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-9 h-9 bg-ink rounded-lg flex items-center justify-center">
            <ScanFace className="text-yellow" size={20} />
          </div>
          <span className="font-heading font-bold text-xl text-ink">Recrewt AI</span>
        </div>

        {/* Progress */}
        <div className="flex items-center gap-2 mb-8 justify-center">
          {[1, 2, 3].map((s) => (
            <div key={s} className="flex items-center gap-2">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                step > s ? 'bg-green-500 text-white' :
                step === s ? 'bg-violet text-white' :
                'bg-white text-gray-mid border border-gray-soft'
              }`}>
                {step > s ? <CheckCircle2 size={14} /> : s}
              </div>
              {s < 3 && <div className={`w-12 h-0.5 ${step > s ? 'bg-green-500' : 'bg-gray-soft'}`} />}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl p-8 shadow-xl border border-gray-soft">

          {/* Step 1 */}
          {step === 1 && (
            <div>
              <h1 className="font-heading font-bold text-2xl text-ink mb-2">
                What role are you hiring for?
              </h1>
              <p className="text-sm text-gray-mid mb-6">
                Enter the job title and we'll generate smart interview questions in seconds.
              </p>
              <input
                type="text"
                placeholder="e.g. Product Manager, Frontend Developer..."
                value={jobTitle}
                onChange={(e) => setJobTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleGenerateQuestions()}
                className="w-full rounded-lg border border-gray-soft px-3 py-2.5 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20 mb-4"
              />
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}
              <button
                onClick={handleGenerateQuestions}
                disabled={!jobTitle.trim() || loading}
                className="w-full bg-violet text-white font-heading font-semibold py-3 rounded-xl hover:bg-violet-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader size={16} className="animate-spin" /> Generating questions…</>
                ) : (
                  <>Generate Questions <ArrowRight size={16} /></>
                )}
              </button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div>
              <h1 className="font-heading font-bold text-2xl text-ink mb-2">
                Here's what the AI drafted
              </h1>
              <p className="text-sm text-gray-mid mb-6">
                These questions are tailored for <strong>{jobTitle}</strong>. You can edit them from the dashboard anytime.
              </p>
              <div className="flex flex-col gap-3 mb-6">
                {questions.map((q, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-lavender/50 rounded-xl">
                    <span className="w-5 h-5 rounded-full bg-violet text-white text-xs flex items-center justify-center shrink-0 mt-0.5 font-bold">
                      {i + 1}
                    </span>
                    <p className="text-sm text-ink leading-relaxed">{q}</p>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setStep(3)}
                className="w-full bg-violet text-white font-heading font-semibold py-3 rounded-xl hover:bg-violet-dark transition-colors flex items-center justify-center gap-2"
              >
                These look good <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <div>
              <h1 className="font-heading font-bold text-2xl text-ink mb-2">
                Invite your first candidate
              </h1>
              <p className="text-sm text-gray-mid mb-6">
                They'll get a link to complete the AI video interview on their own time.
              </p>
              <input
                type="email"
                placeholder="candidate@email.com"
                value={candidateEmail}
                onChange={(e) => setCandidateEmail(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && !loading && handleSendInvite()}
                className="w-full rounded-lg border border-gray-soft px-3 py-2.5 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20 mb-4"
              />
              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>}
              <button
                onClick={handleSendInvite}
                disabled={!candidateEmail.trim() || loading}
                className="w-full bg-violet text-white font-heading font-semibold py-3 rounded-xl hover:bg-violet-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading ? (
                  <><Loader size={16} className="animate-spin" /> Sending invite…</>
                ) : (
                  <>Send Invite <ArrowRight size={16} /></>
                )}
              </button>
              <button
                onClick={async () => {
                  const { data: { user } } = await supabase.auth.getUser()
                  if (user) await supabase.from('settings').update({ onboarding_completed: true }).eq('user_id', user.id)
                  router.push('/dashboard')
                }}
                className="w-full mt-3 text-sm text-gray-mid hover:text-ink transition-colors py-2"
              >
                Skip for now →
              </button>
            </div>
          )}

        </div>

        <p className="text-center text-xs text-gray-mid mt-6">© 2026 Recrewt AI</p>
      </div>
    </div>
  )
}