# HyperAI — Discord AI Chat Bot

HyperAI là một Discord bot tích hợp AI chat dựa trên **GPT (OpenRouter)**, được thiết kế theo hướng **ổn định, đơn giản, dễ mở rộng**, tập trung vào trải nghiệm hội thoại tự nhiên và quản lý ngữ cảnh theo người dùng.

Bot hoạt động theo cơ chế **mention để chat**, có phân quyền rõ ràng giữa **Owner** và **User thường**, kèm hệ thống memory nhẹ lưu bằng file.

---

## 🚀 Features

- AI chat kích hoạt bằng **mention bot**
- **Conversation memory per-user** (lưu JSON, không DB)
- Phân biệt **OWNER / USER** trong system prompt
- Nhiều **conversation modes** (coc, chill, pro, toxic)
- Slash commands gọn, cần thiết
- Chỉ sử dụng **1 GPT model duy nhất** (ổn định, dễ debug)
- Tự động giới hạn context để tránh crash / overload
- Không spam, không listener thừa

---

## 🧠 Conversation Modes

| Mode   | Description |
|------|------------|
| `coc` | Thẳng, gắt, ngắn gọn |
| `chill` | Nhẹ nhàng, có khịa |
| `pro` | Logic, giải thích rõ |
| `toxic` | Cà khịa mặn, không tục |

---

## 🛠 Tech Stack

- **Node.js (ESM)**
- **discord.js v14**
- **OpenRouter API**
- **Model**: `openai/gpt-oss-120b`
- **Storage**: JSON file (`memory.json`)
- **Env config**: dotenv

---

## 📁 Project Structure

```
HyperAI/
│
├─ index.js          # Main bot logic
├─ memory.json       # Conversation memory
├─ .env              # Environment variables
├─ package.json
└─ README.md
```

---

## ⚙️ Setup & Installation

### 1. Clone repository
```bash
git clone https://github.com/yourname/HyperAI.git
cd HyperAI
```

### 2. Install dependencies
```bash
npm install
```

### 3. Environment variables

Create `.env` file:
```env
DISCORD_TOKEN=YOUR_DISCORD_BOT_TOKEN
CLIENT_ID=YOUR_DISCORD_CLIENT_ID
OPENROUTER_API_KEY=YOUR_OPENROUTER_API_KEY
```

### 4. Set Owner ID

In `index.js`:
```js
const OWNER_ID = "YOUR_DISCORD_ID";
```

---

## ▶️ Run the bot

```bash
node index.js
```

Console output:
```
🤖 HyperAI online
```

---

## 💬 Usage

### AI Chat
Mention the bot:
```
@HyperAI nghĩ sao về AI hiện tại?
```

### Slash Commands

| Command | Description |
|------|------------|
| `/mode` | Change conversation mode |
| `/status` | Bot status |
| `/ping` | API latency test |

---

## 🔒 Owner-only Commands

| Command | Function |
|------|----------|
| `/resetmemory` | Clear all stored memory |
| `/shutdown` | Gracefully shutdown bot |

---

## 🧩 Design Notes

- Chỉ dùng **1 model GPT** để đảm bảo:
  - Dễ maintain
  - Dễ debug
  - Không lỗi JSON / format
- Memory giới hạn số message để tránh token overflow
- Không hardcode prompt phức tạp → ưu tiên ổn định

---

## ⚠️ Notes

- Không dùng database → memory sẽ reset nếu xoá file
- API OpenRouter phụ thuộc quota
- Bot có phong cách cà khịa → không phù hợp server trẻ em

---

## 📄 License

MIT License — dùng cho mục đích học tập và cá nhân.
