/**
 * Verifica contas AFS (mesmas do portal Firebase Auth).
 * Uso: node scripts/setup-afs-users.mjs
 */
const USERS = [
  { email: "cartoonhq@gmail.com", label: "Owner" },
  { email: "gabrieldouran@gmail.com", label: "Gabriel" },
]

console.log("AFS Market Intelligence — usuários autorizados\n")
console.log("Login via portal (mesma senha do sign-in principal):")
USERS.forEach((u) => console.log("  •", u.label + ":", u.email))
console.log("\nAcesso: /dashboard/afs-market-intelligence/")
console.log("A sessão Firebase do portal é reutilizada automaticamente.")
