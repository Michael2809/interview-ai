'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function InterviewPage() {
    const params = useParams()
    const stageId = params.stageId

    const [stage, setStage] = useState(null)
    const [questions, setQuestions] = useState([])
    const [started, setStarted] = useState(false)
    const [finished, setFinished] = useState(false)

    const [candidateName, setCandidateName] = useState('')
    const [currentIndex, setCurrentIndex] = useState(0)
    const [currentQuestion, setCurrentQuestion] = useState('')
    const [answer, setAnswer] = useState('')
    const [transcript, setTranscript] = useState([])
    const [busy, setBusy] = useState(false)
    const [askedFollowUp, setAskedFollowUp] = useState(false)

    async function loadData() {
        const { data: stageData } = await supabase
            .from('stages')
            .select()
            .eq('id', stageId)
            .single()
        if (stageData) setStage(stageData)

        const { data: questionData } = await supabase
            .from('questions')
            .select()
            .eq('stage_id', stageId)
            .eq('approved', true)
        if (questionData) setQuestions(questionData)
    }

    useEffect(() => {
        loadData()
    }, [])

    function startInterview() {
        if (!candidateName) return
        if (questions.length === 0) return
        setStarted(true)
        setCurrentQuestion(questions[0].text)
        addLine('interviewer', questions[0].text)
    }

    async function addLine(speaker, content) {
        setTranscript((prev) => [...prev, { speaker, content }])
        await supabase.from('interviews').insert({
            stage_id: stageId,
            speaker: speaker,
            content: content,
            candidate_name: candidateName,
        })
    }

    async function submitAnswer() {
        if (!answer) return
        setBusy(true)

        const myAnswer = answer
        await addLine('candidate', myAnswer)
        setAnswer('')

        if (!askedFollowUp) {
            const response = await fetch('/api/follow-up', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    stageName: stage.name,
                    level: stage.level,
                    question: currentQuestion,
                    answer: myAnswer,
                }),
            })
            const result = await response.json()
            setBusy(false)

            if (result.followUp) {
                setAskedFollowUp(true)
                setCurrentQuestion(result.followUp)
                addLine('interviewer', result.followUp)
                return
            }
        }

        setBusy(false)
        goToNextQuestion()
    }

    function goToNextQuestion() {
        const nextIndex = currentIndex + 1
        setAskedFollowUp(false)

        if (nextIndex >= questions.length) {
            setFinished(true)
            return
        }

        setCurrentIndex(nextIndex)
        setCurrentQuestion(questions[nextIndex].text)
        addLine('interviewer', questions[nextIndex].text)
    }

    if (finished) {
        return (
            <div style={{ padding: '40px', maxWidth: '600px' }}>
                <h1 style={{ fontSize: '24px' }}>Interview complete</h1>
                <p style={{ color: '#666' }}>Thank you, {candidateName}. Your responses have been recorded.</p>
            </div>
        )
    }

    if (!started) {
        return (
            <div style={{ padding: '40px', maxWidth: '600px' }}>
                <h1 style={{ fontSize: '24px' }}>
                    {stage ? stage.name + ' Interview' : 'Loading...'}
                </h1>

                {stage && questions.length === 0 && (
                    <p style={{ color: '#c00' }}>
                        This stage has no approved questions yet.
                    </p>
                )}

                {stage && questions.length > 0 && (
          <div>
            <div style={{ padding: '12px', background: '#fff4e5', border: '1px solid #f0c674', marginBottom: '16px', fontSize: '13px', color: '#664400' }}>
              <strong>Demo:</strong> This is a working demo of the AI Interview Assistant. Responses are for demonstration purposes only and are not used in real hiring decisions.
            </div>
            <p style={{ color: '#666' }}>Please enter your name to begin.</p>
                        <input
                            type="text"
                            placeholder="Your name"
                            value={candidateName}
                            onChange={(e) => setCandidateName(e.target.value)}
                            style={{ padding: '10px', width: '100%', marginBottom: '10px', border: '1px solid #ccc' }}
                        />
                        <button
                            onClick={startInterview}
                            style={{ padding: '10px 20px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}
                        >
                            Start Interview
                        </button>
                    </div>
                )}
            </div>
        )
    }

    return (
        <div style={{ padding: '40px', maxWidth: '600px' }}>
            <h1 style={{ fontSize: '20px', marginBottom: '20px' }}>{stage.name} Interview</h1>

            <div style={{ padding: '16px', border: '1px solid #eee', marginBottom: '16px' }}>
                <strong>Interviewer:</strong>
                <p>{currentQuestion}</p>
            </div>

            <textarea
                placeholder="Type your answer here..."
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                rows={5}
                style={{ padding: '10px', width: '100%', marginBottom: '10px', border: '1px solid #ccc' }}
            />

            <button
                onClick={submitAnswer}
                disabled={busy}
                style={{ padding: '10px 20px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
                {busy ? 'Thinking...' : 'Submit Answer'}
            </button>
        </div>
    )
}