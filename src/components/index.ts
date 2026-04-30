import type { App, Component } from 'vue'

type ComponentModule = {
  default?: Component
}

const components = import.meta.glob<ComponentModule>('./*/index.{js,ts,vue}', { eager: true })
const singleComponents = import.meta.glob<ComponentModule>('./*.vue', { eager: true })

function toPascalCase(name: string): string {
  const normalized = name.replace(/\.vue$/, '')
  const capitalized = normalized.charAt(0).toUpperCase() + normalized.slice(1)

  return capitalized.replace(/-[a-zA-Z]/g, (segment) => segment.replace('-', '').toUpperCase())
}

function getComponentName(path: string): string | null {
  if (path === './index.ts' || path === './index.js') {
    return null
  }

  const normalizedPath = path.replace('./', '')
  const pathArr = normalizedPath.split('/')

  if (normalizedPath.includes('/')) {
    if (pathArr.length > 2) {
      return null
    }

    const second = pathArr[1]
    if (!(second === 'index.js' || second === 'index.ts' || second === 'index.vue')) {
      return null
    }
  }

  return toPascalCase(pathArr[0])
}

export function registerComponents(app: App): void {
  const modules = { ...components, ...singleComponents }

  Object.entries(modules).forEach(([path, mod]) => {
    const name = getComponentName(path)

    if (!name) {
      return
    }

    app.component(name, mod.default ?? mod)
  })
}
