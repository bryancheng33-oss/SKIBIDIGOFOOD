# BrowserStack Real Device Test Plan — V16

Run after the V16 site is deployed to a public URL.

## Required browsers/devices

- Chrome latest / Windows
- Edge latest / Windows
- Firefox latest / Windows
- Safari latest / macOS
- iPhone Safari, small and large screen
- Android Chrome, small and large screen

## Test cases

1. Open `/orders` with multiple long orders. Confirm timeline cards do not overlap.
2. Scroll the order timeline panel. Confirm only the timeline area scrolls when expected.
3. Open `/menu`, add items to cart, remove all items, confirm total returns to zero.
4. Open `/admin-login`, try 5 failed logins, confirm lockout message appears.
5. Navigate with keyboard only and confirm visible focus.
6. Resize viewport from 320px to desktop width and confirm no card overlap.
7. Open DevTools console and confirm no uncaught runtime errors.
8. Run `window.SGFV16.runSelfCheck()` and save the result.

BrowserStack testing itself cannot be performed without a BrowserStack account and public deployed URL.
