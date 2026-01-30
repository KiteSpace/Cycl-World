import { Suspense, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, PerspectiveCamera, Environment, Stats } from '@react-three/drei'
import { Leva, useControls, button } from 'leva'

import {
  MountainScene,
  AlpineClimbScene,
  CityScene,
  CriteriumRaceScene,
  CommuteCityScene,
  CountrysideScene,
  GranFondoScene,
  SunsetCountryRide,
  VelodromeScene,
  OutdoorTrackScene,
  CoastalScene,
  SunsetBeachRide,
  TropicalIslandRide,
} from './scenes'

const SCENES = {
  mountain: { component: MountainScene, name: 'Mountain Ride' },
  alpineClimb: { component: AlpineClimbScene, name: 'Alpine Climb' },
  city: { component: CityScene, name: 'City Streets' },
  criterium: { component: CriteriumRaceScene, name: 'Criterium Race' },
  commute: { component: CommuteCityScene, name: 'City Commute' },
  countryside: { component: CountrysideScene, name: 'Countryside' },
  granFondo: { component: GranFondoScene, name: 'Gran Fondo' },
  sunsetCountry: { component: SunsetCountryRide, name: 'Sunset Country Ride' },
  velodrome: { component: VelodromeScene, name: 'Velodrome' },
  outdoorTrack: { component: OutdoorTrackScene, name: 'Outdoor Track' },
  coastal: { component: CoastalScene, name: 'Coastal Ride' },
  sunsetBeach: { component: SunsetBeachRide, name: 'Sunset Beach' },
  tropicalIsland: { component: TropicalIslandRide, name: 'Tropical Island' },
}

function LoadingFallback() {
  return (
    <mesh>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial color="#888888" wireframe />
    </mesh>
  )
}

function SceneContent({ sceneName, sceneProps }) {
  const SceneComponent = SCENES[sceneName]?.component || MountainScene
  return <SceneComponent {...sceneProps} />
}

export function SceneViewer({ defaultScene = 'mountain', showControls = true }) {
  const [showStats, setShowStats] = useState(false)

  const { scene, timeOfDay, showCyclist } = useControls('Scene', {
    scene: {
      value: defaultScene,
      options: Object.entries(SCENES).reduce((acc, [key, val]) => {
        acc[val.name] = key
        return acc
      }, {}),
    },
    timeOfDay: {
      value: 'day',
      options: ['day', 'evening', 'night', 'dawn'],
    },
    showCyclist: true,
  })

  const { fov, near, far } = useControls('Camera', {
    fov: { value: 60, min: 30, max: 120, step: 1 },
    near: { value: 0.1, min: 0.01, max: 1, step: 0.01 },
    far: { value: 1000, min: 100, max: 5000, step: 100 },
  })

  const { autoRotate, autoRotateSpeed, enableDamping } = useControls('Controls', {
    autoRotate: false,
    autoRotateSpeed: { value: 0.5, min: 0.1, max: 5, step: 0.1 },
    enableDamping: true,
  })

  useControls('Debug', {
    'Toggle Stats': button(() => setShowStats((s) => !s)),
  })

  const sceneProps = {
    timeOfDay,
    showCyclist,
  }

  return (
    <div style={{ width: '100%', height: '100vh', background: '#000' }}>
      <Leva collapsed={!showControls} hidden={!showControls} />

      <Canvas shadows>
        <PerspectiveCamera
          makeDefault
          position={[30, 20, 50]}
          fov={fov}
          near={near}
          far={far}
        />

        <OrbitControls
          autoRotate={autoRotate}
          autoRotateSpeed={autoRotateSpeed}
          enableDamping={enableDamping}
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={200}
          maxPolarAngle={Math.PI / 2 - 0.1}
        />

        <Suspense fallback={<LoadingFallback />}>
          <SceneContent sceneName={scene} sceneProps={sceneProps} />
        </Suspense>

        {showStats && <Stats />}
      </Canvas>
    </div>
  )
}

export function SimpleSceneViewer({ children }) {
  return (
    <div style={{ width: '100%', height: '100vh', background: '#1a1a1a' }}>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={[30, 20, 50]} fov={60} />
        <OrbitControls
          enableDamping
          dampingFactor={0.05}
          minDistance={5}
          maxDistance={200}
        />
        <Suspense fallback={<LoadingFallback />}>{children}</Suspense>
      </Canvas>
    </div>
  )
}

export function EmbeddableScene({
  scene = 'mountain',
  width = '100%',
  height = '400px',
  cameraPosition = [30, 20, 50],
  autoRotate = true,
  sceneProps = {},
}) {
  const SceneComponent = SCENES[scene]?.component || MountainScene

  return (
    <div style={{ width, height, background: '#1a1a1a' }}>
      <Canvas shadows>
        <PerspectiveCamera makeDefault position={cameraPosition} fov={60} />
        <OrbitControls
          autoRotate={autoRotate}
          autoRotateSpeed={0.3}
          enableDamping
          dampingFactor={0.05}
        />
        <Suspense fallback={<LoadingFallback />}>
          <SceneComponent {...sceneProps} />
        </Suspense>
      </Canvas>
    </div>
  )
}

export default SceneViewer
