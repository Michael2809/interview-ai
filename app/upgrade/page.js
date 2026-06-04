'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Script from 'next/script'
import { createClient } from '@/lib/supabase/client'

const PLANS = {
  starter: {
    name: 'Starter',
    price: 9999,
    display: '₹9,999',
    description: 'Your first AI recruiter. No salary required.',
    candidates: 'up to 100 candidates / month',
    features: [
      '3 active roles',
      '100 interviews / month',
      'AI writes your questions',
      'Video interviews on autopilot',
      'Auto-scoring & full transcript',
      'Basic speech analysis',
      'Email support',
    ],
  },
  growth: {
    name: 'Growth',
    price: 24999,
    display: '₹24,999',
    description: 'Hire like a company 10x your size.',
    candidates: 'up to 500 candidates / month',
    features: [
      'Unlimited roles',
      '500 interviews / month',
      'Full sentiment analysis',
      'Advanced AI score breakdown',
      'CSV bulk invites',
      'Interview progress dashboard',
      '3 team logins',
      'Same-day priority support',
    ],
  },
}

export default function UpgradePage() {
  const router = useRouter()
  const supabase = createClient()

  const [preselectedPlan, setPreselectedPlan] = useState(null)
  const [userId, setUserId] = useState(null)
  const [userEmail, setUserEmail] = useState('')
  const [loading, setLoading] = useState(null)
  const [scriptReady, setScriptReady] = useState(false)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const plan = params.get('plan')
    if (plan) setPreselectedPlan(plan)
  }, [])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      if (!data?.user) {
        const plan = new URLSearchParams(window.location.search).get('plan')
        router.push('/login?next=' + encodeURIComponent('/upgrade' + (plan ? '?plan=' + plan : '')))
        return
      }
      setUserId(data.user.id)
      setUserEmail(data.user.email)
    })
  }, [])

  useEffect(() => {
    if (userId && scriptReady && preselectedPlan && PLANS[preselectedPlan]) {
      handleUpgrade(preselectedPlan)
    }
  }, [userId, scriptReady, preselectedPlan])

  async function handleUpgrade(plan) {
    if (!userId) return
    setLoading(plan)

    try {
      const res = await fetch('/api/create-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })
      const order = await res.json()
      if (order.error) throw new Error(order.error)

      const options = {
        key: process.env.NEXT_PUBLIC_RAZORPAY_KEY_ID,
        amount: order.amount,
        currency: order.currency,
        name: 'Recrewt AI',
        description: PLANS[plan].name + ' Plan',
        order_id: order.orderId,
        prefill: { email: userEmail },
        theme: { color: '#6C5CE7' },
        handler: async function (response) {
          const verify = await fetch('/api/verify-payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              plan,
              userId,
            }),
          })
          const result = await verify.json()
          if (result.success) {
            router.push('/dashboard?upgraded=true')
          } else {
            alert('Payment verification failed. Please contact support.')
            setLoading(null)
          }
        },
        modal: { ondismiss: () => setLoading(null) },
      }

      const rzp = new window.Razorpay(options)
      rzp.open()

    } catch (err) {
      console.error('Upgrade error:', err)
      alert('Something went wrong. Please try again.')
      setLoading(null)
    }
  }

  return (
    <>
      <Script
        src="https://checkout.razorpay.com/v1/checkout.js"
        strategy="afterInteractive"
        onReady={() => setScriptReady(true)}
      />

      <div className="min-h-screen bg-white py-16 px-6">
        <div className="max-w-4xl mx-auto">

          <div className="text-center mb-12">
            <h1 className="font-heading font-bold text-3xl text-ink tracking-tight">
              Upgrade your plan
            </h1>
            <p className="mt-3 text-gray-mid">
              You've seen what Recrewt can do. Now let it run your hiring.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">

            <div className="bg-white border border-gray-soft rounded-2xl p-7 flex flex-col">
              <div className="font-heading font-bold text-lg text-ink">{PLANS.starter.name}</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-heading font-bold text-4xl text-ink tracking-tight">{PLANS.starter.display}</span>
                <span className="text-sm text-gray-mid">/month</span>
              </div>
              <div className="text-sm font-semibold text-violet mt-1">{PLANS.starter.candidates}</div>
              <hr className="my-4 border-gray-soft" />
              <p className="text-sm italic text-violet mb-5">"{PLANS.starter.description}"</p>
              <div className="flex flex-col gap-3 flex-1">
                {PLANS.starter.features.map((f) => (
                  <p key={f} className="text-sm text-ink">✓&nbsp; {f}</p>
                ))}
              </div>
              <div className="mt-6">
                <button
                  onClick={() => handleUpgrade('starter')}
                  disabled={loading === 'starter' || !scriptReady}
                  className="w-full border-2 border-violet text-violet font-semibold text-sm py-3 rounded-xl hover:bg-violet hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === 'starter' ? 'Opening checkout...' : 'Upgrade to Starter'}
                </button>
              </div>
            </div>

            <div className="bg-ink rounded-2xl p-7 flex flex-col relative">
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-yellow text-ink text-xs font-bold px-4 py-1 rounded-full font-heading whitespace-nowrap">
                MOST POPULAR
              </div>
              <div className="font-heading font-bold text-lg text-white">{PLANS.growth.name}</div>
              <div className="mt-3 flex items-baseline gap-1">
                <span className="font-heading font-bold text-4xl text-white tracking-tight">{PLANS.growth.display}</span>
                <span className="text-sm text-gray-mid">/month</span>
              </div>
              <div className="text-sm font-semibold text-yellow mt-1">{PLANS.growth.candidates}</div>
              <hr className="my-4 border-gray-mid opacity-20" />
              <p className="text-sm italic text-lavender mb-5">"{PLANS.growth.description}"</p>
              <div className="flex flex-col gap-3 flex-1">
                {PLANS.growth.features.map((f) => (
                  <p key={f} className="text-sm text-white">✓&nbsp; {f}</p>
                ))}
              </div>
              <div className="mt-6">
                <button
                  onClick={() => handleUpgrade('growth')}
                  disabled={loading === 'growth' || !scriptReady}
                  className="w-full bg-violet text-white font-semibold text-sm py-3 rounded-xl hover:bg-violet-dark transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading === 'growth' ? 'Opening checkout...' : 'Upgrade to Growth'}
                </button>
              </div>
            </div>

          </div>

          <div className="mt-6 bg-white border border-gray-soft rounded-2xl p-7 text-center">
            <div className="font-heading font-bold text-lg text-ink">Enterprise</div>
            <p className="text-sm text-gray-mid mt-1 mb-4">Unlimited everything. Dedicated support. Built around your hiring.</p>
            <a
              href="mailto:hello@recrewtai.com"
              className="inline-block border-2 border-ink text-ink text-sm font-semibold px-8 py-2.5 rounded-xl hover:bg-ink hover:text-white transition-colors"
            >
              Talk to Sales
            </a>
          </div>

          <div className="text-center mt-8">
            <button
              onClick={() => router.push('/dashboard')}
              className="text-sm text-gray-mid hover:text-ink transition-colors"
            >
              ← Back to dashboard
            </button>
          </div>

        </div>
      </div>
    </>
  )
}