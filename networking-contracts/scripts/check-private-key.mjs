import dotenv from "dotenv"
dotenv.config()

const pk = (process.env.PRIVATE_KEY ?? "").trim()
const strict = /^0x[0-9a-fA-F]{64}$/.test(pk)
const hex = pk.replace(/^0x/i, "")

console.log("PRIVATE_KEY definida:", pk.length > 0)
console.log("tamanho da linha:", pk.length, "(esperado 66 com prefixo 0x)")
console.log("comeca com 0x:", pk.startsWith("0x"))
console.log("hex apos 0x:", hex.length, "caracteres (esperado 64)")
console.log("passa validacao Hardhat:", strict)
console.log("contas disponiveis:", strict ? 1 : 0)

if (pk.length > 0 && !strict) {
  if (pk.startsWith('"') || pk.startsWith("'")) {
    console.log("Dica: remova aspas ao redor da chave no .env")
  }
  if (!pk.startsWith("0x")) {
    console.log("Dica: adicione o prefixo 0x no inicio")
  }
  if (hex.length !== 64) {
    console.log("Dica: a chave deve ter exatamente 64 caracteres hex (32 bytes)")
  }
  if (/[^0-9a-fA-Fx]/i.test(hex)) {
    console.log("Dica: remova espacos, quebras de linha ou caracteres invalidos")
  }
}
