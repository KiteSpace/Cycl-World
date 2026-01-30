import { useMemo } from 'react'
import * as THREE from 'three'

export function SimpleBuilding({
  position = [0, 0, 0],
  width = 10,
  depth = 10,
  height = 20,
  color = '#8899aa',
  windowColor = '#334455',
  hasWindows = true,
}) {
  const windowRows = Math.floor(height / 3)
  const windowCols = Math.floor(width / 2.5)

  return (
    <group position={position}>
      {/* Main building */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.7} />
      </mesh>

      {/* Windows - front face */}
      {hasWindows &&
        Array.from({ length: windowRows }).map((_, row) =>
          Array.from({ length: windowCols }).map((_, col) => (
            <mesh
              key={`front-${row}-${col}`}
              position={[
                -width / 2 + 1.5 + col * 2.5,
                2 + row * 3,
                depth / 2 + 0.01,
              ]}
            >
              <planeGeometry args={[1.5, 2]} />
              <meshStandardMaterial
                color={windowColor}
                emissive={windowColor}
                emissiveIntensity={0.2}
              />
            </mesh>
          ))
        )}

      {/* Roof */}
      <mesh position={[0, height + 0.25, 0]} castShadow>
        <boxGeometry args={[width + 0.5, 0.5, depth + 0.5]} />
        <meshStandardMaterial color="#556677" roughness={0.8} />
      </mesh>
    </group>
  )
}

