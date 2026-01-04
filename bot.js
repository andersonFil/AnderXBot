import makeWASocket, { useMultiFileAuthState, Browsers } from "@whiskeysockets/baileys";
import ytSearch from "yt-search";
import fs from "fs";
import { spawn } from "child_process";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { aplicarFuente } from "./fuentes.js";

const ADMIN_SUPREMO = "584247057716"; // tu número en formato internacional
let contadorComandos = 0;
const inicioBot = Date.now();

// Función para leer el modo actual
function leerModo() {
  try {
    const data = fs.readFileSync("modo.json");
    const json = JSON.parse(data);
    return json.modo || "gotico";
  } catch {
    return "gotico";
  }
}

// Función para guardar el nuevo modo
function guardarModo(nuevoModo) {
  fs.writeFileSync("modo.json", JSON.stringify({ modo: nuevoModo }, null, 2));
}


// 🔧 Normalizar número a formato estándar
function normalizarNumero(num) {
  if (!num) return "";
  let limpio = num.replace(/\D/g, "");
  if (limpio.startsWith("0") && limpio.length === 11) {
    limpio = "58" + limpio.substring(1);
  }
  if (limpio.startsWith("58") && limpio.length === 12) return limpio;
  if (num.startsWith("+58")) return limpio;
  return limpio;
}

// ✅ Normalizar JIDs
function jidSinDominio(jid) {
  return jid?.replace(/@s\.whatsapp\.net|@c\.us|@g\.us/gi, "") || "";
}

// ✅ Ejecutar yt-dlp con control de velocidad
function runYtDlp(args, onStdout) {
  return new Promise((resolve, reject) => {
    const proc = spawn("yt-dlp", args);
    proc.stdout.on("data", (d) => onStdout?.(d.toString()));
    proc.stderr.on("data", (d) => onStdout?.(d.toString()));
    proc.on("error", reject);
    proc.on("close", (code) => (code === 0 ? resolve(true) : reject(new Error("yt-dlp error"))));
  });
}

// ✅ Buscar en YouTube
async function searchFirst(query) {
  const res = await ytSearch(query);
  return res?.videos?.[0] || null;
}

