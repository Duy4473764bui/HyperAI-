import {
  Client,
  GatewayIntentBits,
  REST,
  Routes,
  SlashCommandBuilder
} from "discord.js";
import fetch from "node-fetch";
import fs from "fs";
import "dotenv/config";

// ================= CONFIG =================
const OWNER_ID = "1217373421504041000";
const MEMORY_FILE = "./memory.json";
const CHAT_MODEL = "openai/gpt-oss-120b";

// ================= DISCORD =================
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent
  ]
});

// ================= MEMORY =================
let memory = {};
if (fs.existsSync(MEMORY_FILE)) {
  try {
    memory = JSON.parse(fs.readFileSync(MEMORY_FILE, "utf8"));
  } catch {
    memory = {};
  }
}

function saveMemory() {
  fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
}

function getMemory(uid) {
  if (!memory[uid]) memory[uid] = [];
  return memory[uid];
}

// ================= UTILS =================
function splitMessage(text, max = 1900) {
  const out = [];
  let buf = "";
  for (const line of text.split("\n")) {
    if ((buf + line).length > max) {
      out.push(buf);
      buf = "";
    }
    buf += line + "\n";
  }
  if (buf) out.push(buf);
  return out;
}

// ================= MODES =================
const MODES = {
  coc: "Tính cách cọc, gắt, nói thẳng.",
  chill: "Tính cách nhẹ nhàng thân thiện.",
  pro: "Tính cách logic, giải thích rõ.",
  toxic: "Tính cách cà khịa mặn."
};
let currentMode = "chill";

// ================= SYSTEM PROMPT =================
function systemPrompt(uid) {
  if (uid === OWNER_ID) {
    return `
Bạn là HyperAI.
${MODES[currentMode]}
Người nói chuyện là BỐ.
- Gọi là "bố"
- Xưng "con"
- Lễ phép, không cãi.
`;
  }

  return `
Bạn là HyperAI.
${MODES[currentMode]}
- Xưng tao – mày
- Chat kiểu Discord Gen Z
- Không nói kiểu trợ lý
`;
}

// ================= SLASH COMMANDS =================
const commands = [
  new SlashCommandBuilder()
    .setName("mode")
    .setDescription("Đổi mode")
    .addStringOption(o =>
      o.setName("type")
        .setRequired(true)
        .addChoices(
          { name: "Cọc", value: "coc" },
          { name: "Chill", value: "chill" },
          { name: "Pro", value: "pro" },
          { name: "Toxic", value: "toxic" }
        )
    ),

  new SlashCommandBuilder()
    .setName("draw")
    .setDescription("Vẽ ảnh bằng Runware")
    .addStringOption(o =>
      o.setName("prompt")
        .setDescription("Mô tả ảnh")
        .setRequired(true)
    ),

  new SlashCommandBuilder().setName("status").setDescription("Xem trạng thái"),
  new SlashCommandBuilder().setName("resetmemory").setDescription("Reset memory"),
  new SlashCommandBuilder().setName("shutdown").setDescription("Tắt bot")
].map(c => c.toJSON());

// ================= REGISTER =================
const rest = new REST({ version: "10" }).setToken(process.env.DISCORD_TOKEN);
await rest.put(
  Routes.applicationCommands(process.env.CLIENT_ID),
  { body: commands }
);

// ================= READY =================
client.once("ready", () => {
  console.log(`HyperAI online: ${client.user.tag}`);
});

// ================= INTERACTIONS =================
client.on("interactionCreate", async i => {
  if (!i.isChatInputCommand()) return;

  // ===== DRAW (RUNWARE) =====
  if (i.commandName === "draw") {
    try {
      if (!i.deferred && !i.replied) {
        await i.deferReply();
      }

      const prompt = i.options.getString("prompt");

      const res = await fetch("https://api.runware.ai/v1/image/generate", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.RUNWARE_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: "runware:100@1",
          positivePrompt: prompt,
          width: 1024,
          height: 1024,
          numberResults: 1
        })
      });

      const data = await res.json();
      const url = data?.data?.[0]?.imageURL;

      if (!url) {
        return i.editReply("❌ Vẽ lỗi (API không trả ảnh)");
      }

      return i.editReply({ files: [url] });

    } catch (err) {
      console.error("DRAW ERROR:", err);
      if (!i.replied) {
        return i.reply("💀 Interaction timeout");
      }
    }
  }

  // ===== MODE =====
  if (i.commandName === "mode") {
    currentMode = i.options.getString("type");
    return i.reply(`Đã đổi qua **${currentMode}**`);
  }

  // ===== STATUS =====
  if (i.commandName === "status") {
    return i.reply(
      `Mode: ${currentMode}\nMemory users: ${Object.keys(memory).length}`
    );
  }

  if (i.user.id !== OWNER_ID) {
    return i.reply("Không có quyền.");
  }

  if (i.commandName === "resetmemory") {
    memory = {};
    saveMemory();
    return i.reply("Đã reset memory.");
  }

  if (i.commandName === "shutdown") {
    await i.reply("Bot off.");
    process.exit(0);
  }
});

// ================= CHAT (OPENROUTER) =================
client.on("messageCreate", async msg => {
  if (msg.author.bot) return;
  if (!msg.mentions.has(client.user)) return;

  const content = msg.content
    .replace(`<@${client.user.id}>`, "")
    .trim();
  if (!content) return;

  const uid = msg.author.id;
  const chat = getMemory(uid);
  chat.push({ role: "user", content });
  if (chat.length > 15) chat.shift();

  try {
    const res = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: CHAT_MODEL,
          messages: [
            { role: "system", content: systemPrompt(uid) },
            ...chat
          ],
          temperature: 0.9,
          max_tokens: 700
        })
      }
    );

    const data = await res.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (!reply) return msg.reply("Lag rồi.");

    chat.push({ role: "assistant", content: reply });
    saveMemory();

    const parts = splitMessage(reply);
    await msg.reply(parts[0]);
    for (let i = 1; i < parts.length; i++) {
      await msg.channel.send(parts[i]);
    }

  } catch (err) {
    console.error("CHAT ERROR:", err);
    msg.reply("API chết.");
  }
});

// ================= ANTI-CRASH =================
process.on("unhandledRejection", err => {
  console.error("UNHANDLED:", err);
});

process.on("uncaughtException", err => {
  console.error("UNCAUGHT:", err);
});

// ================= LOGIN =================
client.login(process.env.DISCORD_TOKEN);