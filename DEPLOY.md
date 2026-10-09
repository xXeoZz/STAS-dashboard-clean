# Clean deployment

Recommended approach:

1. Use a fresh private GitHub repository if possible.
2. Upload only the files/folders from this package.
3. Do not upload old loose repair files.
4. In Vercel, Root Directory should be repository root / blank.
5. Add environment variables.
6. Deploy.

After deployment:
- `/api/diagnostics` should report Intervals authentication.
- `/api/withings/diagnostics` should report Withings connection and weight rows.
- `/api/dashboard?days=90` should show current FTP and latest weight.
