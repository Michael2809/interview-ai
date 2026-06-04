import Razorpay from 'razorpay'
import { NextResponse } from 'next/server'

const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET,
})

const PLANS = {
    starter: {
        amount: 999900,   // ₹9,999 in paise
        name: 'Starter Plan',
    },
    growth: {
        amount: 2499900,  // ₹24,999 in paise
        name: 'Growth Plan',
    },
}

export async function POST(req) {
    try {
        const { plan } = await req.json()

        if (!PLANS[plan]) {
            return NextResponse.json({ error: 'Invalid plan' }, { status: 400 })
        }

        const order = await razorpay.orders.create({
            amount: PLANS[plan].amount,
            currency: 'INR',
            receipt: `receipt_${plan}_${Date.now()}`,
            notes: {
                plan,
            },
        })

        return NextResponse.json({
            orderId: order.id,
            amount: order.amount,
            currency: order.currency,
            plan,
        })
    } catch (err) {
        console.error('Create order error:', err)
        return NextResponse.json({ error: 'Failed to create order' }, { status: 500 })
    }
}