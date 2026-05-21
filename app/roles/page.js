'use client'

import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

export default function RolesPage() {
    const [title, setTitle] = useState('')
    const [message, setMessage] = useState('')
    const [roles, setRoles] = useState([])

    async function loadRoles() {
        const { data } = await supabase
            .from('roles')
            .select()
            .order('created_at', { ascending: false })
        if (data) setRoles(data)
    }

    useEffect(() => {
        loadRoles()
    }, [])

    async function saveRole() {
        if (!title) {
            setMessage('Please type a job title first.')
            return
        }

        const { error } = await supabase.from('roles').insert({ title: title })

        if (error) {
            setMessage('Something went wrong: ' + error.message)
        } else {
            setMessage('Saved! Role "' + title + '" was added.')
            setTitle('')
            loadRoles()
        }
    }

    return (
        <div style={{ padding: '40px', maxWidth: '500px' }}>
            <h1 style={{ fontSize: '24px', marginBottom: '20px' }}>Create a Role</h1>

            <input
                type="text"
                placeholder="e.g. Junior Backend Developer"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={{ padding: '10px', width: '100%', marginBottom: '10px', border: '1px solid #ccc' }}
            />

            <button
                onClick={saveRole}
                style={{ padding: '10px 20px', background: '#000', color: '#fff', border: 'none', cursor: 'pointer' }}
            >
                Save Role
            </button>

            {message && <p style={{ marginTop: '20px' }}>{message}</p>}

            <h2 style={{ fontSize: '20px', marginTop: '40px', marginBottom: '10px' }}>Your Roles</h2>

            {roles.length === 0 && <p>No roles yet.</p>}

            {roles.map((role) => (
                <a key={role.id} href={'/roles/' + role.id} style={{ display: 'block', padding: '12px', border: '1px solid #eee', marginBottom: '8px', textDecoration: 'none', color: '#000' }}>
                    {role.title}
                </a>
            ))}
        </div>
    )
}