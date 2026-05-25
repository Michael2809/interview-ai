'use client'

import { useState, useEffect } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function RoleDetailPage() {
    const params = useParams()
    const roleId = params.id

    const [role, setRole] = useState(null)
    const [stages, setStages] = useState([])
    const [questions, setQuestions] = useState([])

    const [name, setName] = useState('')
    const [level, setLevel] = useState('easy')
    const [topics, setTopics] = useState('')
    const [message, setMessage] = useState('')
    const [busyStageId, setBusyStageId] = useState(null)
    const [origin, setOrigin] = useState('')
    const [inviteEmail, setInviteEmail] = useState({})

    useEffect(() => {
        setOrigin(window.location.origin)
    }, [])

    async function loadRole() {
        const { data } = await supabase.from('roles').select().eq('id', roleId).single()
        if (data) setRole(data)
    }

    async function loadStages() {
        const { data } = await supabase
            .from('stages')
            .select()
            .eq('role_id', roleId)
            .order('position', { ascending: true })
        if (data) setStages(data)
    }

    async function loadQuestions() {
        const { data } = await supabase.from('questions').select()
        if (data) setQuestions(data)
    }

    useEffect(() => {
        loadRole()
        loadStages()
        loadQuestions()
    }, [])

    async function saveStage() {
        if (!name) {
            setMessage('Please type a stage name first.')
            return
        }
        const nextPosition = stages.length + 1
        const { error } = await supabase.from('stages').insert({
            role_id: roleId,
            name: name,
            level: level,
            position: nextPosition,
            topics: topics,
        })
        if (error) {
            setMessage('Something went wrong: ' + error.message)
        } else {
            setMessage('Stage added.')
            setName('')
            setTopics('')
            setLevel('easy')
            loadStages()
        }
    }

    async function draftQuestions(stage) {
        setBusyStageId(stage.id)
        setMessage('Drafting questions for ' + stage.name + '...')

        const response = await fetch('/api/generate-questions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                stageName: stage.name,
                level: stage.level,
                topics: stage.topics,
            }),
        })

        const result = await response.json()
        setBusyStageId(null)

        if (result.error) {
            setMessage('AI error: ' + result.error)
            return
        }

        const rows = result.questions.map((q) => ({
            stage_id: stage.id,
            text: q,
            approved: false,
        }))

        const { error } = await supabase.from('questions').insert(rows)
        if (error) {
            setMessage('Could not save questions: ' + error.message)
        } else {
            setMessage('Questions drafted for ' + stage.name + '.')
            loadQuestions()
        }
    }

    async function toggleApprove(question) {
        await supabase
            .from('questions')
            .update({ approved: !question.approved })
            .eq('id', question.id)
        loadQuestions()
    }

    async function sendInvite(stageId) {
        const email = inviteEmail[stageId]
        if (!email) {
            setMessage('Please enter a candidate email.')
            return
        }
        setMessage('Sending invite...')
        const response = await fetch('/api/send-invite', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ stageId, candidateEmail: email, origin }),
        })
        const result = await response.json()
        if (result.error) {
            setMessage('Error: ' + result.error)
        } else {
            setMessage('Invite sent to ' + email)
            setInviteEmail({ ...inviteEmail, [stageId]: '' })
        }
    }

    return (
        <div style={{ padding: '40px', maxWidth: '600px' }}>
            <a href="/roles" style={{ color: '#666' }}>Back to all roles</a>

            <h1 style={{ fontSize: '24px', marginTop: '20px' }}>
                {role ? role.title : 'Loading...'}
            </h1>

            <h2 style={{ fontSize: '20px', marginTop: '30px', marginBottom: '10px' }}>Interview Stages</h2>

            {stages.length === 0 && <p style={{ color: '#666' }}>No stages yet.</p>}

            {stages.map((stage) => (
                <div key={stage.id} style={{ padding: '12px', border: '1px solid #eee', marginBottom: '12px' }}>
                    <strong>{stage.position}. {stage.name}</strong>
                    <div style={{ color: '#666', fontSize: '14px', marginBottom: '8px' }}>
                        Level: {stage.level} — Topics: {stage.topics || 'none'}
                    </div>

                    <button
                        onClick={() => draftQuestions(stage)}
                        disabled={busyStageId === stage.id}
                        style={{ padding: '6px 12px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer', fontSize: '13px' }}
                    >
                        {busyStageId === stage.id ? 'Drafting...' : 'Draft questions with AI'}
                    </button>

                    {questions
                        .filter((q) => q.stage_id === stage.id)
                        .map((q) => (
                            <div key={q.id} style={{ marginTop: '8px', fontSize: '14px' }}>
                                <label style={{ cursor: 'pointer' }}>
                                    <input
                                        type="checkbox"
                                        checked={q.approved}
                                        onChange={() => toggleApprove(q)}
                                    />{' '}
                                    {q.text} {q.approved ? 'approved' : ''}
                                </label>
                            </div>
                        ))}

                    <div style={{ marginTop: '10px', fontSize: '13px' }}>
                        <input
                            type="email"
                            placeholder="Candidate email"
                            value={inviteEmail[stage.id] || ''}
                            onChange={(e) => setInviteEmail({ ...inviteEmail, [stage.id]: e.target.value })}
                            style={{ padding: '6px', width: '60%', border: '1px solid #ccc', marginRight: '8px' }}
                        />
                        <button
                            onClick={() => sendInvite(stage.id)}
                            style={{ padding: '6px 12px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}
                        >
                            Send Invite
                        </button>
                    </div>

                    <div style={{ marginTop: '8px', fontSize: '13px' }}>
                        <a href={'/interview/' + stage.id + '/transcript'} style={{ color: '#0066cc' }}>
                            View transcript
                        </a>
                    </div>
                </div>
            ))}

            <h3 style={{ fontSize: '16px', marginTop: '30px', marginBottom: '10px' }}>Add a stage</h3>

            <input
                type="text"
                placeholder="Stage name, e.g. Screening Call"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ padding: '10px', width: '100%', marginBottom: '8px', border: '1px solid #ccc' }}
            />

            <select
                value={level}
                onChange={(e) => setLevel(e.target.value)}
                style={{ padding: '10px', width: '100%', marginBottom: '8px', border: '1px solid #ccc' }}
            >
                <option value="easy">Easy</option>
                <option value="intermediate">Intermediate</option>
                <option value="hard">Hard</option>
            </select>

            <input
                type="text"
                placeholder="Topics, e.g. communication, basic skills"
                value={topics}
                onChange={(e) => setTopics(e.target.value)}
                style={{ padding: '10px', width: '100%', marginBottom: '8px', border: '1px solid #ccc' }}
            />

            <button
                onClick={saveStage}
                style={{ padding: '10px 20px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
                Add Stage
            </button>

            {message && <p style={{ marginTop: '20px' }}>{message}</p>}
        </div>
    )
}