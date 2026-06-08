import { NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req) {
    try {
        const { email, jobTitle } = await req.json()

        await resend.emails.send({
            from: 'Recrewt AI <mike@recrewtai.com>',
            to: 'michaelrokkala@gmail.com',
            subject: 'New signup on Recrewt AI',
            text: `Someone just completed onboarding.\n\nEmail: ${email}\nFirst role: ${jobTitle}`,
        })

        return NextResponse.json({ success: true })
    } catch (err) {
        console.error('Notify signup error:', err)
        return NextResponse.json({ error: 'Failed' }, { status: 500 })
    }
}cat "C:\Users\Michael\Desktop\interview-ai\app\interview\[stageId]\transcript\page.js"