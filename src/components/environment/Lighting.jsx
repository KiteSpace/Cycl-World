import { useRef } from 'react'
import { useHelper } from '@react-three/drei'
import * as THREE from 'three'
import { useControls } from 'leva'

export function Lighting({
  preset = 'day',
  intensity = 1,
  showHelpers = false,
}) {
  const directionalRef = useRef()

  const presets = {
    day: {
      ambient: { intensity: 0.4, color: '#ffffff' },
      directional: {
        intensity: 1.5,
        color: '#fff5e6',
        position: [50, 50, 25],
      },
    },
    sunset: {
      ambient: { intensity: 0.3, color: '#ffccaa' },
      directional: {
        intensity: 1.2,
        color: '#ff8844',
        position: [100, 20, 0],
      },
    },
    night: {
      ambient: { intensity: 0.1, color: '#334466' },
      directional: {
        intensity: 0.3,
        color: '#6688cc',
        position: [30, 50, 30],
      },
    },
    dawn: {
      ambient: { intensity: 0.25, color: '#ffeedd' },
      directional: {
        intensity: 1.0,
        color: '#ffaa77',
        position: [-80, 15, 0],
      },
    },
    overcast: {
      ambient: { intensity: 0.6, color: '#cccccc' },
      directional: {
        intensity: 0.4,
        color: '#ffffff',
        position: [0, 100, 0],
      },
    },
  }

  const settings = presets[preset] || presets.day

  // Optional helper visualization
  if (showHelpers && directionalRef.current) {
    useHelper(directionalRef, THREE.DirectionalLightHelper, 5, 'red')
  }

  return (
    <group>
      <ambientLight
        intensity={settings.ambient.intensity * intensity}
        color={settings.ambient.color}
      />

      <directionalLight
        ref={directionalRef}
        intensity={settings.directional.intensity * intensity}
        color={settings.directional.color}
        position={settings.directional.position}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0001}
      />

      <hemisphereLight
        intensity={0.3 * intensity}
        color="#87ceeb"
        groundColor="#3d5c3d"
      />
    </group>
  )
}

export function StreetLighting({ positions = [], lightColor = '#ffdd88', intensity = 1 }) {
  return (
    <group>
      {positions.map((pos, i) => (
        <group key={i} position={pos}>
          {/* Light pole */}
          <mesh position={[0, 2.5, 0]} castShadow>
            <cylinderGeometry args={[0.05, 0.08, 5, 8]} />
            <meshStandardMaterial color="#333333" metalness={0.8} />
          </mesh>

          {/* Light fixture */}
          <mesh position={[0.3, 4.8, 0]}>
            <boxGeometry args={[0.4, 0.15, 0.2]} />
            <meshStandardMaterial color="#444444" metalness={0.7} />
          </mesh>

          {/* Point light */}
          <pointLight
            position={[0.3, 4.6, 0]}
            intensity={intensity}
            color={lightColor}
            distance={15}
            decay={2}
            castShadow
          />
        </group>
      ))}
    </group>
  )
}

export function InteractiveLighting() {
  const { preset, intensity, showHelpers } = useControls('Lighting', {
    preset: {
      value: 'day',
      options: ['day', 'sunset', 'night', 'dawn', 'overcast'],
    },
    intensity: { value: 1, min: 0, max: 2, step: 0.1 },
    showHelpers: false,
  })

  return <Lighting preset={preset} intensity={intensity} showHelpers={showHelpers} />
}

export default Lighting
