# Cricket Auction — Firebase Live Version

This version connects the mobile auction interface to Firebase Realtime Database.

## Auction rules
- Default total: 1200 points
- Exactly 8 players per team
- Minimum bid: 30 points
- First-bid cap: 960 points (1200 - 8×30), as requested
- After a purchase, the next maximum bid reserves the minimum points needed for the remaining player slots.

## Firebase setup still required
1. Enable Authentication → Sign-in method → Anonymous.
2. In Authentication → Users, keep your existing admin Email/Password account.
3. In Realtime Database → Rules, replace `REPLACE_WITH_ADMIN_EMAIL` with the exact admin email and publish the rules from `firebase-rules.json`.
4. The database must not remain in temporary test mode.

## How teams join
The Admin adds a team. Firebase generates a 6-character access code. Give that code only to the team captain/phone. The team phone chooses Team login and enters the code. Team phones use anonymous Firebase authentication, so no separate Google account is required.

## Important security note
The Firebase web config in `app.js` is normal client configuration. Security is provided by Firebase Authentication and Realtime Database Rules. Never put a Firebase service-account private key in this website.

## GitHub deployment
Upload all files in this folder to the repository root. Do not upload the ZIP alone if you want the site to run directly from GitHub Pages/Cloudflare Pages.
