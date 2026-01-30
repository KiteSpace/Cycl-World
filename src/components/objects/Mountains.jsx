import { useMemo } from 'react'
import * as THREE from 'three'

export function Mountain({
  position = [0, 0, 0],
  radius = 30,
  height = 50,
  segments = 16,
  color = '#6b7b6b',
  snowCapHeight = 0.7,
  hasSnowCap = true,
}) {
  return (
    <group position={position}>
      {/* Main mountain body */}
      <mesh castShadow receiveShadow>
        <coneGeometry args={[radius, height, segments]} />
        <meshStandardMaterial color={color} flatShading roughness={0.9} />
      </mesh>

      {/* Snow cap */}
      {hasSnowCap && (
        <mesh position={[0, height * snowCapHeight, 0]} castShadow>
          <coneGeometry
            args={[radius * (1 - snowCapHeight), height * (1 - snowCapHeight), segments]}
          />
          <meshStandardMaterial color="#ffffff" flatShading roughness={0.8} />
        </mesh>
      )}
    </group>
  )
}

export function MountainRange({
  position = [0, 0, 0],
  count = 5,
  spread = 200,
  minHeight = 30,
  maxHeight = 80,
  baseColor = '#6b7b6b',
}) {
  const mountains = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => {
      const x = (i - count / 2) * (spread / count) + (Math.random() - 0.5) * 30
      const z = (Math.random() - 0.5) * 40
      const height = minHeight + Math.random() * (maxHeight - minHeight)
      const radius = height * 0.4 + Math.random() * height * 0.2

      // Vary the color slightly
      const colorVariation = Math.random() * 0.1 - 0.05
      const color = new THREE.Color(baseColor)
      color.offsetHSL(0, 0, colorVariation)

      return {
        position: [x, height / 2, z],
        height,
        radius,
        color: `#${color.getHexString()}`,
        hasSnowCap: height > (minHeight + maxHeight) / 2,
      }
    })
  }, [count, spread, minHeight, maxHeight, baseColor])

  return (
    <group position={position}>
      {mountains.map((m, i) => (
        <Mountain
          key={i}
          position={m.position}
          height={m.height}
          radius={m.radius}
          color={m.color}
          hasSnowCap={m.hasSnowCap}
        />
      ))}
    </group>
  )
}

export function RockyMountain({
  position = [0, 0, 0],
  size = 50,
  roughness = 0.5,
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.IcosahedronGeometry(size, 2)
    const positions = geo.attributes.position.array

    // Deform vertices to create rocky appearance
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const y = positions[i + 1]
      const z = positions[i + 2]

      // Only deform upper portion
      if (y > 0) {
        const noise =
          Math.sin(x * 0.1) * Math.cos(z * 0.1) * roughness * size * 0.3
        positions[i] += (Math.random() - 0.5) * roughness * 10
        positions[i + 1] = Math.abs(y) * 1.5 + noise // Stretch upward
        positions[i + 2] += (Math.random() - 0.5) * roughness * 10
      } else {
        // Flatten bottom
        positions[i + 1] = 0
      }
    }

    geo.computeVertexNormals()
    return geo
  }, [size, roughness])

  return (
    <group position={position}>
      <mesh geometry={geometry} castShadow receiveShadow>
        <meshStandardMaterial color="#5a6b5a" flatShading roughness={0.95} />
      </mesh>
    </group>
  )
}

export function Cliff({
  position = [0, 0, 0],
  width = 30,
  height = 40,
  depth = 10,
  color = '#7a6b5a',
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BoxGeometry(width, height, depth, 8, 16, 4)
    const positions = geo.attributes.position.array

    // Add rocky texture to front face
    for (let i = 0; i < positions.length; i += 3) {
      const z = positions[i + 2]
      if (z > depth / 2 - 1) {
        positions[i] += (Math.random() - 0.5) * 2
        positions[i + 1] += (Math.random() - 0.5) * 2
        positions[i + 2] += Math.random() * 2
      }
    }

    geo.computeVertexNormals()
    return geo
  }, [width, height, depth])

  return (
    <group position={position}>
      <mesh geometry={geometry} position={[0, height / 2, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={color} flatShading roughness={0.95} />
      </mesh>
    </group>
  )
}

export function Hill({
  position = [0, 0, 0],
  radius = 20,
  height = 10,
  color = '#4a8b4a',
}) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <sphereGeometry args={[radius, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={color} flatShading />
      </mesh>
    </group>
  )
}

export function Valley({
  position = [0, 0, 0],
  width = 100,
  length = 200,
  wallHeight = 50,
}) {
  return (
    <group position={position}>
      {/* Left mountain wall */}
      <MountainRange
        position={[-width / 2 - 30, 0, 0]}
        count={8}
        spread={length}
        minHeight={wallHeight * 0.7}
        maxHeight={wallHeight * 1.3}
      />

      {/* Right mountain wall */}
      <MountainRange
        position={[width / 2 + 30, 0, 0]}
        count={8}
        spread={length}
        minHeight={wallHeight * 0.7}
        maxHeight={wallHeight * 1.3}
      />

      {/* Valley floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color="#5a8a5a" />
      </mesh>
    </group>
  )
}

export function AlpineScene({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {/* Background mountains */}
      <MountainRange
        position={[0, 0, -150]}
        count={7}
        spread={400}
        minHeight={60}
        maxHeight={120}
        baseColor="#5a6a7a"
      />

      {/* Mid-ground mountains */}
      <MountainRange
        position={[0, 0, -80]}
        count={5}
        spread={300}
        minHeight={40}
        maxHeight={70}
        baseColor="#6a7a6a"
      />

      {/* Foreground hills */}
      <Hill position={[-50, 0, -20]} radius={25} height={15} />
      <Hill position={[60, 0, -30]} radius={30} height={12} />
      <Hill position={[0, 0, -40]} radius={20} height={8} />
    </group>
  )
}

export default Mountain
