# Weather Dress – AI-Assisted Outfit Recommender

Weather Dress is a full-stack web app that recommends outfits from your wardrobe based on **real-time weather** and your **style preferences**.

## 🧠 What it does

- Pulls **live weather** for your location
- Lets you **save clothes/outfits** to a personal wardrobe
- Tags clothes by **warmth, water resistance, coverage, occasion**, etc.
- Ranks outfits based on **closest match** to today’s weather
- Highlights **“best match”** and shows near-matches

## 🛠 Tech Stack

- Frontend: Next.js / React, TypeScript, Tailwind CSS
- Backend: Supabase (Postgres, Auth, Storage)
- APIs: Weather API (e.g. OpenWeather), SerpAPI (optional search for clothes)
- Other: Docker, etc. (whatever else you used)

## ✨ Key Features

- Real-time weather → outfit recommendations  
- Closet management (add, tag, and search clothing items)  
- “Closest match” scoring system for temperature / rain / wind  
- Responsive UI built for mobile & desktop

## 🚀 Live Demo

- Demo video (1–2 min):[▶ Watch on YouTube](https://youtu.be/M7L2yPYUr9U)

## 🧩 Running Locally

```bash
git clone <repo-url>
cd <project-folder>
cp .env.example .env.local   # fill in keys
npm install
npm run dev