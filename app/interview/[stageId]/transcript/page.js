'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'

export default function TranscriptPage() {
    const params = useParams()
    const stageId = params.stageId

    const [stage, setStage] = useState(null)
    const [lines, setLines] = useState([])
    const [scores, setScores] = useState({})
    const [scoring, setScoring] = useState({})

    async function loadData() {
        const { data: stageData } = await supabase
            .from('stages')
            .select()
            .eq('id', stageId)
            .single()
        if (stageData) setStage(stageData)

        const { data: lineData } = await supabase
            .from('interviews')
            .select()
            .eq('stage_id', stageId)
            .order('created_at', { ascending: true })
        if (lineData) setLines(lineData)
    }

    useEffect(() => {
        loadData()
    }, [])

    const candidates = [...new Set(lines.map((l) => l.candidate_name).filter(Boolean))]

    async function scoreCandidate(name) {
        const candidateLines = lines.filter((l) => l.candidate_name === name)
        setScoring({ ...scoring, [name]: true })

        const response = await fetch('/api/score-interview', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                transcript: candidateLines,
                stageName: stage.name,
            }),
        })

        const result = await response.json()
        setScoring({ ...scoring, [name]: false })

        if (result.error) {
            setScores({ ...scores, [name]: { error: result.error } })
        } else {
            setScores({ ...scores, [name]: result })
        }
    }

    return (
        <div style={{ padding: '40px', maxWidth: '600px' }}>
            <a href={'/roles'} style={{ color: '#666' }}>Back to roles</a>
            <h1 style={{ fontSize: '24px', marginTop: '20px' }}>
                {stage ? stage.name + ' Transcript' : 'Loading...'}
            </h1>

            {lines.length === 0 && <p style={{ color: '#666' }}>No interviews recorded yet.</p>}

            {candidates.map((name) => (
                <div key={name} style={{ marginTop: '30px', padding: '16px', border: '1px solid #eee' }}>
                    <h2 style={{ fontSize: '18px', borderBottom: '1px solid #eee', paddingBottom: '6px' }}>
                        Candidate: {name}
                    </h2>

                    {lines
                        .filter((l) => l.candidate_name === name)
                        .map((line) => (
                            <div key={line.id} style={{ marginTop: '12px' }}>
                                <strong style={{ color: line.speaker === 'interviewer' ? '#000' : '#0066cc' }}>
                                    {line.speaker === 'interviewer' ? 'Interviewer' : name}:
                                </strong>
                                <p style={{ margin: '4px 0' }}>{line.content}</p>
                            </div>
                        ))}

                    <div style={{ marginTop: '16px' }}>
                        <button
                            onClick={() => scoreCandidate(name)}
                            disabled={scoring[name]}
                            style={{ padding: '8px 16px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}
                        >
                            {scoring[name] ? 'Scoring...' : 'Score this candidate'}
                        </button>

                        {scores[name] && !scores[name].error && (
                            <div style={{ marginTop: '12px', padding: '12px', background: '#f9f9f9', border: '1px solid #eee' }}>
                                <strong>Score: {scores[name].score}/10</strong>
                                <p style={{ margin: '8px 0 0', color: '#444' }}>{scores[name].summary}</p>
                            </div>
                        )}

                        {scores[name] && scores[name].error && (
                            <p style={{ color: 'red', marginTop: '8px' }}>{scores[name].error}</p>
                        )}
                    </div>
                </div>
            ))}
        </div>
    )
}