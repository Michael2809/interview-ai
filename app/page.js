export default function HomePage() {
  return (
    <div style={{ padding: '40px', maxWidth: '600px' }}>
      <h1 style={{ fontSize: '28px', marginBottom: '10px' }}>AI Interview Assistant</h1>
      <p style={{ color: '#666', marginBottom: '30px' }}>
        Set up staged interviews, let AI draft questions, and review candidate transcripts.
      </p>

      <a
        href="/roles"
        style={{ display: 'inline-block', padding: '12px 24px', background: '#000', color: '#fff', textDecoration: 'none' }}
      >
        Go to Roles →
      </a>
    </div>
  )
}