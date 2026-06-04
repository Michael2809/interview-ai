import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)

export async function POST(req) {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, userId } = await req.json()

        // 1. Verify the payment signature
        const body = razorpay_order_id + '|' + razorpay_payment_id
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex')

        if (expectedSignature !== razorpay_signature) {
            return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
        }

        // 2. Update the user's plan in settings
        const { error } = await supabaseAdmin
            .from('settings')
            .update({ plan })
            .eq('user_id', userId)

        if (error) {
            console.error('Settings update error:', error)
            return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
        }

        return NextResponse.json({ success: true, plan })
    } catch (err) {
        console.error('Verify payment error:', err)
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
    }
}