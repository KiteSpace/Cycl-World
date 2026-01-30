import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function Bicycle({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  color = '#cc3333',
  wheelRotation = 0,
}) {
  const wheelRadius = 0.35
  const frameColor = color
  const wheelColor = '#222222'
  const spokeColor = '#888888'

  return (
    <group position={position} rotation={rotation}>
      {/* Frame - simplified */}
      <group>
        {/* Top tube */}
        <mesh position={[0, 0.55, 0]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
          <meshStandardMaterial color={frameColor} metalness={0.8} />
        </mesh>

        {/* Down tube */}
        <mesh position={[-0.1, 0.4, 0]} rotation={[0, 0, Math.PI / 4]}>
          <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
          <meshStandardMaterial color={frameColor} metalness={0.8} />
        </mesh>

        {/* Seat tube */}
        <mesh position={[0.2, 0.45, 0]} rotation={[0, 0, 0.2]}>
          <cylinderGeometry args={[0.02, 0.02, 0.5, 8]} />
          <meshStandardMaterial color={frameColor} metalness={0.8} />
        </mesh>

        {/* Chain stay */}
        <mesh position={[0.05, 0.2, 0]} rotation={[0, 0, Math.PI / 2 - 0.15]}>
          <cylinderGeometry args={[0.015, 0.015, 0.45, 8]} />
          <meshStandardMaterial color={frameColor} metalness={0.8} />
        </mesh>

        {/* Seat stay */}
        <mesh position={[0.22, 0.38, 0]} rotation={[0, 0, 0.5]}>
          <cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
          <meshStandardMaterial color={frameColor} metalness={0.8} />
        </mesh>

        {/* Fork */}
        <mesh position={[-0.28, 0.35, 0]} rotation={[0, 0, 0.15]}>
          <cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
          <meshStandardMaterial color={frameColor} metalness={0.8} />
        </mesh>
      </group>

      {/* Front wheel */}
      <group position={[-0.35, wheelRadius, 0]} rotation={[wheelRotation, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[wheelRadius, 0.025, 8, 32]} />
          <meshStandardMaterial color={wheelColor} />
        </mesh>
        {/* Spokes */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} rotation={[0, 0, (i / 8) * Math.PI * 2]}>
            <cylinderGeometry args={[0.005, 0.005, wheelRadius * 2, 4]} />
            <meshStandardMaterial color={spokeColor} />
          </mesh>
        ))}
        {/* Hub */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.05, 8]} />
          <meshStandardMaterial color={spokeColor} metalness={0.9} />
        </mesh>
      </group>

      {/* Rear wheel */}
      <group position={[0.35, wheelRadius, 0]} rotation={[wheelRotation, 0, 0]}>
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[wheelRadius, 0.025, 8, 32]} />
          <meshStandardMaterial color={wheelColor} />
        </mesh>
        {/* Spokes */}
        {Array.from({ length: 8 }).map((_, i) => (
          <mesh key={i} rotation={[0, 0, (i / 8) * Math.PI * 2]}>
            <cylinderGeometry args={[0.005, 0.005, wheelRadius * 2, 4]} />
            <meshStandardMaterial color={spokeColor} />
          </mesh>
        ))}
        {/* Hub */}
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.05, 8]} />
          <meshStandardMaterial color={spokeColor} metalness={0.9} />
        </mesh>
      </group>

      {/* Handlebars */}
      <mesh position={[-0.28, 0.6, 0]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.015, 0.015, 0.35, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* Saddle */}
      <mesh position={[0.25, 0.7, 0]}>
        <boxGeometry args={[0.15, 0.03, 0.08]} />
        <meshStandardMaterial color="#222222" />
      </mesh>

      {/* Pedals */}
      <mesh position={[0.05, 0.15, 0.1]}>
        <boxGeometry args={[0.08, 0.02, 0.06]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      <mesh position={[0.05, 0.15, -0.1]}>
        <boxGeometry args={[0.08, 0.02, 0.06]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
    </group>
  )
}

