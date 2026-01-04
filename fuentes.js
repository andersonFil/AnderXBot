// fuentes.js
// Utilidades para aplicar fuentes según el modo del bot

export function aplicarFuente(texto, modo) {
  if (modo === "gotico") {
    // Fuente gótica transparente
    return texto
      .replace(/A/g, "𝓐").replace(/B/g, "𝓑").replace(/C/g, "𝓒")
      .replace(/D/g, "𝓓").replace(/E/g, "𝓔").replace(/F/g, "𝓕")
      .replace(/G/g, "𝓖").replace(/H/g, "𝓗").replace(/I/g, "𝓘")
      .replace(/J/g, "𝓙").replace(/K/g, "𝓚").replace(/L/g, "𝓛")
      .replace(/M/g, "𝓜").replace(/N/g, "𝓝").replace(/O/g, "𝓞")
      .replace(/P/g, "𝓟").replace(/Q/g, "𝓠").replace(/R/g, "𝓡")
      .replace(/S/g, "𝓢").replace(/T/g, "𝓣").replace(/U/g, "𝓤")
      .replace(/V/g, "𝓥").replace(/W/g, "𝓦").replace(/X/g, "𝓧")
      .replace(/Y/g, "𝓨").replace(/Z/g, "𝓩");
  } else if (modo === "sangre") {
    // Fuente sangrienta (Fraktur)
    return texto
      .replace(/A/g, "𝕬").replace(/B/g, "𝕭").replace(/C/g, "𝕮")
      .replace(/D/g, "𝕯").replace(/E/g, "𝕰").replace(/F/g, "𝕱")
      .replace(/G/g, "𝕲").replace(/H/g, "𝕳").replace(/I/g, "𝕴")
      .replace(/J/g, "𝕵").replace(/K/g, "𝕶").replace(/L/g, "𝕷")
      .replace(/M/g, "𝕸").replace(/N/g, "𝕹").replace(/O/g, "𝕺")
      .replace(/P/g, "𝕻").replace(/Q/g, "𝕼").replace(/R/g, "𝕽")
      .replace(/S/g, "𝕾").replace(/T/g, "𝕿").replace(/U/g, "𝖀")
      .replace(/V/g, "𝖁").replace(/W/g, "𝖂").replace(/X/g, "𝖃")
      .replace(/Y/g, "𝖄").replace(/Z/g, "𝖅");
  } else {
    // Fuente premium (serif elegante)
    return texto
      .replace(/A/g, "𝐀").replace(/B/g, "𝐁").replace(/C/g, "𝐂")
      .replace(/D/g, "𝐃").replace(/E/g, "𝐄").replace(/F/g, "𝐅")
      .replace(/G/g, "𝐆").replace(/H/g, "𝐇").replace(/I/g, "𝐈")
      .replace(/J/g, "𝐉").replace(/K/g, "𝐊").replace(/L/g, "𝐋")
      .replace(/M/g, "𝐌").replace(/N/g, "𝐍").replace(/O/g, "𝐎")
      .replace(/P/g, "𝐏").replace(/Q/g, "𝐐").replace(/R/g, "𝐑")
      .replace(/S/g, "𝐒").replace(/T/g, "𝐓").replace(/U/g, "𝐔")
      .replace(/V/g, "𝐕").replace(/W/g, "𝐖").replace(/X/g, "𝐗")
      .replace(/Y/g, "𝐘").replace(/Z/g, "𝐙");
  }
}
