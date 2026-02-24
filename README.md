# 🎓 omegleForCollage

A real-time chat & video call platform where verified college students connect with peers from other colleges. Practice English, find coding partners, share ideas, and build friendships — all within a safe, college-only community.

> _Every conversation in your college be like:_
>
> <img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=16&pause=500&color=F7B93E&vCenter=true&width=380&lines=%22assignment+submit+chesava%3F%22+%F0%9F%87%AE%F0%9F%87%B3;%22assignment+submit+kiya%3F%22+%F0%9F%87%AE%F0%9F%87%B3;%22assignment+submit+aachha%3F%22+%F0%9F%87%AE%F0%9F%87%B3;%22assignment+submit+pannita%3F%22+%F0%9F%87%AE%F0%9F%87%B3;%22assignment+submit+kela+ka%3F%22+%F0%9F%87%AE%F0%9F%87%B3;%22assignment+submit+korechho%3F%22+%F0%9F%87%AE%F0%9F%87%B3;%22assignment+submit+kittiya%3F%22+%F0%9F%87%AE%F0%9F%87%B3;%22did+you+submit+the+assignment%3F%22+%F0%9F%87%AC%F0%9F%87%A7" alt="Typing SVG" />
>
> **Same energy. Every language. Every college. Every single day.** 😭

What if there was a place where conversations actually went beyond assignments? Where you could talk about tech, life, startups, or why your code works on your machine but nowhere else?

**omegleForCollage** is that place.

> **No girlfriend? No boyfriend? No problem.** 😤
> We can't fix your love life _(yet)_, but we CAN connect you with students from other colleges. Practice English, debug code together, argue about tabs vs spaces, find your startup co-founder, or just vibe — Omegle-style, but exclusively for college students. 🚀
>
> _...and who knows, maybe you'll find a girlfriend/boyfriend too. We're not promising, but we're not NOT promising either_ 👀💜

No bots. No fake profiles. No random weirdos. Just verified college students from across the country — matched instantly, Omegle-style.

Think of it as Omegle — but safer, smarter, and made for YOUR campus. The Omegle your parents wouldn't freak out about. _(okay maybe a little)_ 😏

---

## ✨ Features

- 🎲 **Random Matching** — Get paired with a student from another college instantly. It's like arranged marriage but for friendships and it actually works
- 🎯 **Gender Filter** — Filter matches by gender. **100% free.** No premium. No paywall. No "pay ₹499 to unlock girls." We're not that app 💅
- 🏫 **College Filter** — Match with your own college or explore others. Your college, your rules
- 💬 **Real-time Chat** — Instant messaging with typing indicators. You'll know when they're typing that roast 🔥
- 📹 **Video Calls** — Face-to-face via WebRTC. Time to finally comb your hair
- ⏭️ **Skip / Next** — Not vibing? Hit skip. No hard feelings. It's not you, it's the algorithm
- 🔐 **College Email Only** — No `.edu` email? No entry. This club has a dress code 🚫
- 👤 **Profiles** — Avatar, bio, interests. Make yourself look cooler than you actually are
- 🌙 **Dark / Light Mode** — Switch themes based on your mood. Or your eye damage level
- 🟢 **Online Status** — See who's online. Stalk responsibly
- 🛡️ **JWT Auth** — Secure access & refresh tokens. Your data is safer than your GPA

---

## 🛠️ Tech Stack

| Layer | Tech |
|-------|------|
| **Frontend** | React 19, Vite, Tailwind CSS v4, Zustand, React Router v7 |
| **Backend** | Node.js, Express, Socket.IO, MongoDB (Mongoose) |
| **Auth** | JWT (Access + Refresh Tokens), Bcrypt, OTP via Resend |
| **Real-time** | Socket.IO (chat + matching), WebRTC (video calls) |
| **Media** | Cloudinary (avatar uploads) |
| **UI** | Lucide React Icons, React Hot Toast |

---

## 📁 Project Structure

```
omegleForCollage/
├── backend/                  # Express + Socket.IO server
│   └── src/
│       ├── controllers/      # Route handlers
│       ├── db/               # MongoDB connection
│       ├── middlewares/       # Auth middleware
│       ├── models/           # User & OTP models
│       ├── routes/           # API routes
│       ├── utils/            # Helpers (college validation, Cloudinary, etc.)
│       ├── socket.js         # Real-time matching & chat engine
│       ├── app.js            # Express app setup
│       └── index.js          # Server entry point
│
├── omegle for collage/       # React frontend
│   └── src/
│       ├── components/       # UI & layout components
│       ├── pages/            # Home, Login, Register, Match, Profile
│       ├── stores/           # Zustand stores (auth, theme)
│       └── lib/              # Utilities & API config
│
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites

- Node.js (v18+)
- MongoDB Atlas account (or local MongoDB)
- Cloudinary account
- Resend account (for OTP emails)

### 1. Clone the repo

```bash
git clone https://github.com/poshithnandyala/omegleforcollages.git
cd omegleforcollages
```

### 2. Setup Backend

```bash
cd backend
npm install
```

Create a `.env` file (refer `.env.example`):

```env
PORT=8001
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net
CORS_ORIGIN=http://localhost:5173
ACCESS_TOKEN_SECRET=your-access-token-secret
ACCESS_TOKEN_EXPIRY=1d
REFRESH_TOKEN_SECRET=your-refresh-token-secret
REFRESH_TOKEN_EXPIRY=10d
CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
RESEND_API_KEY=your-resend-api-key
RESEND_FROM=omegleForCollage <onboarding@resend.dev>
```

```bash
npm run dev
```

### 3. Setup Frontend

```bash
cd "omegle for collage"
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) and start matching! 🎉

---

## 🤝 How It Works

1. 📧 **Register** with your college email → prove you're actually a student
2. 🔑 **Login** and set up your profile — avatar, bio, interests. First impressions matter bestie
3. 🎲 Hit **"Find a Match"** → get paired with a student from another college
4. 💬 **Chat** in real-time or go bold and start a **video call** 📹
5. 😬 Not feeling it? **Skip** and meet someone new. Zero awkwardness
6. 🔁 Repeat until you find your study buddy, coding partner, or startup co-founder 💜

---

## 🧑‍💻 Contributing

Pull requests are welcome! If you have ideas to make this better — new features, bug fixes, or UI improvements — feel free to open an issue or PR.

---

## 📄 License

[MIT](./LICENSE) — use it, break it, fork it, we don't mind.

---

<p align="center">
  <b>Built with 💜 by <a href="https://github.com/poshithnandyala">Poshith</a></b><br>
  <i>If this project helped you find a friend, a coding partner, or even a crush — star the repo. That's all the payment I need. ⭐</i>
</p>

<p align="center">
  <sub>📝 <i>This README was ghostwritten by AI because the developer was too busy matching with people on his own app.</i></sub>
</p>
