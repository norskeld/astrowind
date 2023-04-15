import tailwind, { type Config as TailwindConfig } from 'tailwindcss'
import type { CSSOptions, UserConfig } from 'vite'
import type { AstroIntegration } from 'astro'
import autoprefixer from 'autoprefixer'

interface TailwindOptions {
  config?: {
    /**
     * Path to the config file.
     *
     * @default 'tailwind.config.js'
     */
    path?: string

    /**
     * Apply Tailwind's base styles.
     *
     * Disabling this is useful when further customization of Tailwind styles and directives is
     * required. See {@link https://tailwindcss.com/docs/functions-and-directives#tailwind Tailwind's docs}
     * for more details on directives and customization.
     *
     * @default true
     */
    applyBaseStyles?: boolean
  }
}

async function getPostCssConfig(
  root: UserConfig['root'],
  postcssInlineOptions: CSSOptions['postcss']
) {
  let postcssConfigResult

  // Check if postcss config is not inlined.
  if (!(typeof postcssInlineOptions === 'object' && postcssInlineOptions !== null)) {
    const { default: postcssrc } = await import('postcss-load-config')
    const searchPath = typeof postcssInlineOptions === 'string' ? postcssInlineOptions : root!

    try {
      postcssConfigResult = await postcssrc({}, searchPath)
    } catch {
      postcssConfigResult = null
    }
  }

  return postcssConfigResult
}

async function getViteConfiguration(
  tailwindConfig: TailwindConfig | { config: string } | undefined,
  viteConfig: UserConfig
) {
  // We need to manually load postcss config files because inlining the tailwind and autoprefixer
  // causes vite to ignore postcss config files.
  const postcssConfig = await getPostCssConfig(viteConfig.root, viteConfig.css?.postcss)

  const postcssOptions = (postcssConfig && postcssConfig.options) ?? {}
  const postcssPlugins = postcssConfig && postcssConfig.plugins ? postcssConfig.plugins.slice() : []

  postcssPlugins.push(tailwind(tailwindConfig))
  postcssPlugins.push(autoprefixer())

  return {
    css: {
      postcss: {
        options: postcssOptions,
        plugins: postcssPlugins
      }
    }
  }
}

export default function tailwindIntegration(options?: TailwindOptions): AstroIntegration {
  const applyBaseStyles = options?.config?.applyBaseStyles ?? true
  const customConfigPath = options?.config?.path

  return {
    name: '@nrsk/astrowind',
    hooks: {
      'astro:config:setup': async ({ config, updateConfig, injectScript }) => {
        // Inject the Tailwind postcss plugin.
        updateConfig({
          vite: await getViteConfiguration(
            customConfigPath ? { config: customConfigPath } : undefined,
            config.vite as UserConfig
          )
        })

        if (applyBaseStyles) {
          // Inject the Tailwind base import.
          injectScript('page-ssr', `import '@nrsk/astrowind/base.css';`)
        }
      }
    }
  }
}
