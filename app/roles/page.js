'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
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
  ArrowRight,
  ChevronDown,
} from 'lucide-react'

const JOB_CATEGORIES = {
  'Digital Marketing': [
    'SEO', 'Google Ads', 'Meta Ads', 'Email Marketing', 'Content Marketing',
    'Affiliate Marketing', 'Influencer Marketing', 'Social Media Management',
  ],
  'Engineering': [
    'Frontend', 'Backend', 'Full Stack', 'DevOps', 'Mobile (iOS)',
    'Mobile (Android)', 'Data Engineering', 'QA / Testing', 'Security',
  ],
  'Design': [
    'UI/UX', 'Graphic Design', 'Product Design', 'Motion Design',
    'Brand Design', 'Illustration',
  ],
  'Sales': [
    'Inside Sales', 'Account Executive', 'SDR / BDR',
    'Business Development', 'Sales Operations', 'Enterprise Sales',
  ],
  'Product': [
    'Product Manager', 'Product Analyst', 'Growth', 'Product Operations',
  ],
  'Data & Analytics': [
    'Data Analyst', 'Data Scientist', 'Business Intelligence',
    'Machine Learning Engineer', 'AI Engineer',
  ],
  'Finance': [
    'Accounting', 'Financial Analysis', 'Payroll', 'Audit', 'Tax',
  ],
  'Human Resources': [
    'Recruitment', 'HR Operations', 'L&D', 'Compensation & Benefits',
  ],
  'Customer Success': [
    'Customer Support', 'Account Management', 'Onboarding', 'Technical Support',
  ],
  'Operations': [
    'Project Management', 'Business Operations', 'Supply Chain',
    'Logistics', 'Office Management',
  ],
  'Other': ['Other'],
}

