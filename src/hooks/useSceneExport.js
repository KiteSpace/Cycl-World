import { useCallback, useRef } from 'react'
import { useThree } from '@react-three/fiber'
import {
  downloadSceneAsGLTF,
  downloadSceneConfig,
  createSceneConfig,
  serializeObject,
} from '../utils/sceneExporter'

/**
 * Hook for exporting scenes from React Three Fiber
 * @returns {Object} - Export functions
 */
export function useSceneExport() {
  const { scene, gl, camera } = useThree()
  const sceneConfigRef = useRef(null)

  /**
   * Set the current scene configuration
   * @param {Object} config - Scene configuration
   */
  const setSceneConfig = useCallback((config) => {
    sceneConfigRef.current = config
  }, [])

  /**
   * Export the current scene as GLTF/GLB
   * @param {string} filename - Output filename
   * @param {Object} options - Export options
   */
  const exportAsGLTF = useCallback(
    async (filename = 'cycling-scene', options = {}) => {
      try {
        await downloadSceneAsGLTF(scene, filename, options)
        return true
      } catch (error) {
        console.error('Export failed:', error)
        return false
      }
    },
    [scene]
  )

  /**
   * Export the current scene as GLB (binary GLTF)
   * @param {string} filename - Output filename
   */
  const exportAsGLB = useCallback(
    async (filename = 'cycling-scene') => {
      return exportAsGLTF(filename, { binary: true })
    },
    [exportAsGLTF]
  )

  /**
   * Export the scene configuration as JSON
   * @param {string} filename - Output filename
   */
  const exportConfig = useCallback(
    (filename = 'scene-config') => {
      if (sceneConfigRef.current) {
        downloadSceneConfig(sceneConfigRef.current, filename)
        return true
      } else {
        console.warn('No scene configuration set')
        return false
      }
    },
    []
  )

  /**
   * Get serialized scene data
   * @returns {Object} - Serialized scene
   */
  const getSerializedScene = useCallback(() => {
    return serializeObject(scene)
  }, [scene])

  /**
   * Take a screenshot of the current view
   * @param {string} filename - Output filename
   * @param {Object} options - Screenshot options
   */
  const takeScreenshot = useCallback(
    (filename = 'scene-screenshot', options = {}) => {
      const { width = 1920, height = 1080, format = 'png' } = options

      // Store original size
      const originalSize = gl.getSize({ width: 0, height: 0 })

      // Render at specified size
      gl.setSize(width, height)
      gl.render(scene, camera)

      // Get image data
      const dataUrl = gl.domElement.toDataURL(`image/${format}`)

      // Restore original size
      gl.setSize(originalSize.width, originalSize.height)

      // Download
      const link = document.createElement('a')
      link.href = dataUrl
      link.download = `${filename}.${format}`
      link.click()

      return dataUrl
    },
    [gl, scene, camera]
  )

  return {
    exportAsGLTF,
    exportAsGLB,
    exportConfig,
    setSceneConfig,
    getSerializedScene,
    takeScreenshot,
    scene,
  }
}

/**
 * Hook for creating and managing scene configurations
 * @param {string} sceneType - Type of scene
 * @param {Object} initialProps - Initial scene properties
 * @returns {Object} - Configuration functions
 */
export function useSceneConfig(sceneType, initialProps = {}) {
  const configRef = useRef(createSceneConfig(sceneType, initialProps))

  /**
   * Update scene properties
   * @param {Object} props - New properties
   */
  const updateProps = useCallback((props) => {
    configRef.current = {
      ...configRef.current,
      props: { ...configRef.current.props, ...props },
    }
  }, [])

  /**
   * Add an object to the scene configuration
   * @param {Object} object - Object to add
   */
  const addObject = useCallback((object) => {
    configRef.current = {
      ...configRef.current,
      objects: [...configRef.current.objects, object],
    }
  }, [])

  /**
   * Remove an object from the scene configuration
   * @param {number} index - Index of object to remove
   */
  const removeObject = useCallback((index) => {
    configRef.current = {
      ...configRef.current,
      objects: configRef.current.objects.filter((_, i) => i !== index),
    }
  }, [])

  /**
   * Get the current configuration
   * @returns {Object} - Current configuration
   */
  const getConfig = useCallback(() => {
    return { ...configRef.current }
  }, [])

  /**
   * Reset to initial configuration
   */
  const reset = useCallback(() => {
    configRef.current = createSceneConfig(sceneType, initialProps)
  }, [sceneType, initialProps])

  return {
    updateProps,
    addObject,
    removeObject,
    getConfig,
    reset,
  }
}

export default useSceneExport
