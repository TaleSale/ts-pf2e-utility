const MODULE_ID = "ts-pf2e-utility";

function getReloadableResourceUrls() {
  const urls = new Set([globalThis.location.href]);

  for (const element of document.querySelectorAll("script[src], link[href]")) {
    const source = element.src || element.href;
    if (source) urls.add(source);
  }

  for (const entry of performance.getEntriesByType?.("resource") ?? []) {
    if (["script", "link", "css"].includes(entry.initiatorType)) urls.add(entry.name);
  }

  return [...urls].filter((source) => {
    try {
      const url = new URL(source, globalThis.location.href);
      return url.origin === globalThis.location.origin && ["http:", "https:"].includes(url.protocol);
    } catch (_error) {
      return false;
    }
  });
}

async function refreshHttpResources() {
  const urls = getReloadableResourceUrls();
  const results = await Promise.allSettled(urls.map(async (source) => {
    const response = await fetch(source, {
      cache: "reload",
      credentials: "same-origin",
    });
    if (response.ok) await response.arrayBuffer();
    return response.ok;
  }));

  return results.filter((result) => result.status === "fulfilled" && result.value).length;
}

export async function forceClientRefresh() {
  ui.notifications?.info("Обновляю кэш клиента…");

  try {
    const refreshedCount = await refreshHttpResources();
    console.info(`${MODULE_ID} | client cache refresh`, { refreshedCount });
  } catch (error) {
    console.warn(`${MODULE_ID} | client cache refresh completed with errors`, error);
  }

  globalThis.location.reload();
}

export async function openHardRefreshDialog() {
  const title = "Принудительно обновить клиент";
  const content = `
    <p>Клиент заново запросит загруженные скрипты и стили Foundry, затем мягко обновит текущую страницу.</p>
    <p><strong>Сессия, адрес мира, настройки, cookies и данные мира сохраняются.</strong></p>
    <p class="notes">Очистка служебных хранилищ и переход на другой URL не выполняются.</p>
  `;

  const confirmed = foundry.applications?.api?.DialogV2?.confirm
    ? await foundry.applications.api.DialogV2.confirm({
        window: { title },
        content,
        yes: { label: "Обновить" },
        no: { label: "Отмена" },
      })
    : globalThis.confirm("Принудительно обновить ресурсы клиента и перезагрузить текущую страницу?");

  if (confirmed) await forceClientRefresh();
}