export function Cyclist({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  bikeColor = '#cc3333',
  jerseyColor = '#3366cc',
  skinColor = '#deb887',
  animating = false,
  speed = 1,
}) {
  const groupRef = useRef()
  const wheelRotationRef = useRef(0)
  const legAngleRef = useRef(0)

  useFrame((state, delta) => {
    if (animating) {
      wheelRotationRef.current += delta * speed * 10
      legAngleRef.current += delta * speed * 8
    }
  })

  return (
    <group ref={groupRef} position={position} rotation={rotation}>
      {/* Bicycle */}
      <Bicycle
        color={bikeColor}
        wheelRotation={animating ? wheelRotationRef.current : 0}
      />

      {/* Rider body - simplified stick figure style */}
      <group position={[0.1, 0.8, 0]}>
        {/* Torso */}
        <mesh position={[0, 0.2, 0]} rotation={[0.5, 0, 0]}>
          <capsuleGeometry args={[0.08, 0.25, 4, 8]} />
          <meshStandardMaterial color={jerseyColor} />
        </mesh>

        {/* Head */}
        <mesh position={[-0.15, 0.45, 0]}>
          <sphereGeometry args={[0.1, 16, 16]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>

        {/* Helmet */}
        <mesh position={[-0.15, 0.5, 0]}>
          <sphereGeometry args={[0.11, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          <meshStandardMaterial color="#ff6600" />
        </mesh>

        {/* Arms */}
        <mesh position={[-0.2, 0.15, 0.08]} rotation={[0, 0, -0.8]}>
          <capsuleGeometry args={[0.03, 0.2, 4, 8]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
        <mesh position={[-0.2, 0.15, -0.08]} rotation={[0, 0, -0.8]}>
          <capsuleGeometry args={[0.03, 0.2, 4, 8]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>

        {/* Upper legs */}
        <mesh position={[0.05, -0.15, 0.06]} rotation={[0.3, 0, 0.3]}>
          <capsuleGeometry args={[0.04, 0.18, 4, 8]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
        <mesh position={[0.05, -0.15, -0.06]} rotation={[-0.3, 0, 0.3]}>
          <capsuleGeometry args={[0.04, 0.18, 4, 8]} />
          <meshStandardMaterial color="#222222" />
        </mesh>

        {/* Lower legs */}
        <mesh position={[0, -0.35, 0.08]} rotation={[-0.5, 0, 0]}>
          <capsuleGeometry args={[0.03, 0.15, 4, 8]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
        <mesh position={[0, -0.35, -0.08]} rotation={[0.5, 0, 0]}>
          <capsuleGeometry args={[0.03, 0.15, 4, 8]} />
          <meshStandardMaterial color={skinColor} />
        </mesh>
      </group>
    </group>
  )
}

export function CyclistGroup({
  position = [0, 0, 0],
  count = 5,
  spread = 10,
  formation = 'line', // 'line', 'peloton', 'echelon'
}) {
  const cyclists = useMemo(() => {
    const result = []
    const colors = ['#cc3333', '#3366cc', '#33cc33', '#cc33cc', '#cccc33']
    const jerseys = ['#ff0000', '#0066ff', '#00cc00', '#ff00ff', '#ffcc00']

    for (let i = 0; i < count; i++) {
      let x, z
      switch (formation) {
        case 'peloton':
          x = (Math.random() - 0.5) * spread
          z = (Math.random() - 0.5) * spread
          break
        case 'echelon':
          x = i * 1.5
          z = i * 2
          break
        case 'line':
        default:
          x = 0
          z = i * 2
      }

      result.push({
        position: [x, 0, z],
        bikeColor: colors[i % colors.length],
        jerseyColor: jerseys[i % jerseys.length],
      })
    }

    return result
  }, [count, spread, formation])

  return (
    <group position={position}>
      {cyclists.map((c, i) => (
        <Cyclist
          key={i}
          position={c.position}
          bikeColor={c.bikeColor}
          jerseyColor={c.jerseyColor}
        />
      ))}
    </group>
  )
}

export function AnimatedCyclist({
  path = null,
  speed = 5,
  bikeColor = '#cc3333',
  jerseyColor = '#3366cc',
}) {
  const groupRef = useRef()
  const progressRef = useRef(0)

  const defaultPath = useMemo(() => {
    if (path) return path

    // Create a circular path
    const points = []
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * Math.PI * 2
      points.push(new THREE.Vector3(Math.cos(angle) * 20, 0, Math.sin(angle) * 20))
    }
    return new THREE.CatmullRomCurve3(points, true)
  }, [path])

  useFrame((state, delta) => {
    if (!groupRef.current) return

    progressRef.current = (progressRef.current + delta * speed * 0.01) % 1

    const point = defaultPath.getPoint(progressRef.current)
    const tangent = defaultPath.getTangent(progressRef.current)

    groupRef.current.position.copy(point)
    groupRef.current.lookAt(point.clone().add(tangent))
  })

  return (
    <group ref={groupRef}>
      <Cyclist bikeColor={bikeColor} jerseyColor={jerseyColor} animating />
    </group>
  )
}

export default Cyclist
