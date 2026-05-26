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
    const [selected, setSelected] = useState(null)

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
        if (lineData) {
            setLines(lineData)
            const names = [...new Set(lineData.map((l) => l.candidate_name).filter(Boolean))]
            if (names.length > 0) setSelected(names[0])
        }
    }

    useEffect(() => {
        loadData()
    }, [])

    const candidates = [...new Set(lines.map((l) => l.candidate_name).filter(Boolean))]

    function getVideoForCandidate(name) {
        const videoLine = lines.find((l) => l.candidate_name === name && l.speaker === 'video')
        return videoLine ? videoLine.video_url : null
    }

    function getAnalysisForCandidate(name) {
        const analysisLine = lines.find((l) => l.candidate_name === name && l.speaker === 'analysis')
        if (!analysisLine) return null
        try {
            return JSON.parse(analysisLine.content)
        } catch {
            return null
        }
    }

    function getTranscriptForCandidate(name) {
        return lines.filter((l) => l.candidate_name === name && l.speaker !== 'video' && l.speaker !== 'invite')
    }

    async function scoreCandidate(name) {
        const candidateLines = getTranscriptForCandidate(name)
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
        <div style={{ padding: '40px', maxWidth: '800px', display: 'flex', gap: '32px' }}>
            
            <div style={{ width: '200px', flexShrink: 0 }}>
                <a href="/roles" style={{ color: '#666', fontSize: '13px' }}>Back to roles</a>
                <h2 style={{ fontSize: '16px', marginTop: '16px', marginBottom: '12px' }}>Candidates</h2>
                {candidates.length === 0 && <p style={{ color: '#999', fontSize: '13px' }}>No interviews yet.</p>}
                {candidates.map((name) => (
                    <div
                        key={name}
                        onClick={() => setSelected(name)}
                        style={{
                            padding: '10px 12px',
                            marginBottom: '6px',
                            cursor: 'pointer',
                            borderRadius: '4px',
                            background: selected === name ? '#000' : '#f5f5f5',
                            color: selected === name ? '#fff' : '#000',
                            fontSize: '14px',
                        }}
                    >
                        {name}
                    </div>
                ))}
            </div>

            <div style={{ flex: 1 }}>
                {!selected && <p style={{ color: '#999' }}>Select a candidate to view their interview.</p>}

                {selected && (
                    <div>
                        <h1 style={{ fontSize: '22px', marginBottom: '4px' }}>{selected}</h1>
                        <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>
                            {stage ? stage.name : ''} Interview
                        </p>

                        {getVideoForCandidate(selected) && (
                            <div style={{ marginBottom: '24px' }}>
                                <strong style={{ fontSize: '14px' }}>Recording</strong>
                                <video
                                    src={getVideoForCandidate(selected)}
                                    controls
                                    style={{ width: '100%', marginTop: '8px', borderRadius: '4px', background: '#000' }}
                                />
                            </div>
                        )}

                        {getAnalysisForCandidate(selected) && (
                            <div style={{ marginBottom: '24px', padding: '16px', background: '#f9f9f9', border: '1px solid #eee', borderRadius: '6px' }}>
                                <strong style={{ fontSize: '14px' }}>Speech Analysis</strong>
                                <div style={{ marginTop: '12px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                                    <div style={{ padding: '12px', background: '#fff', border: '1px solid #eee', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Speaking Pace</div>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{getAnalysisForCandidate(selected).wordsPerMinute} <span style={{ fontSize: '12px', color: '#666' }}>wpm</span></div>
                                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>Normal: 120-160 wpm</div>
                                    </div>
                                    <div style={{ padding: '12px', background: '#fff', border: '1px solid #eee', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Filler Words</div>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{getAnalysisForCandidate(selected).fillerWordCount}</div>
                                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>um, uh, like, you know</div>
                                    </div>
                                    <div style={{ padding: '12px', background: '#fff', border: '1px solid #eee', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Pronunciation Clarity</div>
                                        <div style={{ fontSize: '20px', fontWeight: 'bold' }}>{getAnalysisForCandidate(selected).avgPronunciationConfidence}%</div>
                                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>Based on speech confidence</div>
                                    </div>
                                    <div style={{ padding: '12px', background: '#fff', border: '1px solid #eee', borderRadius: '4px' }}>
                                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Sentiment</div>
                                        <div style={{ fontSize: '14px', fontWeight: 'bold' }}>
                                            {getAnalysisForCandidate(selected).sentimentBreakdown.positive}P / {getAnalysisForCandidate(selected).sentimentBreakdown.neutral}N / {getAnalysisForCandidate(selected).sentimentBreakdown.negative}Neg
                                        </div>
                                        <div style={{ fontSize: '11px', color: '#999', marginTop: '2px' }}>Positive / Neutral / Negative</div>
                                    </div>
                                </div>
                            </div>
                        )}

                        <div style={{ marginBottom: '24px' }}>
                            <strong style={{ fontSize: '14px' }}>Transcript</strong>
                            <div style={{ marginTop: '8px' }}>
                                {getTranscriptForCandidate(selected).map((line) => (
                                    <div key={line.id} style={{ marginBottom: '12px' }}>
                                        <span style={{
                                            fontSize: '12px',
                                            fontWeight: 'bold',
                                            color: line.speaker === 'interviewer' ? '#000' : '#0066cc',
                                            textTransform: 'uppercase'
                                        }}>
                                            {line.speaker === 'interviewer' ? 'Interviewer' : selected}
                                        </span>
                                        <p style={{ margin: '4px 0 0', fontSize: '14px', color: '#333' }}>{line.content}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div>
                            <button
                                onClick={() => scoreCandidate(selected)}
                                disabled={scoring[selected]}
                                style={{ padding: '8px 16px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}
                            >
                                {scoring[selected] ? 'Scoring...' : 'Score this candidate'}
                            </button>

                            {scores[selected] && !scores[selected].error && (
                                <div style={{ marginTop: '12px', padding: '12px', background: '#f9f9f9', border: '1px solid #eee' }}>
                                    <strong>Score: {scores[selected].score}/10</strong>
                                    <p style={{ margin: '8px 0 0', color: '#444', fontSize: '14px' }}>{scores[selected].summary}</p>
                                </div>
                            )}

                            {scores[selected] && scores[selected].error && (
                                <p style={{ color: 'red', marginTop: '8px' }}>{scores[selected].error}</p>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    )
}