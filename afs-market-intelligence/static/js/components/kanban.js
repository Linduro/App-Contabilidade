/**
 * Wrapper SortableJS para colunas do kanban.
 */
export function initDealKanban(boardEl, onStageChange) {
  if (!window.Sortable) {
    console.warn('[AFS] SortableJS não carregado');
    return () => {};
  }
  const instances = [];
  boardEl.querySelectorAll('.kanban-col-body').forEach((col) => {
    const inst = window.Sortable.create(col, {
      group: 'afs-deals',
      animation: 160,
      ghostClass: 'kanban-card-ghost',
      dragClass: 'kanban-card-drag',
      onEnd(evt) {
        const dealId = evt.item.dataset.dealId;
        const stageId = evt.to.dataset.stageId;
        if (dealId && stageId) onStageChange(dealId, stageId);
      },
    });
    instances.push(inst);
  });
  return () => instances.forEach((i) => i.destroy());
}
