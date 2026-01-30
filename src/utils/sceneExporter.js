import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'

/**
 * Export a Three.js scene to GLTF format
 * @param {THREE.Scene} scene - The Three.js scene to export
 * @param {Object} options - Export options
 * @returns {Promise<ArrayBuffer|Object>} - The exported data
 */
export async function exportSceneToGLTF(scene, options = {}) {
  const {
    binary = true, // Export as GLB (binary) by default
    animations = [],
    onlyVisible = true,
    includeCustomExtensions = false,
  } = options

  const exporter = new GLTFExporter()

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        resolve(result)
      },
      (error) => {
        reject(error)
      },
      {
        binary,
        animations,
        onlyVisible,
        includeCustomExtensions,
      }
    )
  })
}

/**
 * Download a scene as a GLTF/GLB file
 * @param {THREE.Scene} scene - The Three.js scene to export
 * @param {string} filename - The filename (without extension)
 * @param {Object} options - Export options
 */
export async function downloadSceneAsGLTF(scene, filename = 'scene', options = {}) {
  const binary = options.binary !== false

  try {
    const result = await exportSceneToGLTF(scene, { ...options, binary })

    let blob
    let extension

    if (binary) {
      blob = new Blob([result], { type: 'application/octet-stream' })
      extension = 'glb'
    } else {
      const json = JSON.stringify(result, null, 2)
      blob = new Blob([json], { type: 'application/json' })
      extension = 'gltf'
    }

    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${filename}.${extension}`
    link.click()
    URL.revokeObjectURL(url)

    return true
  } catch (error) {
    console.error('Failed to export scene:', error)
    throw error
  }
}

/**
 * Export scene data as JSON for reconstruction
 * This exports the scene configuration rather than geometry
 * @param {Object} sceneConfig - Scene configuration object
 * @returns {string} - JSON string
 */
export function exportSceneConfig(sceneConfig) {
  const config = {
    version: '1.0',
    timestamp: new Date().toISOString(),
    ...sceneConfig,
  }

  return JSON.stringify(config, null, 2)
}

/**
 * Download scene configuration as JSON
 * @param {Object} sceneConfig - Scene configuration
 * @param {string} filename - The filename
 */
export function downloadSceneConfig(sceneConfig, filename = 'scene-config') {
  const json = exportSceneConfig(sceneConfig)
  const blob = new Blob([json], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${filename}.json`
  link.click()
  URL.revokeObjectURL(url)
}

/**
 * Create a scene configuration object that can be saved and loaded
 * @param {string} sceneType - Type of scene (mountain, city, etc.)
 * @param {Object} props - Scene properties
 * @param {Object} objects - Additional objects in the scene
 * @returns {Object} - Scene configuration
 */
export function createSceneConfig(sceneType, props = {}, objects = []) {
  return {
    type: sceneType,
    props: { ...props },
    objects: objects.map((obj) => ({
      type: obj.type,
      position: obj.position || [0, 0, 0],
      rotation: obj.rotation || [0, 0, 0],
      scale: obj.scale || 1,
      props: obj.props || {},
    })),
    environment: {
      timeOfDay: props.timeOfDay || 'day',
      weather: props.weather || 'clear',
      fog: props.fog || null,
    },
  }
}

/**
 * Load a scene configuration from JSON
 * @param {string} json - JSON string
 * @returns {Object} - Parsed scene configuration
 */
export function loadSceneConfig(json) {
  try {
    const config = JSON.parse(json)

    if (!config.type) {
      throw new Error('Invalid scene configuration: missing type')
    }

    return config
  } catch (error) {
    console.error('Failed to load scene configuration:', error)
    throw error
  }
}

/**
 * Serialize scene objects to a portable format
 * @param {THREE.Object3D} object - Three.js object
 * @returns {Object} - Serialized object data
 */
export function serializeObject(object) {
  const data = {
    name: object.name,
    type: object.type,
    position: object.position.toArray(),
    rotation: [object.rotation.x, object.rotation.y, object.rotation.z],
    scale: object.scale.toArray(),
    visible: object.visible,
    userData: object.userData,
  }

  if (object.geometry) {
    data.geometry = {
      type: object.geometry.type,
      parameters: object.geometry.parameters,
    }
  }

  if (object.material) {
    if (Array.isArray(object.material)) {
      data.materials = object.material.map(serializeMaterial)
    } else {
      data.material = serializeMaterial(object.material)
    }
  }

  if (object.children && object.children.length > 0) {
    data.children = object.children.map(serializeObject)
  }

  return data
}

/**
 * Serialize material to portable format
 * @param {THREE.Material} material - Three.js material
 * @returns {Object} - Serialized material data
 */
function serializeMaterial(material) {
  return {
    type: material.type,
    color: material.color?.getHexString(),
    metalness: material.metalness,
    roughness: material.roughness,
    transparent: material.transparent,
    opacity: material.opacity,
    side: material.side,
  }
}

export default {
  exportSceneToGLTF,
  downloadSceneAsGLTF,
  exportSceneConfig,
  downloadSceneConfig,
  createSceneConfig,
  loadSceneConfig,
  serializeObject,
}
