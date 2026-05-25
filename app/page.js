'use client'

import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function HomePage() {
  const supabase = createClient()
  const router = useRouter()

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div style={{ padding: '40px', maxWidth: '600px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px' }}>
        <h1 style={{ fontSize: '28px' }}>AI Interview Assistant</h1>
        <button onClick={handleLogout} style={{ padding: '8px 16px', cursor: 'pointer' }}>
          Logout
        </button>
      </div>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Set up staged interviews, let AI draft questions, and review candidate transcripts.
      </p>
      <a
        href="/roles"
        style={{ display: 'inline-block', padding: '12px 24px', background: '#000', color: '#fff', textDecoration: 'none' }}
      >
        Go to Roles
      </a>
    </div>
  )
}