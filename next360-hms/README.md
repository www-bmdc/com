# Next360 Hospital Management System (Free Tier)

Static frontend hosted on Vercel + Back4App (Parse Server) backend.

## Deploy (Vercel)
1. Push this repo to GitHub.
2. Import in Vercel.
3. Framework: Other
4. Build command: None
5. Output directory: (leave empty; routing handled by vercel.json)

## Notes
- Backend keys are in `public/js/parse-init.js`.
- For production: lock down CLPs/ACLs and implement roles before storing real patient data.