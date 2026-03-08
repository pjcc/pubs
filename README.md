# Pubs

A crowd-sourced pub guide for Brighton & Hove. Built with React + Vite, backed by Google Sheets via Apps Script.

## Features

- **Search & filter** pubs by name, area, notes, and custom category tags
- **Sort** alphabetically or by Google Maps rating
- **Card, table, and map views** with Leaflet.js
- **Google Places API** autocomplete when adding pubs — auto-populates ratings, opening hours, and map links
- **Bulk add** multiple pubs at once
- **Favourites** pinned to the top of the list
- **Change history** with unseen-change badges
- **Theming** — Midnight, Copper, Forest, Slate, and Sand colour schemes
- **Geolocation** on the map view
- **Mobile-friendly** responsive layout

## Setup

```bash
npm install
npm run dev
```

Create a `.env` file with your Apps Script web app URL:

```
VITE_SCRIPT_URL=https://script.google.com/macros/s/.../exec
```

## Deploy

```bash
npm run build
```

The `dist/` folder is deployed to GitHub Pages via the included workflow.
