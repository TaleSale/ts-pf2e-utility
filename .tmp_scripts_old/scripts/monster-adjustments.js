Hooks.on("renderNPCSheetPF2e", (app, html, data) => {
    // Находим секцию пассивных способностей
    const passiveSection = html.find(".passives.section-container");
    if (passiveSection.length === 0) return;

    // Находим все элементы (li) в списке пассивных способностей
    const items = passiveSection.find(".item-list .item");
    const adjustmentItems = [];

    // Ищем способности, начинающиеся с "√ Корректировка"
    items.each((index, element) => {
        const itemName = $(element).find("h4").text().trim();
        if (itemName.startsWith("√ Корректировка")) {
            adjustmentItems.push(element);
        }
    });

    // Если такие способности найдены, создаем новый блок
    if (adjustmentItems.length > 0) {
        // Создаем структуру нового блока, копируя структуру из вашего примера
        const adjustmentsBlock = $(`
            <div class="adjustments-section section-container">
                <div class="section-header">
                    <h4>Корректировки</h4>
                    <div class="actions-controls controls">
                        <!-- Кнопка добавления удалена для чистоты, так как это спец. секция -->
                    </div>
                </div>
                <div class="section-body">
                    <ol class="actions-list item-list">
                    </ol>
                </div>
            </div>
        `);

        // Добавляем найденные элементы в новый список
        const list = adjustmentsBlock.find(".item-list");
        adjustmentItems.forEach(item => {
            list.append(item);
        });

        // Вставляем новый блок сразу после секции пассивных способностей
        passiveSection.after(adjustmentsBlock);

        // Если в оригинальной секции пассивных способностей ничего не осталось, 
        // можно её скрыть (опционально)
        if (passiveSection.find(".item-list .item").length === 0) {
            // passiveSection.hide(); // Раскомментируйте, если хотите скрывать пустой блок "Пассивные"
        }
    }
});