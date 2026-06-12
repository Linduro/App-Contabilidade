export function placeholderModule(name, desc) {
  return async function ({ mount }) {
    mount.innerHTML =
      '<div class="l2-card">' +
        '<h3>' + name + '</h3>' +
        '<p class="hint">' + (desc || 'Módulo em construção nesta fase.') + '</p>' +
        '<p><a href="#/apps">← Voltar ao Home</a> · <a href="#/legacy">UI legada</a></p>' +
      '</div>';
  };
}
