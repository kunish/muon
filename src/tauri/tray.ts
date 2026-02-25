import { Menu, MenuItem } from '@tauri-apps/api/menu'
import { TrayIcon } from '@tauri-apps/api/tray'
import { getCurrentWindow } from '@tauri-apps/api/window'

let tray: TrayIcon | null = null

export async function setupTray(): Promise<void> {
  const mainWindow = getCurrentWindow()

  const menu = await Menu.new({
    items: [
      await MenuItem.new({
        text: '打开 Muon',
        action: () => {
          mainWindow.show()
          mainWindow.setFocus()
        },
      }),
      await MenuItem.new({
        text: '退出',
        action: () => {
          mainWindow.destroy()
        },
      }),
    ],
  })

  tray = await TrayIcon.new({
    icon: 'icons/icon.png',
    menu,
    tooltip: 'Muon',
    menuOnLeftClick: false,
    action: () => {
      mainWindow.show()
      mainWindow.setFocus()
    },
  })
}

export async function updateTrayBadge(count: number): Promise<void> {
  if (!tray)
    return
  const tooltip = count > 0 ? `Muon (${count} 条未读)` : 'Muon'
  await tray.setTooltip(tooltip)
}

export async function destroyTray(): Promise<void> {
  if (tray) {
    await tray.close()
    tray = null
  }
}
