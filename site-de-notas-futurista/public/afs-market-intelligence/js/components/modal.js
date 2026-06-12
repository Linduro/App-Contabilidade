export function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

export function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

export function bindModalCloses(root) {
  root.querySelectorAll('[data-close-modal]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.closeModal;
      if (id) closeModal(id);
      else btn.closest('.l2-modal-overlay')?.classList.remove('open');
    });
  });
  root.querySelectorAll('.l2-modal-overlay').forEach((ov) => {
    ov.addEventListener('click', (e) => {
      if (e.target === ov) ov.classList.remove('open');
    });
  });
}
