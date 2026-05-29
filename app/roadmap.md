# Recrewt AI — Roadmap

## Now
- Polish dashboard with sample data
- Audit/clean up roles + interview pages
- Mobile responsiveness check
- Deploy production
- **Ship v2 to recruiter friend, get real feedback**

## Validate first (talk to recruiters before building)
- **Resume Mode** — recruiter uploads candidate resume (PDF/Word). AI parses skills, experience, gaps, then generates personalized interview questions. Alternative to role-based mode. Best for senior/exec/one-off hires.
- **Team collaboration** — share interviews and scores with hiring team
- **ATS integration** — pull candidates from Greenhouse, Lever, etc.

## Tech debt / before real users
- Supabase Row Level Security (RLS) on all tables — must be on so recruiters can only see their own data
- Build /reset-password page (forgot password flow currently has no landing page for the email link)
- Set up real Calendly link for Book Demo
- Set real prices in pricing section ($XX placeholders)
- Update browser favicon (currently default)