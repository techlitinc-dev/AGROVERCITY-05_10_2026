# Troubleshoot — Gurukul Instructor

> Persona: **Gurukul Instructor** (instructor)
> Roleplay: PW Test Instructor, agronomist running courses, batches and certificates on Gurukul Academy.
> Target: http://localhost:5173 · Walked: 2026-11-02T18:01:34.656Z

## Login recipe used by the test

- Mode: `onboard` — +919100000104
- Mint session via `POST /v1/auth/quick-login` (or `/v1/auth/onboard` for onboard personas) with dev MPIN `1234`, then the UI walk is 100% browser.

## Result: 9 ✅ pass · 0 ⚠️ warn · 0 ❌ fail (9 pages)

| Route | Status | Issues | Console errors | Bad network | Screenshot |
|---|---|---|---|---|---|
| `/instructor/home` | ✅ | — | 0 | — | `instructor/screenshots/00-instructor_home.png` |
| `/instructor/courses` | ✅ | — | 0 | — | `instructor/screenshots/01-instructor_courses.png` |
| `/instructor/enrollment-requests` | ✅ | — | 0 | — | `instructor/screenshots/02-instructor_enrollment-requests.png` |
| `/instructor/enquiries` | ✅ | — | 0 | — | `instructor/screenshots/03-instructor_enquiries.png` |
| `/instructor/students` | ✅ | — | 0 | — | `instructor/screenshots/04-instructor_students.png` |
| `/instructor/chat` | ✅ | — | 0 | — | `instructor/screenshots/05-instructor_chat.png` |
| `/instructor/batches` | ✅ | — | 0 | — | `instructor/screenshots/06-instructor_batches.png` |
| `/instructor/assignments` | ✅ | — | 0 | — | `instructor/screenshots/07-instructor_assignments.png` |
| `/instructor/certificates` | ✅ | — | 0 | — | `instructor/screenshots/08-instructor_certificates.png` |

## How to re-verify after a fix

```bash
cd playwright-scripts && npx playwright test -g "instructor"
npm run report   # regenerate this doc
```
