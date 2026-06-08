import crypto from 'crypto'
import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
)
const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req) {
    try {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature, plan, userId } = await req.json()

        const body = razorpay_order_id + '|' + razorpay_payment_id
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(body)
            .digest('hex')

        if (expectedSignature !== razorpay_signature) {
            return NextResponse.json({ error: 'Invalid payment signature' }, { status: 400 })
        }

        // Get user email
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(userId)

        const { error } = await supabaseAdmin
            .from('settings')
            .update({ plan })
            .eq('user_id', userId)

        if (error) {
            console.error('Settings update error:', error)
            return NextResponse.json({ error: 'Failed to update plan' }, { status: 500 })
        }

        // Notify you
        await resend.emails.send({
            from: 'Recrewt AI <mike@recrewtai.com>',
            to: 'michaelrokkala@gmail.com',
            subject: `New payment - ${plan} plan`,
            text: `Someone just upgraded to the ${plan} plan.\n\nUser ID: ${userId}\nEmail: ${user?.email || 'unknown'}\nPayment ID: ${razorpay_payment_id}`,
        }).catch(() => {})

        return NextResponse.json({ success: true, plan })
    } catch (err) {
        console.error('Verify payment error:', err)
        return NextResponse.json({ error: 'Verification failed' }, { status: 500 })
    }
}