export function OfficeBuilding({
  position = [0, 0, 0],
  width = 15,
  depth = 15,
  floors = 10,
  floorHeight = 3.5,
  glassColor = '#6699cc',
}) {
  const height = floors * floorHeight

  return (
    <group position={position}>
      {/* Glass facade */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial
          color={glassColor}
          metalness={0.9}
          roughness={0.1}
          envMapIntensity={1}
        />
      </mesh>

      {/* Floor lines */}
      {Array.from({ length: floors }).map((_, i) => (
        <mesh
          key={i}
          position={[0, (i + 1) * floorHeight, depth / 2 + 0.01]}
        >
          <planeGeometry args={[width, 0.1]} />
          <meshStandardMaterial color="#ffffff" metalness={0.8} />
        </mesh>
      ))}

      {/* Roof structure */}
      <mesh position={[0, height + 1, 0]} castShadow>
        <boxGeometry args={[width * 0.3, 2, depth * 0.3]} />
        <meshStandardMaterial color="#445566" />
      </mesh>
    </group>
  )
}

export function House({
  position = [0, 0, 0],
  width = 8,
  depth = 10,
  wallHeight = 4,
  roofHeight = 3,
  wallColor = '#f5deb3',
  roofColor = '#8b4513',
}) {
  return (
    <group position={position}>
      {/* Walls */}
      <mesh position={[0, wallHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, wallHeight, depth]} />
        <meshStandardMaterial color={wallColor} roughness={0.9} />
      </mesh>

      {/* Pitched roof */}
      <mesh
        position={[0, wallHeight + roofHeight / 2, 0]}
        rotation={[0, Math.PI / 2, 0]}
        castShadow
      >
        <cylinderGeometry args={[0.1, depth / 1.5, width + 1, 4, 1, false, Math.PI / 4]} />
        <meshStandardMaterial color={roofColor} flatShading />
      </mesh>

      {/* Simple triangular roof */}
      <mesh position={[0, wallHeight, 0]} castShadow>
        <boxGeometry args={[width + 0.5, 0.2, depth + 0.5]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>

      {/* Door */}
      <mesh position={[0, 1.2, depth / 2 + 0.01]}>
        <planeGeometry args={[1.2, 2.4]} />
        <meshStandardMaterial color="#5c4033" />
      </mesh>

      {/* Windows */}
      <mesh position={[-2, 2.5, depth / 2 + 0.01]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial color="#87ceeb" metalness={0.5} />
      </mesh>
      <mesh position={[2, 2.5, depth / 2 + 0.01]}>
        <planeGeometry args={[1.5, 1.5]} />
        <meshStandardMaterial color="#87ceeb" metalness={0.5} />
      </mesh>
    </group>
  )
}

export function Warehouse({
  position = [0, 0, 0],
  width = 30,
  depth = 50,
  height = 12,
  color = '#778899',
}) {
  return (
    <group position={position}>
      {/* Main structure */}
      <mesh position={[0, height / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[width, height, depth]} />
        <meshStandardMaterial color={color} roughness={0.8} />
      </mesh>

      {/* Corrugated roof */}
      <mesh position={[0, height + 0.5, 0]} castShadow>
        <boxGeometry args={[width + 1, 1, depth + 1]} />
        <meshStandardMaterial color="#667788" roughness={0.6} metalness={0.3} />
      </mesh>

      {/* Large doors */}
      <mesh position={[0, 3, depth / 2 + 0.01]}>
        <planeGeometry args={[8, 6]} />
        <meshStandardMaterial color="#445566" />
      </mesh>

      {/* Loading dock */}
      <mesh position={[0, 0.5, depth / 2 + 2]} receiveShadow>
        <boxGeometry args={[12, 1, 4]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
    </group>
  )
}

export function CityBlock({
  position = [0, 0, 0],
  buildingCount = 5,
  blockWidth = 50,
  blockDepth = 50,
  minHeight = 10,
  maxHeight = 40,
}) {
  const buildings = useMemo(() => {
    const result = []
    const gridSize = Math.ceil(Math.sqrt(buildingCount))
    const cellWidth = blockWidth / gridSize
    const cellDepth = blockDepth / gridSize

    for (let i = 0; i < buildingCount; i++) {
      const row = Math.floor(i / gridSize)
      const col = i % gridSize

      const x = -blockWidth / 2 + cellWidth / 2 + col * cellWidth
      const z = -blockDepth / 2 + cellDepth / 2 + row * cellDepth

      const width = cellWidth * 0.6 + Math.random() * cellWidth * 0.2
      const depth = cellDepth * 0.6 + Math.random() * cellDepth * 0.2
      const height = minHeight + Math.random() * (maxHeight - minHeight)

      const colors = ['#8899aa', '#778899', '#99aabb', '#aabbcc', '#667788']
      const color = colors[Math.floor(Math.random() * colors.length)]

      result.push({ x, z, width, depth, height, color })
    }

    return result
  }, [buildingCount, blockWidth, blockDepth, minHeight, maxHeight])

  return (
    <group position={position}>
      {buildings.map((b, i) => (
        <SimpleBuilding
          key={i}
          position={[b.x, 0, b.z]}
          width={b.width}
          depth={b.depth}
          height={b.height}
          color={b.color}
        />
      ))}
    </group>
  )
}

export function BikeShop({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      {/* Main building */}
      <mesh position={[0, 3, 0]} castShadow receiveShadow>
        <boxGeometry args={[12, 6, 8]} />
        <meshStandardMaterial color="#e8e0d5" roughness={0.9} />
      </mesh>

      {/* Storefront window */}
      <mesh position={[0, 2.5, 4.01]}>
        <planeGeometry args={[8, 4]} />
        <meshStandardMaterial
          color="#87ceeb"
          metalness={0.7}
          roughness={0.1}
          transparent
          opacity={0.8}
        />
      </mesh>

      {/* Sign */}
      <mesh position={[0, 5.5, 4.1]}>
        <boxGeometry args={[6, 1, 0.2]} />
        <meshStandardMaterial color="#cc3333" />
      </mesh>

      {/* Awning */}
      <mesh position={[0, 4.8, 5]} rotation={[0.3, 0, 0]}>
        <boxGeometry args={[10, 0.1, 2]} />
        <meshStandardMaterial color="#3366cc" />
      </mesh>

      {/* Bike rack outside */}
      <group position={[5, 0.4, 5]}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.4, 0.05, 8, 16, Math.PI]} />
          <meshStandardMaterial color="#888888" metalness={0.8} />
        </mesh>
      </group>
    </group>
  )
}

export default SimpleBuilding
