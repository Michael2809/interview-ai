'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../../lib/supabase'

export default function TranscriptPage() {
    const params = useParams()
    const stageId = params.stageId

    const [stage, setStage] = useState(null)
    const [lines, setLines] = useState([])

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

    const candidates = [...new Set(lines.map((l) => l.candidate_name))]

    return (
        <div style={{ padding: '40px', maxWidth: '600px' }}>
            <h1 style={{ fontSize: '24px' }}>
                {stage ? stage.name + ' — Transcript' : 'Loading...'}
            </h1>

            {lines.length === 0 && <p style={{ color: '#666' }}>No interviews recorded yet.</p>}

            {candidates.map((name) => (
                <div key={name} style={{ marginTop: '30px' }}>
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
                </div>
            ))}
        </div>
    )
}