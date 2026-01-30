import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

export function PineTree({ position = [0, 0, 0], scale = 1, color = '#2d5a27' }) {
  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 1, 0]} castShadow>
        <cylinderGeometry args={[0.15, 0.25, 2, 8]} />
        <meshStandardMaterial color="#5c4033" roughness={0.9} />
      </mesh>

      {/* Foliage layers */}
      <mesh position={[0, 2.5, 0]} castShadow>
        <coneGeometry args={[1.5, 2, 8]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0, 3.5, 0]} castShadow>
        <coneGeometry args={[1.2, 1.8, 8]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
      <mesh position={[0, 4.3, 0]} castShadow>
        <coneGeometry args={[0.8, 1.5, 8]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
    </group>
  )
}

export function DeciduousTree({ position = [0, 0, 0], scale = 1, color = '#3a7d32' }) {
  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.35, 3, 8]} />
        <meshStandardMaterial color="#6b4423" roughness={0.9} />
      </mesh>

      {/* Canopy */}
      <mesh position={[0, 4, 0]} castShadow>
        <icosahedronGeometry args={[2, 1]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
    </group>
  )
}

export function PalmTree({ position = [0, 0, 0], scale = 1 }) {
  const fronds = 7
  const frondAngle = (Math.PI * 2) / fronds

  return (
    <group position={position} scale={scale}>
      {/* Trunk with segments */}
      <mesh position={[0, 3, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.4, 6, 8]} />
        <meshStandardMaterial color="#8b7355" roughness={0.9} />
      </mesh>

      {/* Palm fronds */}
      {Array.from({ length: fronds }).map((_, i) => (
        <group
          key={i}
          position={[0, 6, 0]}
          rotation={[0.3, frondAngle * i, 0.5]}
        >
          <mesh position={[0, 0, 1.5]} rotation={[0.3, 0, 0]} castShadow>
            <boxGeometry args={[0.1, 0.05, 3]} />
            <meshStandardMaterial color="#228b22" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function AutumnTree({ position = [0, 0, 0], scale = 1 }) {
  const colors = ['#ff6b35', '#f7c331', '#cc5500', '#8b4513']
  const randomColor = colors[Math.floor(Math.random() * colors.length)]

  return (
    <group position={position} scale={scale}>
      {/* Trunk */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <cylinderGeometry args={[0.2, 0.35, 3, 8]} />
        <meshStandardMaterial color="#5c4033" roughness={0.9} />
      </mesh>

      {/* Colorful canopy */}
      <mesh position={[0, 4, 0]} castShadow>
        <icosahedronGeometry args={[2, 1]} />
        <meshStandardMaterial color={randomColor} flatShading />
      </mesh>
      <mesh position={[0.5, 3.5, 0.5]} castShadow>
        <icosahedronGeometry args={[1.2, 1]} />
        <meshStandardMaterial
          color={colors[(colors.indexOf(randomColor) + 1) % colors.length]}
          flatShading
        />
      </mesh>
    </group>
  )
}

export function TreeLine({
  treeType = 'pine',
  count = 10,
  spacing = 5,
  position = [0, 0, 0],
  direction = [0, 0, 1],
  randomOffset = 1,
  scaleVariation = 0.3,
}) {
  const TreeComponent = {
    pine: PineTree,
    deciduous: DeciduousTree,
    palm: PalmTree,
    autumn: AutumnTree,
  }[treeType] || PineTree

  const trees = useMemo(() => {
    const dir = new THREE.Vector3(...direction).normalize()
    return Array.from({ length: count }).map((_, i) => ({
      position: [
        position[0] + dir.x * i * spacing + (Math.random() - 0.5) * randomOffset,
        position[1],
        position[2] + dir.z * i * spacing + (Math.random() - 0.5) * randomOffset,
      ],
      scale: 1 - scaleVariation / 2 + Math.random() * scaleVariation,
    }))
  }, [count, spacing, position, direction, randomOffset, scaleVariation])

  return (
    <group>
      {trees.map((tree, i) => (
        <TreeComponent key={i} position={tree.position} scale={tree.scale} />
      ))}
    </group>
  )
}

export function Forest({
  width = 50,
  depth = 50,
  density = 50,
  position = [0, 0, 0],
  treeTypes = ['pine', 'deciduous'],
  clearingRadius = 0,
}) {
  const trees = useMemo(() => {
    const TreeComponents = {
      pine: PineTree,
      deciduous: DeciduousTree,
      palm: PalmTree,
      autumn: AutumnTree,
    }

    return Array.from({ length: density }).map(() => {
      const x = (Math.random() - 0.5) * width
      const z = (Math.random() - 0.5) * depth
      const distFromCenter = Math.sqrt(x * x + z * z)

      if (clearingRadius > 0 && distFromCenter < clearingRadius) {
        return null
      }

      const type = treeTypes[Math.floor(Math.random() * treeTypes.length)]
      return {
        Component: TreeComponents[type],
        position: [x, 0, z],
        scale: 0.7 + Math.random() * 0.6,
      }
    }).filter(Boolean)
  }, [width, depth, density, treeTypes, clearingRadius])

  return (
    <group position={position}>
      {trees.map((tree, i) => (
        <tree.Component key={i} position={tree.position} scale={tree.scale} />
      ))}
    </group>
  )
}

export function SwayingTree({ position = [0, 0, 0], scale = 1, windStrength = 0.1 }) {
  const groupRef = useRef()

  useFrame((state) => {
    if (groupRef.current) {
      const time = state.clock.elapsedTime
      groupRef.current.rotation.z = Math.sin(time * 2 + position[0]) * windStrength
      groupRef.current.rotation.x = Math.sin(time * 1.5 + position[2]) * windStrength * 0.5
    }
  })

  return (
    <group ref={groupRef} position={position} scale={scale}>
      <DeciduousTree />
    </group>
  )
}

export default PineTree