// ✅ Función esAdmin con jerarquía
async function esAdmin(sock, chatId, sender) {
  const limpio = normalizarNumero(jidSinDominio(sender));
  const supremo = normalizarNumero(ADMIN_SUPREMO);
  if (limpio === supremo) return "supremo";

  if (chatId.includes("@g.us")) {
    try {
      const meta = await sock.groupMetadata(chatId);
      const participante = meta.participants?.find(
        p => normalizarNumero(jidSinDominio(p.id)) === limpio
      );
      if (participante?.admin) return "subadmin";
    } catch (e) {
      console.log("Error obteniendo metadata del grupo:", e);
    }
  }

  return false;
} 
//startBot
async function main() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");
	
  const sock = makeWASocket({
    auth: state,
    browser: Browsers.ubuntu("Chrome")
  });

  sock.ev.on("creds.update", saveCreds);

	// evento de conexion
	sock.ev.on("connection.update", (update) => {
		const { qr, connection } = update;
		
			  if (qr) {
				  console.log("AnderX Bot iniciado");
				  console.log("Escanea este QR con Whatsapp:");
				  console.log(qr);
			  }
		if (connection === "open") {
			console.log("conectado a Whatsapp");
		}
		
		if (connection === "close") {
			console.log("X Conexion cerrada, intenta reiniciar el bot");
		}
	});
}

  sock.ev.on("messages.upsert", async ({ messages }) => {
    try {
      const msg = messages[0];
      if (!msg?.message) return;

      const chatId = msg.key.remoteJid;
      const sender = msg.key.participant || msg.key.remoteJid;
      const text =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message?.imageMessage?.caption ||
        msg.message?.videoMessage?.caption ||
        "";
      const body = text.trim().toLowerCase();
      contadorComandos++;

      const nivelAdmin = await esAdmin(sock, chatId, sender);

// 🚫 Anti-links configurable con lista blanca + DM + on/off
const MAX_STRIKES = 2; // número máximo de advertencias antes de expulsar
const advertencias = {}; // objeto para guardar advertencias por usuario
let antiLinkActivo = true; // estado inicial: activo

// Lista blanca de dominios permitidos
const listaBlanca = [
  "youtube.com",   // ✅ YouTube permitido
  "youtu.be",      // ✅ YouTube corto permitido
  "angelisnails.com", // ✅ tu blog de ejemplo
  // agrega aquí otros dominios que quieras permitir
];

// ID del admin supremo (tú)
const ADMIN_SUPREMO = "584247057716@s.whatsapp.net"; 

// Comando para activar/desactivar Anti-links
if (body === "!antilink on" || body === "!antilink off") {
  const nivelAdmin = await esAdmin(sock, chatId, sender);

  if (!nivelAdmin && sender !== ADMIN_SUPREMO) {
    await sock.sendMessage(chatId, {
      text: `❌ Solo administradores o el admin supremo pueden usar este comando.\n\n🗣️ Pedido por: @${jidSinDominio(sender)}`,
      mentions: [sender],
      quoted: msg
    });
    return;
  }

  antiLinkActivo = body === "!antilink on";
  let aviso = antiLinkActivo
    ? "✅ Protección Anti-links ACTIVADA."
    : "⚠️ Protección Anti-links DESACTIVADA.";
  const modo = leerModo();
  aviso = aplicarFuente(aviso, modo);

  await sock.sendMessage(chatId, {
    text: `${aviso}\n\n🗣️ Pedido por: @${jidSinDominio(sender)}`,
    mentions: [sender],
    quoted: msg
  });
  return;
}

// 🚫 Anti-links detector
sock.ev.on("messages.upsert", async ({ messages }) => {
  if (!antiLinkActivo) return; // si está desactivado, no hace nada

  const msg = messages[0];
  if (!msg.message) return;

  const chatId = msg.key.remoteJid;
  const sender = msg.key.participant || msg.key.remoteJid;
  const body = msg.message.conversation || msg.message.extendedTextMessage?.text || "";

  // Detectar cualquier link externo
  const regexLink = /(https?:\/\/[^\s]+)/gi;
  const linksEncontrados = body.match(regexLink);

  if (linksEncontrados) {
    // Verificar si alguno de los links está en la lista blanca
    const permitido = linksEncontrados.some(link =>
      listaBlanca.some(dom => link.includes(dom))
    );

    if (!permitido) {
      const nivelAdmin = await esAdmin(sock, chatId, sender);

      if (!nivelAdmin && sender !== ADMIN_SUPREMO) {
        try {
          // Eliminar el mensaje
          await sock.sendMessage(chatId, { delete: msg.key });

          // Registrar advertencia
          advertencias[sender] = (advertencias[sender] || 0) + 1;

          if (advertencias[sender] < MAX_STRIKES) {
            // Aviso en el grupo
            let avisoGrupo = `🚫 Se eliminó un enlace externo no permitido.\n\n🗣️ Enviado por: @${jidSinDominio(sender)}\n⚠️ Advertencia ${advertencias[sender]}/${MAX_STRIKES}: si vuelves a enviar otro link serás eliminado automáticamente.`;
            const modo = leerModo();
            avisoGrupo = aplicarFuente(avisoGrupo, modo);

            await sock.sendMessage(chatId, {
              text: avisoGrupo,
              mentions: [sender],
              quoted: msg
            });

            // Aviso privado (DM)
            let avisoPrivado = `⚠️ Has enviado un link prohibido en el grupo.\nAdvertencia ${advertencias[sender]}/${MAX_STRIKES}.\nSi reincides serás eliminado automáticamente.`;
            avisoPrivado = aplicarFuente(avisoPrivado, modo);

            await sock.sendMessage(sender, { text: avisoPrivado });

          } else {
            // Expulsión al superar strikes
            let avisoGrupo = `🚫 Usuario eliminado por reincidir en enviar links prohibidos.\n\n🗣️ @${jidSinDominio(sender)}`;
            const modo = leerModo();
            avisoGrupo = aplicarFuente(avisoGrupo, modo);

            await sock.sendMessage(chatId, {
              text: avisoGrupo,
              mentions: [sender],
              quoted: msg
            });

            // Expulsar del grupo
            await sock.groupParticipantsUpdate(chatId, [sender], "remove");

            // Eliminar strike del usuario expulsado
            delete advertencias[sender];
          }
        } catch (e) {
          console.error("Error anti-links:", e);
        }
      }
    }
  }
});

// Evento: cuando alguien nuevo entra al grupo
sock.ev.on("group-participants.update", async (update) => {
  try {
    if (update.action === "add") {
      const metadata = await sock.groupMetadata(update.id);
      const nombreGrupo = metadata.subject;
      const total = metadata.participants.length;

      // Tomamos el primer participante agregado
      const nuevo = update.participants[0];

      const bienvenida = `𓆩𓆪 *AnderX Bot* 𓆩𓆪\n✨ Bienvenido/a ✨\n\n` +
      `🙌 Hola @${nuevo.split("@")[0]}, nos alegra tenerte aquí.\n\n` +
      `👥 Grupo: *${nombreGrupo}*\n👤 Miembros actuales: ${total}\n\n` +
      `🎬 Usa *!menu* para ver todos los comandos disponibles.\n\n` +
      `💠 *Bot creado por Anderson* 💠`;

      await sock.sendMessage(update.id, {
        image: { url: "https://copilot.microsoft.com/th/id/BCO.518e0b2f-23f0-4110-942a-732d8fba29a5.png" },
        caption: bienvenida,
        mentions: [nuevo] // 👈 Esto hace que se mencione al usuario
      });
    }
  } catch (err) {
    console.error("Error en bienvenida:", err);
  }
});

// Evento: cuando alguien sale o es expulsado del grupo
sock.ev.on("group-participants.update", async (update) => {
  try {
    if (update.action === "remove") {
      const metadata = await sock.groupMetadata(update.id);
      const nombreGrupo = metadata.subject;
      const total = metadata.participants.length;

      // Usuario que salió/expulsado
      const usuario = update.participants[0];

      // Lista de emojis de despedida
      const emojis = ["👋", "😢", "🖤", "🤝", "🌙"];
      const emoji = emojis[Math.floor(Math.random() * emojis.length)];

      const despedida = `𓆩𓆪 *AnderX Bot* 𓆩𓆪\n${emoji} Despedida ${emoji}\n\n` +
      `${emoji} Hasta pronto @${usuario.split("@")[0]}.\n` +
      `👥 Grupo: *${nombreGrupo}*\n👤 Miembros actuales: ${total}\n\n` +
      `💠 *Bot creado por Anderson* 💠`;

      await sock.sendMessage(update.id, {
        image: { url: "https://copilot.microsoft.com/th/id/BCO.518e0b2f-23f0-4110-942a-732d8fba29a5.png" },
        caption: despedida,
        mentions: [usuario] // 👈 menciona al usuario que salió/expulsado
      });
    }
  } catch (err) {
    console.error("Error en despedida:", err);
  }
});

// Ya tienes import fs arriba
function leerModo() {
  try {
    const data = fs.readFileSync("modo.json");
    const json = JSON.parse(data);
    return json.modo || "gotico";
  } catch {
    return "gotico";
  }
}

// Lista de triggers para el menú
const helpTriggers = ["!help","!hepl","!hlp","!hep","!ayuda","!menu"];

// Bloque !modo
if (body === "!modo") {
  const actual = leerModo();
  let nuevo;

  if (actual === "gotico") {
    nuevo = "sangre";
  } else if (actual === "sangre") {
    nuevo = "premium";
  } else {
    nuevo = "gotico";
  }

  guardarModo(nuevo);

  let aviso;
  if (nuevo === "gotico") {
    aviso = "☠️ AnderX Bot ahora está en modo *GÓTICO* ☠️";
  } else if (nuevo === "sangre") {
    aviso = "🩸 AnderX Bot ahora está en modo *SANGRE DERRAMADA* 🩸";
  } else {
    aviso = "⚜️ AnderX Bot ahora está en modo *PREMIUM* ⚜️";
  }

  await sock.sendMessage(chatId, {
    text: `🔄 ${aviso}`,
    quoted: msg
  });
  return;
}

// 📖 Menú principal
if (helpTriggers.includes(body)) {
  const fecha = new Date();
  const opcionesFecha = { timeZone: "America/Caracas", hour12: false };
  const fechaTexto = fecha.toLocaleDateString("es-VE", opcionesFecha);
  const horaTexto = fecha.toLocaleTimeString("es-VE", opcionesFecha);

  let grupoInfo = "";
  if (chatId.endsWith("@g.us")) {
    const metadata = await sock.groupMetadata(chatId);
    const total = metadata.participants.length;
    const activos = metadata.participants.filter(p => p.id && !p.admin).length;
    grupoInfo = `Grupo: *${metadata.subject}*\nMiembros: ${total}\nActivos: ${activos}\n\n`;
  }

  // Estado Anti-links y lista blanca
  const estadoAntiLink = antiLinkActivo ? "✅ Activado" : "⚠️ Desactivado";
  const totalDominios = listaBlanca.length;
  const ultimosDominios = listaBlanca.slice(-3).join(", ") || "Ninguno";

  // Texto base del menú
  let caption = `𓆩𓆪 AnderX Bot 𓆩𓆪
Tu asistente oscuro

📅 Fecha: ${fechaTexto}
🕒 Hora: ${horaTexto}
${grupoInfo}
✦ Descargas ✦
🎬 !mp4 <nombre> ▸ Video YouTube
🎧 !mp3 <nombre> ▸ Audio YouTube
📂 !mp4doc <nombre> ▸ Video como documento

✦ Utilidades ✦
📷 !img <nombre> ▸ Imagen desde Bing
📊 !estado ▸ Estado del bot

✦ Comandos de Admin ✦
🧹 !limpiar ▸ Borrar temporales
🔞 !nn <nombre> ▸ Video sin censura
🔞 !nnxnxx <nombre> ▸ Buscar en XNXX
🛡️ !antilink on/off ▸ Activar o desactivar Anti-links
🌐 !lista show/add/remove ▸ Gestionar lista blanca

✦ Seguridad ✦
🛡️ Anti-links: ${estadoAntiLink}
🌐 Lista blanca (${totalDominios} dominios): ${ultimosDominios}

Bot creado por Anderson`;

  // Aplica la fuente según el modo activo
  const modo = leerModo(); // lee modo.json
  caption = aplicarFuente(caption, modo);

  // Envía el menú con la fuente transformada
  await sock.sendMessage(chatId, {
    image: { url: "https://i.postimg.cc/Prd92Pc4/Ander-X-Bot.png" },
    caption,
    quoted: msg,
    contextInfo: {
      mentionedJid: [sender],
      quotedMessage: msg.message,
      participant: sender
    }
  });
  return;
}

// 📊 Estado
if (body === "!estado") {
  const nivelAdmin = await esAdmin(sock, chatId, sender);
  const uptimeMs = Date.now() - inicioBot;
  const minutos = Math.floor(uptimeMs / 60000);
  const memoria = process.memoryUsage().rss / 1024 / 1024;

  // Estado del Anti-links
  const estadoAntiLink = antiLinkActivo ? "✅ Activado" : "⚠️ Desactivado";
  const totalDominios = listaBlanca.length;
  const ultimosDominios = listaBlanca.slice(-3).join(", ") || "Ninguno";

  // Texto base del estado
  let caption = `📊 Estado del Bot:
⏱️ Uptime: ${minutos} min
🧠 Memoria: ${memoria.toFixed(1)} MB
⚙️ Comandos: ${contadorComandos}
🔒 Nivel: ${nivelAdmin || "ninguno"}
🛡️ Anti-links: ${estadoAntiLink}
🌐 Lista blanca (${totalDominios} dominios): ${ultimosDominios}
🗣️ Pedido por: @${jidSinDominio(sender)}`;

  // Aplica la fuente según el modo activo
  const modo = leerModo();
  caption = aplicarFuente(caption, modo);

  // Envía el estado con la fuente transformada
  await sock.sendMessage(chatId, {
    text: caption,
    mentions: [sender],
    quoted: msg,
    contextInfo: {
      mentionedJid: [sender],
      quotedMessage: msg.message,
      participant: sender
    }
  });
  return;
}

// 🌐 Lista blanca de dominios
if (body.startsWith("!lista")) {
  const nivelAdmin = await esAdmin(sock, chatId, sender);

  // Solo admins o admin supremo
  if (!nivelAdmin && sender !== ADMIN_SUPREMO) {
    await sock.sendMessage(chatId, {
      text: `❌ Solo administradores o el admin supremo pueden usar este comando.\n\n🗣️ Pedido por: @${jidSinDominio(sender)}`,
      mentions: [sender],
      quoted: msg
    });
    return;
  }

  const args = body.split(" ");
  const accion = args[1]; // add, remove, show
  const dominio = args[2]; // dominio a agregar/quitar

  if (accion === "show") {
    let caption = listaBlanca.length > 0
      ? `🌐 Lista blanca actual:\n${listaBlanca.join("\n")}`
      : "🌐 La lista blanca está vacía.";
    const modo = leerModo();
    caption = aplicarFuente(caption, modo);

    await sock.sendMessage(chatId, {
      text: caption,
      quoted: msg
    });
  }

  else if (accion === "add" && dominio) {
    if (!listaBlanca.includes(dominio)) {
      listaBlanca.push(dominio);
    }
    let caption = `✅ Dominio agregado a la lista blanca:\n${dominio}\n\n🌐 Lista actual:\n${listaBlanca.join("\n")}`;
    const modo = leerModo();
    caption = aplicarFuente(caption, modo);

    await sock.sendMessage(chatId, {
      text: caption,
      quoted: msg
    });
  }

  else if (accion === "remove" && dominio) {
    const index = listaBlanca.indexOf(dominio);
    if (index !== -1) listaBlanca.splice(index, 1);

    let caption = `⚠️ Dominio eliminado de la lista blanca:\n${dominio}\n\n🌐 Lista actual:\n${listaBlanca.join("\n")}`;
    const modo = leerModo();
    caption = aplicarFuente(caption, modo);

    await sock.sendMessage(chatId, {
      text: caption,
      quoted: msg
    });
  }

  else {
    await sock.sendMessage(chatId, {
      text: "❌ Uso correcto: !lista show | !lista add <dominio> | !lista remove <dominio>",
      quoted: msg
    });
  }
  return;
}

// 🧹 Limpiar (solo admin)
if (body === "!limpiar") {
  const nivelAdmin = await esAdmin(sock, chatId, sender);

  // Aplica la fuente según el modo activo
  const modo = leerModo(); // lee modo.json

  if (!nivelAdmin) {
    let caption = `❌ Este comando es solo para administradores.

🗣️ Pedido por: @${jidSinDominio(sender)}`;
    caption = aplicarFuente(caption, modo);

    await sock.sendMessage(chatId, {
      text: caption,
      mentions: [sender],
      quoted: msg
    });
    return;
  }

  // Archivos a limpiar
  const archivos = ["./video.mp4","./video.webm","./video.mkv","./audio.mp3"];
  archivos.forEach(f => { 
    try { 
      if (fs.existsSync(f)) fs.unlinkSync(f); 
    } catch(_){} 
  });

  // Mensaje de éxito
  let caption = `🧹 Archivos temporales eliminados correctamente.

🗣️ Pedido por: @${jidSinDominio(sender)}`;
  caption = aplicarFuente(caption, modo);

  await sock.sendMessage(chatId, {
    text: caption,
    mentions: [sender],
    quoted: msg,
    contextInfo: {
      mentionedJid: [sender],
      quotedMessage: msg.message,
      participant: sender
    }
  });
  return;
}

// 📷 Imagen desde Bing
if (body.startsWith("!img ")) {
  const query = body.replace("!img ", "").trim();
  if (!query) {
    let caption = "❌ Usa: !img <palabra clave>";
    const modo = leerModo();
    caption = aplicarFuente(caption, modo);

    await sock.sendMessage(chatId, { 
      text: caption,
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
    return;
  }

  try {
    const searchUrl = `https://www.bing.com/images/search?q=${encodeURIComponent(query)}&form=HDRSC2`;
    const res = await fetch(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    const imgTag = $('a.iusc').first().attr('m');
    if (!imgTag) {
      let caption = "❌ No encontré imágenes en Bing.";
      const modo = leerModo();
      caption = aplicarFuente(caption, modo);

      await sock.sendMessage(chatId, { 
        text: caption,
        quoted: msg,
        contextInfo: {
          mentionedJid: [sender],
          quotedMessage: msg.message,
          participant: sender
        }
      });
      return;
    }

    const jsonData = JSON.parse(imgTag);
    const imageUrl = jsonData?.murl;
    if (!imageUrl) {
      let caption = "❌ No encontré imagen válida.";
      const modo = leerModo();
      caption = aplicarFuente(caption, modo);

      await sock.sendMessage(chatId, { 
        text: caption,
        quoted: msg,
        contextInfo: {
          mentionedJid: [sender],
          quotedMessage: msg.message,
          participant: sender
        }
      });
      return;
    }

    const imgRes = await fetch(imageUrl);
    const buffer = Buffer.from(await imgRes.arrayBuffer());

    let caption = `📷 Imagen relacionada con: ${query}

🗣️ Pedido por: @${jidSinDominio(sender)}`;
    const modo = leerModo();
    caption = aplicarFuente(caption, modo);

    await sock.sendMessage(chatId, {
      image: buffer,
      caption,
      mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
  } catch (e) {
    console.error("Error Bing:", e);
    let caption = "❌ Error al obtener imagen desde Bing.";
    const modo = leerModo();
    caption = aplicarFuente(caption, modo);

    await sock.sendMessage(chatId, { 
      text: caption,
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
  }
  return;
}

// 🎬 Video con selección de calidad (360p, 480p, 720p, 1080p)
if (body.startsWith("!mp4 ")) {
  const query = body.replace("!mp4 ", "").trim();
  if (!query) {
    await sock.sendMessage(chatId, {
      text: "❌ Usa: !mp4 <nombre>",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
    return;
  }

  const found = await searchFirst(query);
  if (!found) {
    await sock.sendMessage(chatId, {
      text: `❌ Sin resultados.\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
      mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
    return;
  }

  // ✅ Miniatura previa
  await sock.sendMessage(chatId, {
    image: { url: found.thumbnail },
    caption: `🎬 *${found.title}*\n⏳ Duración: ${found.duration.timestamp}\n👁️ Vistas: ${found.views}\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
    mentions: [sender],
    quoted: msg,
    contextInfo: {
      mentionedJid: [sender],
      quotedMessage: msg.message,
      participant: sender
    }
  });

  // ✅ Preguntar calidad
  const opciones = `✯ Selecciona la calidad ☪\n\n↷ 1. 360p (Calidad baja)\n↷ 2. 480p (Estándar)\n↷ 3. 720p (Alta definición)\n↷ 4. 1080p (Full HD)\n\n☪ Responde con el número (1-4) de la calidad que deseas.\n✿ La opción expirará en 30 segundos.`;
  await sock.sendMessage(chatId, {
    text: opciones,
    quoted: msg,
    contextInfo: {
      mentionedJid: [sender],
      quotedMessage: msg.message,
      participant: sender
    }
  });

  // ✅ Esperar respuesta
  const esperaRespuesta = async () => {
    return new Promise(resolve => {
      const listener = async ({ messages }) => {
        const respuesta = messages[0];
        const texto = (
          respuesta.message?.conversation ||
          respuesta.message?.extendedTextMessage?.text ||
          ""
        ).trim();

        const respuestaValida = ["1", "2", "3", "4"].includes(texto);
        const mismoUsuario = respuesta.key.participant === sender || respuesta.key.remoteJid === sender;

        if (respuestaValida && mismoUsuario) {
          sock.ev.off("messages.upsert", listener);
          resolve(texto);
        }
      };

      sock.ev.on("messages.upsert", listener);
      setTimeout(() => {
        sock.ev.off("messages.upsert", listener);
        resolve(null);
      }, 30000); // 30 segundos
    });
  };

  const seleccion = await esperaRespuesta();
  if (!seleccion) {
    await sock.sendMessage(chatId, {
      text: "⏳ Tiempo expirado. No se seleccionó calidad.",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
    return;
  }

  const calidad = seleccion === "1" ? "best[height<=360]" :
                  seleccion === "2" ? "best[height<=480]" :
                  seleccion === "3" ? "best[height<=720]" :
                  "best[height<=1080]";

  const textoCalidad = seleccion === "1" ? "360p" :
                       seleccion === "2" ? "480p" :
                       seleccion === "3" ? "720p" : "1080p";

  await sock.sendMessage(chatId, {
    text: `☪ Descargando video en ${textoCalidad}...\n✿ Espera un momento, por favor.`,
    quoted: msg,
    contextInfo: {
      mentionedJid: [sender],
      quotedMessage: msg.message,
      participant: sender
    }
  });

  const outPath = "./video.%(ext)s";
  let realFile = "";

  try {
    await runYtDlp([
      "-f", calidad,
      "--limit-rate", "500K",
      "-o", outPath,
      found.url
    ], log => {
      const m = log.match(/Destination:\s(.+\.(mp4|mkv|webm))/i);
      if (m && m[1]) realFile = m[1];
    });

    if (!realFile && fs.existsSync("./video.mp4")) realFile = "./video.mp4";
    if (!realFile || !fs.existsSync(realFile)) {
      await sock.sendMessage(chatId, {
        text: "❌ No pude descargar el video.",
        quoted: msg,
        contextInfo: {
          mentionedJid: [sender],
          quotedMessage: msg.message,
          participant: sender
        }
      });
      return;
    }

    const buffer = fs.readFileSync(realFile);
    await sock.sendMessage(chatId, {
      video: buffer,
      mimetype: "video/mp4",
      fileName: `${found.title}.mp4`,
      caption: `🎬 ${found.title}\n🔗 ${found.url}\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
      mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
  } catch (e) {
    await sock.sendMessage(chatId, {
      text: "❌ Error al descargar el video.",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
  } finally {
    try { if (realFile && fs.existsSync(realFile)) fs.unlinkSync(realFile); } catch (_) {}
  }

  return;
}

      // 🎬 Video como documento (solo admin)
      if (body.startsWith("!mp4doc ")) {
        const nivelAdmin = await esAdmin(sock, chatId, sender);
        if (!nivelAdmin) {
          await sock.sendMessage(chatId, {
            text: `❌ Este comando es solo para administradores.\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
            mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
          return;
        }

        const query = body.replace("!mp4doc ", "").trim();
        if (!query) {
          await sock.sendMessage(chatId, { text: "❌ Usa: !mp4doc <nombre>",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
          return;
        }

        const found = await searchFirst(query);
        if (!found) {
          await sock.sendMessage(chatId, {
            text: `❌ Sin resultados.\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
            mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
          return;
        }

        const outPath = "./video.%(ext)s";
        let realFile = "";

        await sock.sendMessage(chatId, {
	  image: { url: found.thumbnail },
          caption: `⏬ Descargando video(doc): ${found.title}\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
          mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });

        try {
          await runYtDlp([
            "--format", "mp4",
            "--limit-rate", "500K",
            "-o", outPath,
            found.url
          ], log => {
            const m = log.match(/Destination:\s(.+\.(mp4|mkv|webm))/i);
            if (m && m[1]) realFile = m[1];
          });

          if (!realFile && fs.existsSync("./video.mp4")) realFile = "./video.mp4";
          if (!realFile || !fs.existsSync(realFile)) {
            await sock.sendMessage(chatId, {
              text: `❌ No pude ubicar el archivo descargado.\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
              mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
            return;
          }

          const buffer = fs.readFileSync(realFile);
          await sock.sendMessage(chatId, {
            document: buffer,
            mimetype: "video/mp4",
            fileName: `${found.title}.mp4`,
            caption: `🎬 ${found.title}\n🔗 ${found.url}\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
            mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
        } catch (e) {
          await sock.sendMessage(chatId, {
            text: `❌ Error al descargar el video.\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
            mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
        } finally {
          try { if (realFile && fs.existsSync(realFile)) fs.unlinkSync(realFile); } catch (_) {}
        }
        return;
      }

// 🎧 Audio con respuesta directa al usuario
if (body.startsWith("!mp3 ")) {
  const query = body.replace("!mp3 ", "").trim();
  if (!query) {
    await sock.sendMessage(chatId, {
      text: "❌ Usa: !mp3 <nombre>",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
    return;
  }

  const found = await searchFirst(query);
  if (!found) {
    await sock.sendMessage(chatId, {
      text: `❌ Sin resultados.\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
      mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
    return;
  }

  const outPath = "./audio.%(ext)s";
  let realFile = "";

  // ✅ Miniatura previa
  await sock.sendMessage(chatId, {
    image: { url: found.thumbnail },
    caption: `⏬ Descargando audio: ${found.title}\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
    mentions: [sender],
    quoted: msg,
    contextInfo: {
      mentionedJid: [sender],
      quotedMessage: msg.message,
      participant: sender
    }
  });

  try {
    await runYtDlp([
      "-x", "--audio-format", "mp3",
      "--limit-rate", "500K",
      "-o", outPath,
      found.url
    ], log => {
      const m = log.match(/Destination:\s(.+\.mp3)/i);
      if (m && m[1]) realFile = m[1];
    });

    if (!realFile && fs.existsSync("./audio.mp3")) realFile = "./audio.mp3";
    if (!realFile || !fs.existsSync(realFile)) {
      await sock.sendMessage(chatId, {
        text: `❌ No pude ubicar el MP3 descargado.\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
        mentions: [sender],
        quoted: msg,
        contextInfo: {
          mentionedJid: [sender],
          quotedMessage: msg.message,
          participant: sender
        }
      });
      return;
    }

    const buffer = fs.readFileSync(realFile);
    await sock.sendMessage(chatId, {
      document: buffer,
      mimetype: "audio/mpeg",
      fileName: `${found.title}.mp3`,
      caption: `🎧 ${found.title}\n🔗 ${found.url}\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
      mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
  } catch (e) {
    await sock.sendMessage(chatId, {
      text: `❌ Error al convertir a MP3.\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
      mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
  } finally {
    try { if (realFile && fs.existsSync(realFile)) fs.unlinkSync(realFile); } catch (_) {}
  }
  return;
}

	// 🔞 !nn mejorado: busca en Bing Videos o descarga desde enlace
      if (body.startsWith("!nn ")) {
        const query = body.replace("!nn ", "").trim();
        if (!query) {
          await sock.sendMessage(chatId, { text: "❌ Usa: !nn <nombre o enlace>",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
          return;
        }

        let videoUrl = query;

        // Si no es URL, buscar en Bing Videos
        if (!/^https?:\/\//i.test(query)) {
          try {
            const searchUrl = `https://www.bing.com/videos/search?q=${encodeURIComponent(query)}&form=HDRSC3`;
            const res = await fetch(searchUrl, {
              headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)" }
            });
            const html = await res.text();
            const $ = cheerio.load(html);

            const firstLink = $('a.title').first().attr('href');
            if (!firstLink) {
              await sock.sendMessage(chatId, { text: `❌ No encontré videos para: ${query}`,
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
              return;
            }
            videoUrl = firstLink;

            await sock.sendMessage(chatId, {
              text: `🔎 Encontrado: ${query}\n⏬ Descargando desde: ${videoUrl}`,
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
          } catch (e) {
            console.error("Error buscando en Bing:", e);
            await sock.sendMessage(chatId, { text: "❌ Error al buscar video.",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
            return;
          }
        } else {
          await sock.sendMessage(chatId, {
            text: `⏬ Descargando desde enlace: ${videoUrl}`,
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
        }

        const outPath = "./video.%(ext)s";
        let realFile = "";

        try {
          await runYtDlp([
            "--format", "mp4",
            "--limit-rate", "500K",
            "-o", outPath,
            videoUrl
          ], log => {
            const m = log.match(/Destination:\s(.+\.(mp4|mkv|webm))/i);
            if (m && m[1]) realFile = m[1];
          });

          if (!realFile && fs.existsSync("./video.mp4")) realFile = "./video.mp4";
          if (!realFile || !fs.existsSync(realFile)) {
            await sock.sendMessage(chatId, { text: "❌ No pude descargar el video.",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
            return;
          }

          const buffer = fs.readFileSync(realFile);
          await sock.sendMessage(chatId, {
            video: buffer,
            caption: `🔞 Video: ${query}\n🔗 ${videoUrl}\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
            mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
        } catch (e) {
          console.error("Error en !nn:", e);
          await sock.sendMessage(chatId, { text: "❌ Error al descargar video.",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
        } finally {
          try { if (realFile && fs.existsSync(realFile)) fs.unlinkSync(realFile); } catch (_) {}
        }

        return;
      }

// 🔞 !nnxnxx: buscar en XNXX (.com), elegir resultado y descargar con yt-dlp como documento
if (body.startsWith("!nnxnxx ")) {
  const args = body.replace("!nnxnxx ", "").trim().split(" ");
  let index = 0;
  let quality = "best[height<=480]"; // ✅ calidad por defecto (media)

  // Si el último argumento es un número, lo usamos como índice
  const lastArg = args[args.length - 1];
  if (/^\d+$/.test(lastArg)) {
    index = parseInt(lastArg) - 1;
    args.pop();
  }

  // Calidad opcional: alta o baja
  if (args.includes("alta")) {
    quality = "best"; // máxima calidad
    args.splice(args.indexOf("alta"), 1);
  } else if (args.includes("baja")) {
    quality = "best[height<=360]"; // baja calidad
    args.splice(args.indexOf("baja"), 1);
  }

  const query = args.join(" ");

  if (!query) {
    await sock.sendMessage(chatId, { text: "❌ Usa: !nnxnxx <nombre> [número] [alta|baja]",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
    return;
  }

  await sock.sendMessage(chatId, { text: `🔎 Buscando en XNXX: ${query}`,
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });

  try {
    const searchUrl = `https://www.xnxx.com/search/${encodeURIComponent(query)}`;
    const res = await fetch(searchUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const html = await res.text();
    const $ = cheerio.load(html);

    // ✅ Capturar enlaces /video-
    const links = $("a")
      .map((i, el) => $(el).attr("href"))
      .get()
      .filter(href => href && href.startsWith("/video-"));

    if (!links.length) {
      await sock.sendMessage(chatId, { text: `❌ No encontré videos para: ${query}`,
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
      return;
    }

    if (index >= links.length) {
      await sock.sendMessage(chatId, { text: `❌ Solo encontré ${links.length} resultados para: ${query}`,
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
      return;
    }

    const chosenLink = links[index];
    const videoUrl = `https://www.xnxx.com${chosenLink}`;

    // Extraer título del slug
    let videoTitle = chosenLink.split("/")[2] || "Video sin título";
    videoTitle = decodeURIComponent(videoTitle.replace(/_/g, " "));

    // Abrir página del video para extraer miniatura
    const pageRes = await fetch(videoUrl, { headers: { "User-Agent": "Mozilla/5.0" } });
    const pageHtml = await pageRes.text();
    const matchThumb = pageHtml.match(/setThumbUrl169\('([^']+)'\)/);
    const thumbUrl = matchThumb ? matchThumb[1] : null;

    // ✅ Avisar que ya se está descargando con título + miniatura
    if (thumbUrl) {
      await sock.sendMessage(chatId, {
        image: { url: thumbUrl },
        caption: `📥 Descargando video: *${videoTitle}*`,
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
    } else {
      await sock.sendMessage(chatId, { text: `📥 Descargando video: *${videoTitle}*`,
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
    }

    // Descargar con yt-dlp
    const outPath = "./video.%(ext)s";
    let realFile = "";
    await runYtDlp([
      "-f", quality,
      "-o", outPath,
      videoUrl
    ], log => {
      const m = log.match(/Destination:\s(.+\.(mp4|mkv|webm))/i);
      if (m && m[1]) realFile = m[1];
    });

    if (!realFile && fs.existsSync("./video.mp4")) realFile = "./video.mp4";
    if (!realFile || !fs.existsSync(realFile)) {
      await sock.sendMessage(chatId, { text: "❌ No pude descargar el video.",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
      return;
    }

    const buffer = fs.readFileSync(realFile);
    await sock.sendMessage(chatId, {
      document: buffer,                 // ✅ enviar como documento
      mimetype: "video/mp4",
      fileName: `xnxx_${videoTitle}_${index+1}.mp4`,
      caption: `🔞 Resultado #${index+1} en XNXX para: ${query}\nCalidad: ${quality}\n\n*🗣️ Pedido por:* @${jidSinDominio(sender)}`,
      mentions: [sender],
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });

    fs.unlinkSync(realFile);
  } catch (e) {
    console.error("Error en !nnxnxx:", e);
    await sock.sendMessage(chatId, { text: "❌ Error al descargar video desde XNXX.",
      quoted: msg,
      contextInfo: {
        mentionedJid: [sender],
        quotedMessage: msg.message,
        participant: sender
      }
    });
  }

  return;
}

    } catch (e) {
      console.error("❌ Error procesando mensaje:", e);
    }
  });


main();