export default function RolesPage() {
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [subcategory, setSubcategory] = useState('')
  const [employmentType, setEmploymentType] = useState('full-time')
  const [experienceLevel, setExperienceLevel] = useState('mid')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [roles, setRoles] = useState([])
  const [loading, setLoading] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const authClient = createClient()
  const router = useRouter()

  async function loadRoles() {
    const { data } = await supabase
      .from('roles').select().order('created_at', { ascending: false })
    if (data) setRoles(data)
  }

  useEffect(() => { loadRoles() }, [])

  function handleCategoryChange(val) {
    setCategory(val)
    setSubcategory('')
  }

  async function saveRole() {
    setError('')
    setMessage('')
    if (!title) { setError('Please enter a job title first.'); return }
    setLoading(true)
    const { error: insertError } = await supabase.from('roles').insert({
      title,
      description: description || null,
      department: category ? (subcategory ? `${category} — ${subcategory}` : category) : null,
      employment_type: employmentType,
      experience_level: experienceLevel,
    })
    setLoading(false)
    if (insertError) {
      setError('Something went wrong: ' + insertError.message)
    } else {
      setMessage(`Role "${title}" created successfully.`)
      setTitle(''); setDescription(''); setCategory(''); setSubcategory('')
      setEmploymentType('full-time'); setExperienceLevel('mid')
      loadRoles()
    }
  }

  async function handleLogout() {
    await authClient.auth.signOut()
    router.push('/login')
  }

  function employmentLabel(val) {
    if (val === 'full-time') return 'Full-time'
    if (val === 'part-time') return 'Part-time'
    if (val === 'contract') return 'Contract'
    return val
  }

  function experienceLabel(val) {
    if (val === 'entry') return 'Entry Level'
    if (val === 'mid') return 'Mid Level'
    if (val === 'senior') return 'Senior'
    if (val === 'lead') return 'Lead'
    return val
  }

  const subcategories = category ? JOB_CATEGORIES[category] || [] : []

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
          <Link href="/dashboard" className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
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
              <Link href="/dashboard" onClick={() => setMobileNavOpen(false)} className="flex items-center gap-3 px-3 py-2 rounded-lg text-gray-mid hover:bg-gray-50 hover:text-ink text-sm">
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

          <div className="mb-8">
            <h1 className="font-heading font-bold text-2xl md:text-3xl text-ink">Roles</h1>
            <p className="text-sm text-gray-mid mt-1">Create job roles and we'll draft tailored interview questions for each.</p>
          </div>

          {/* Create Role Card */}
          <div className="bg-white rounded-2xl border border-gray-soft p-6 mb-8">
            <h2 className="font-heading font-semibold text-lg text-ink mb-5">Create a new role</h2>

            <div className="space-y-4">

              {/* Job Title */}
              <div>
                <label className="block text-sm font-medium text-ink mb-1">
                  Job Title <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Junior Backend Developer"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && saveRole()}
                  className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                />
              </div>

              {/* Job Description */}
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Job Description</label>
                <textarea
                  placeholder="Briefly describe the role, responsibilities, and what you're looking for in a candidate…"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={4}
                  className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink placeholder-gray-mid focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20 resize-none"
                />
              </div>

              {/* Category + Subcategory */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Job Category</label>
                  <div className="relative">
                    <select
                      value={category}
                      onChange={(e) => handleCategoryChange(e.target.value)}
                      className="w-full appearance-none rounded-lg border border-gray-soft px-3 py-2 text-ink bg-white focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20 pr-8"
                    >
                      <option value="">Select a category</option>
                      {Object.keys(JOB_CATEGORIES).map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-mid pointer-events-none" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-ink mb-1">
                    Specialisation
                    {!category && <span className="text-gray-mid font-normal"> — pick a category first</span>}
                  </label>
                  <div className="relative">
                    <select
                      value={subcategory}
                      onChange={(e) => setSubcategory(e.target.value)}
                      disabled={!category}
                      className="w-full appearance-none rounded-lg border border-gray-soft px-3 py-2 text-ink bg-white focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20 pr-8 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <option value="">All {category || '…'}</option>
                      {subcategories.map((sub) => (
                        <option key={sub} value={sub}>{sub}</option>
                      ))}
                    </select>
                    <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-mid pointer-events-none" />
                  </div>
                </div>
              </div>

              {/* Employment Type + Experience Level */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Employment Type</label>
                  <select
                    value={employmentType}
                    onChange={(e) => setEmploymentType(e.target.value)}
                    className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink bg-white focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                  >
                    <option value="full-time">Full-time</option>
                    <option value="part-time">Part-time</option>
                    <option value="contract">Contract</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-ink mb-1">Experience Level</label>
                  <select
                    value={experienceLevel}
                    onChange={(e) => setExperienceLevel(e.target.value)}
                    className="w-full rounded-lg border border-gray-soft px-3 py-2 text-ink bg-white focus:border-violet focus:outline-none focus:ring-2 focus:ring-violet/20"
                  >
                    <option value="entry">Entry Level</option>
                    <option value="mid">Mid Level</option>
                    <option value="senior">Senior</option>
                    <option value="lead">Lead</option>
                  </select>
                </div>
              </div>
            </div>

            {error && <p className="mt-4 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {message && <p className="mt-4 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2">{message}</p>}

            <button
              onClick={saveRole}
              disabled={loading}
              className="mt-5 inline-flex items-center gap-2 bg-violet text-white font-medium px-4 py-2 rounded-lg hover:bg-violet-dark transition-colors disabled:opacity-60"
            >
              <Plus size={16} />
              {loading ? 'Saving…' : 'Create Role'}
            </button>
          </div>

          {/* Roles List */}
          <h2 className="font-heading font-semibold text-lg text-ink mb-4">Your roles</h2>

          {roles.length === 0 ? (
            <div className="bg-white rounded-2xl border border-dashed border-gray-soft p-10 text-center">
              <div className="w-12 h-12 bg-lavender rounded-xl flex items-center justify-center mx-auto mb-3">
                <Briefcase className="text-violet" size={20} />
              </div>
              <p className="font-medium text-ink">No roles yet</p>
              <p className="text-sm text-gray-mid mt-1">Create your first role above to get started.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {roles.map((role) => (
                <Link
                  key={role.id}
                  href={'/roles/' + role.id}
                  className="flex items-center justify-between bg-white rounded-2xl border border-gray-soft p-5 hover:border-violet transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-10 h-10 bg-lavender rounded-xl flex items-center justify-center shrink-0">
                      <Briefcase className="text-violet" size={18} />
                    </div>
                    <div className="min-w-0">
                      <div className="font-medium text-ink truncate">{role.title}</div>
                      <div className="flex flex-wrap items-center gap-1.5 mt-1">
                        {role.department && (
                          <span className="text-xs bg-lavender text-violet font-medium px-2 py-0.5 rounded-full">
                            {role.department}
                          </span>
                        )}
                        {role.employment_type && (
                          <span className="text-xs bg-gray-100 text-gray-mid font-medium px-2 py-0.5 rounded-full">
                            {employmentLabel(role.employment_type)}
                          </span>
                        )}
                        {role.experience_level && (
                          <span className="text-xs bg-gray-100 text-gray-mid font-medium px-2 py-0.5 rounded-full">
                            {experienceLabel(role.experience_level)}
                          </span>
                        )}
                        {!role.department && !role.employment_type && !role.experience_level && (
                          <span className="text-xs text-gray-mid">Open role</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <ArrowRight className="text-gray-mid shrink-0" size={18} />
                </Link>
              ))}
            </div>
          )}

        </div>
      </main>
    </div>
  )
}