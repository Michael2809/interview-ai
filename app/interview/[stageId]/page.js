'use client'

import { useState, useEffect, useRef } from 'react'
import { useParams } from 'next/navigation'
import { supabase } from '../../../lib/supabase'

export default function InterviewPage() {
    const params = useParams()
    const stageId = params.stageId

    const [stage, setStage] = useState(null)
    const [questions, setQuestions] = useState([])
    const [started, setStarted] = useState(false)
    const [finished, setFinished] = useState(false)
    const [uploading, setUploading] = useState(false)

    const [candidateName, setCandidateName] = useState('')
    const [currentIndex, setCurrentIndex] = useState(0)
    const [currentQuestion, setCurrentQuestion] = useState('')
    const [askedFollowUp, setAskedFollowUp] = useState(false)
    const [busy, setBusy] = useState(false)

    const [listening, setListening] = useState(false)
    const [spokenAnswer, setSpokenAnswer] = useState('')
    const [isSpeaking, setIsSpeaking] = useState(false)

    const videoRef = useRef(null)
    const mediaRecorderRef = useRef(null)
    const audioRecorderRef = useRef(null)
    const chunksRef = useRef([])
    const audioChunksRef = useRef([])
    const streamRef = useRef(null)
    const recognitionRef = useRef(null)
    const transcriptRef = useRef([])

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

    useEffect(() => {
        if (videoRef.current && streamRef.current) {
            videoRef.current.srcObject = streamRef.current
        }
    }, [started])

    function speakText(text, onDone) {
        window.speechSynthesis.cancel()
        const utterance = new SpeechSynthesisUtterance(text)

        const setVoiceAndSpeak = () => {
            const voices = window.speechSynthesis.getVoices()
            const preferred =
                voices.find(v => v.name === 'Google UK English Female') ||
                voices.find(v => v.name === 'Microsoft Heera - English (India)') ||
                voices.find(v => v.name === 'Microsoft Zira - English (United States)') ||
                voices.find(v => v.name.includes('Female') && v.lang.startsWith('en')) ||
                voices.find(v => v.lang === 'en-US')
            if (preferred) utterance.voice = preferred
            utterance.rate = 0.88
            utterance.pitch = 1.1
            utterance.volume = 1
            setIsSpeaking(true)
            utterance.onend = () => {
                setIsSpeaking(false)
                if (onDone) onDone()
            }
            window.speechSynthesis.speak(utterance)
        }

        if (window.speechSynthesis.getVoices().length === 0) {
            window.speechSynthesis.onvoiceschanged = setVoiceAndSpeak
        } else {
            setVoiceAndSpeak()
        }
    }

    async function startInterview() {
        if (!candidateName) return
        if (questions.length === 0) return

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            streamRef.current = stream

            if (videoRef.current) {
                videoRef.current.srcObject = stream
            }

            // Video recorder
            const videoRecorder = new MediaRecorder(stream, {
    mimeType: 'video/webm;codecs=vp8,opus',
    videoBitsPerSecond: 500000,
    audioBitsPerSecond: 64000
})
            mediaRecorderRef.current = videoRecorder
            chunksRef.current = []
            videoRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) chunksRef.current.push(e.data)
            }
            videoRecorder.start()

            // Audio-only recorder for AssemblyAI
            const audioStream = new MediaStream(stream.getAudioTracks())
            const audioRecorder = new MediaRecorder(audioStream, {
    mimeType: 'audio/webm;codecs=opus',
    audioBitsPerSecond: 64000
})
            audioRecorderRef.current = audioRecorder
            audioChunksRef.current = []
            audioRecorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data)
            }
            audioRecorder.start()

        } catch (err) {
            alert('Could not access camera or microphone: ' + err.message)
            return
        }

        setStarted(true)
        const firstQuestion = questions[0].text
        setCurrentQuestion(firstQuestion)
        await addLine('interviewer', firstQuestion)
        speakText(firstQuestion)
    }

    async function addLine(speaker, content) {
        transcriptRef.current = [...transcriptRef.current, { speaker, content }]
        await supabase.from('interviews').insert({
            stage_id: stageId,
            speaker,
            content,
            candidate_name: candidateName,
        })
    }

    function startListening() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) {
            alert('Your browser does not support speech recognition. Please use Chrome.')
            return
        }

        const recognition = new SpeechRecognition()
        recognitionRef.current = recognition
        recognition.continuous = true
        recognition.interimResults = true
        recognition.lang = 'en-US'
        recognition.maxAlternatives = 1

        let fullTranscript = ''

        recognition.onresult = (event) => {
            let interim = ''
            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i]
                if (result.isFinal) {
                    fullTranscript += result[0].transcript + ' '
                } else {
                    interim += result[0].transcript
                }
            }
            setSpokenAnswer(fullTranscript + interim)
        }

        recognition.onerror = (event) => {
            if (event.error !== 'no-speech') {
                console.error('Speech error:', event.error)
            }
        }

        recognition.onend = () => {
            if (listening) {
                recognition.start()
            }
        }

        recognition.start()
        setListening(true)
        setSpokenAnswer('')
    }

    function stopListening() {
        if (recognitionRef.current) {
            recognitionRef.current.stop()
        }
        setListening(false)
    }

    async function submitSpokenAnswer() {
        if (!spokenAnswer.trim()) return
        setBusy(true)

        const myAnswer = spokenAnswer.trim()
        setSpokenAnswer('')
        await addLine('candidate', myAnswer)

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
                await addLine('interviewer', result.followUp)
                speakText(result.followUp)
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
            finishInterview()
            return
        }

        setCurrentIndex(nextIndex)
        const nextQuestion = questions[nextIndex].text
        setCurrentQuestion(nextQuestion)
        addLine('interviewer', nextQuestion)
        speakText(nextQuestion)
    }

    async function finishInterview() {
        setUploading(true)
        window.speechSynthesis.cancel()

        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop()
        }
        if (audioRecorderRef.current && audioRecorderRef.current.state !== 'inactive') {
            audioRecorderRef.current.stop()
        }

        await new Promise((resolve) => setTimeout(resolve, 1500))

        if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => track.stop())
        }

        // Upload video
        const videoBlob = new Blob(chunksRef.current, { type: 'video/webm' })
        const videoFilename = stageId + '-' + Date.now() + '.webm'

        // Upload video directly to Cloudinary (bypasses Vercel's 4.5MB limit)
        let videoUrl = null
        try {
            const formData = new FormData()
            formData.append('file', videoBlob)
            formData.append('upload_preset', 'interview-videos')

            const uploadResponse = await fetch(
                'https://api.cloudinary.com/v1_1/dbrhpzdqz/video/upload',
                {
                    method: 'POST',
                    body: formData,
                }
            )

            const uploadResult = await uploadResponse.json()

            if (uploadResponse.ok) {
                videoUrl = uploadResult.secure_url
            } else {
                console.error('Video upload error:', uploadResult)
            }
        } catch (err) {
            console.error('Video upload exception:', err)
        }

        if (videoUrl) {
            await supabase.from('interviews').insert({
                stage_id: stageId,
                speaker: 'video',
                content: videoFilename,
                candidate_name: candidateName,
                video_url: videoUrl,
            })
        }

        // Upload audio for AssemblyAI analysis
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        const audioFilename = stageId + '-audio-' + Date.now() + '.webm'

        const { error: audioError } = await supabase.storage
            .from('interview-videos')
            .upload(audioFilename, audioBlob, { contentType: 'audio/webm' })

        if (!audioError) {
            const { data: audioUrlData } = await supabase.storage
                .from('interview-videos')
                .createSignedUrl(audioFilename, 60 * 60 * 24 * 7)

            if (audioUrlData) {
                await supabase.from('interviews').insert({
                    stage_id: stageId,
                    speaker: 'audio',
                    content: audioFilename,
                    candidate_name: candidateName,
                    video_url: audioUrlData.signedUrl,
                })

                // Trigger AssemblyAI analysis in background
                fetch('/api/analyze-audio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        audioUrl: audioUrlData.signedUrl,
                        stageId,
                        candidateName,
                    }),
                })
            }
        }

        setUploading(false)
        setFinished(true)
    }

    if (uploading) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#000',
                color: '#fff',
                fontFamily: 'sans-serif'
            }}>
                <div style={{ fontSize: '24px', marginBottom: '12px' }}>Saving your interview...</div>
                <div style={{ color: '#999', fontSize: '14px' }}>Please do not close this page.</div>
            </div>
        )
    }

    if (finished) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#000',
                color: '#fff',
                fontFamily: 'sans-serif',
                textAlign: 'center',
                padding: '40px'
            }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>Interview Complete</div>
                <div style={{ color: '#999', fontSize: '16px' }}>
                    Thank you, {candidateName}. Your responses have been recorded.
                </div>
            </div>
        )
    }

    if (!started) {
        return (
            <div style={{
                minHeight: '100vh',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                background: '#000',
                color: '#fff',
                fontFamily: 'sans-serif',
                padding: '40px'
            }}>
                <div style={{ maxWidth: '480px', width: '100%' }}>
                    <h1 style={{ fontSize: '28px', marginBottom: '8px' }}>
                        {stage ? stage.name : 'Loading...'}
                    </h1>
                    <p style={{ color: '#999', marginBottom: '32px', fontSize: '15px' }}>
                        This interview uses your camera and microphone. Speak your answers clearly.
                    </p>

                    {stage && questions.length === 0 && (
                        <p style={{ color: '#f66' }}>This stage has no approved questions yet.</p>
                    )}

                    {stage && questions.length > 0 && (
                        <div>
                            <input
                                type="text"
                                placeholder="Your full name"
                                value={candidateName}
                                onChange={(e) => setCandidateName(e.target.value)}
                                style={{
                                    padding: '14px',
                                    width: '100%',
                                    marginBottom: '16px',
                                    border: '1px solid #333',
                                    background: '#111',
                                    color: '#fff',
                                    fontSize: '15px',
                                    borderRadius: '6px',
                                    boxSizing: 'border-box'
                                }}
                            />
                            <button
                                onClick={startInterview}
                                disabled={!candidateName}
                                style={{
                                    padding: '14px 28px',
                                    background: candidateName ? '#fff' : '#333',
                                    color: candidateName ? '#000' : '#666',
                                    border: 'none',
                                    cursor: candidateName ? 'pointer' : 'not-allowed',
                                    fontSize: '15px',
                                    borderRadius: '6px',
                                    width: '100%',
                                    fontWeight: 'bold'
                                }}
                            >
                                Begin Interview
                            </button>
                        </div>
                    )}
                </div>
            </div>
        )
    }

    return (
        <div style={{
            minHeight: '100vh',
            background: '#000',
            color: '#fff',
            fontFamily: 'sans-serif',
            display: 'flex',
            flexDirection: 'column'
        }}>
            <div style={{ display: 'flex', flex: 1 }}>

                {/* Left: Camera */}
                <div style={{ width: '40%', background: '#111', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
                    <video
                        ref={videoRef}
                        autoPlay
                        muted
                        playsInline
                        style={{ width: '100%', borderRadius: '8px', background: '#000' }}
                    />
                    <div style={{ marginTop: '12px', fontSize: '13px', color: '#666' }}>
                        Question {currentIndex + 1} of {questions.length}
                    </div>
                </div>

                {/* Right: Interview */}
                <div style={{ flex: 1, padding: '40px', display: 'flex', flexDirection: 'column' }}>

                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ fontSize: '12px', color: '#666', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                            {isSpeaking ? 'Interviewer is speaking...' : 'Interviewer'}
                        </div>
                        <div style={{
                            fontSize: '20px',
                            lineHeight: '1.5',
                            color: isSpeaking ? '#fff' : '#ccc'
                        }}>
                            {currentQuestion}
                        </div>
                    </div>

                    <div style={{ flex: 1 }}>
                        {spokenAnswer && (
                            <div style={{
                                padding: '16px',
                                background: '#111',
                                borderRadius: '6px',
                                marginBottom: '16px',
                                fontSize: '15px',
                                color: '#ddd',
                                lineHeight: '1.6',
                                minHeight: '80px'
                            }}>
                                {spokenAnswer}
                            </div>
                        )}

                        {!spokenAnswer && !listening && (
                            <div style={{
                                padding: '16px',
                                background: '#111',
                                borderRadius: '6px',
                                marginBottom: '16px',
                                fontSize: '15px',
                                color: '#444',
                                minHeight: '80px',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                Your answer will appear here as you speak...
                            </div>
                        )}

                        {listening && !spokenAnswer && (
                            <div style={{
                                padding: '16px',
                                background: '#111',
                                borderRadius: '6px',
                                marginBottom: '16px',
                                fontSize: '15px',
                                color: '#888',
                                minHeight: '80px',
                                display: 'flex',
                                alignItems: 'center'
                            }}>
                                Listening...
                            </div>
                        )}
                    </div>

                    <div style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
                        {!listening && !busy && (
                            <button
                                onClick={startListening}
                                disabled={isSpeaking}
                                style={{
                                    padding: '14px 28px',
                                    background: isSpeaking ? '#222' : '#fff',
                                    color: isSpeaking ? '#555' : '#000',
                                    border: 'none',
                                    cursor: isSpeaking ? 'not-allowed' : 'pointer',
                                    fontSize: '15px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold'
                                }}
                            >
                                Start Speaking
                            </button>
                        )}

                        {listening && (
                            <button
                                onClick={stopListening}
                                style={{
                                    padding: '14px 28px',
                                    background: '#c00',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '15px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold'
                                }}
                            >
                                Stop Speaking
                            </button>
                        )}

                        {spokenAnswer && !listening && !busy && (
                            <button
                                onClick={submitSpokenAnswer}
                                style={{
                                    padding: '14px 28px',
                                    background: '#0066cc',
                                    color: '#fff',
                                    border: 'none',
                                    cursor: 'pointer',
                                    fontSize: '15px',
                                    borderRadius: '6px',
                                    fontWeight: 'bold'
                                }}
                            >
                                Submit Answer
                            </button>
                        )}

                        {busy && (
                            <div style={{ padding: '14px', color: '#666', fontSize: '15px' }}>
                                Processing...
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    )
}