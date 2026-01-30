import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useControls } from 'leva'

export function Terrain({
  width = 200,
  depth = 200,
  segments = 128,
  maxHeight = 8,
  color = '#4a7c4e',
  roughness = 0.8,
  wireframe = false,
}) {
  const meshRef = useRef()

  const geometry = useMemo(() => {
    const geo = new THREE.PlaneGeometry(width, depth, segments, segments)
    const positions = geo.attributes.position.array

    // Generate terrain using simple noise
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]
      const y = positions[i + 1]

      // Simple procedural height
      const height =
        Math.sin(x * 0.05) * Math.cos(y * 0.05) * maxHeight * 0.5 +
        Math.sin(x * 0.1 + y * 0.1) * maxHeight * 0.3 +
        Math.random() * maxHeight * 0.1

      positions[i + 2] = Math.max(0, height)
    }

    geo.computeVertexNormals()
    return geo
  }, [width, depth, segments, maxHeight])

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      rotation={[-Math.PI / 2, 0, 0]}
      receiveShadow
    >
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        wireframe={wireframe}
        flatShading
      />
    </mesh>
  )
}

export function FlatGround({
  size = 500,
  color = '#3d6b3d',
  textureRepeat = 50,
}) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
      <planeGeometry args={[size, size]} />
      <meshStandardMaterial color={color} roughness={0.9} />
    </mesh>
  )
}

export function GrassField({
  width = 100,
  depth = 100,
  density = 10000,
  grassHeight = 0.5,
  color = '#4a8b4a',
}) {
  const instancedRef = useRef()

  const grassData = useMemo(() => {
    const positions = []
    const scales = []
    const rotations = []

    for (let i = 0; i < density; i++) {
      positions.push([
        (Math.random() - 0.5) * width,
        0,
        (Math.random() - 0.5) * depth,
      ])
      scales.push(0.5 + Math.random() * 0.5)
      rotations.push(Math.random() * Math.PI * 2)
    }

    return { positions, scales, rotations }
  }, [width, depth, density])

  const dummy = useMemo(() => new THREE.Object3D(), [])

  useMemo(() => {
    if (!instancedRef.current) return

    grassData.positions.forEach((pos, i) => {
      dummy.position.set(...pos)
      dummy.scale.setScalar(grassData.scales[i])
      dummy.rotation.y = grassData.rotations[i]
      dummy.updateMatrix()
      instancedRef.current.setMatrixAt(i, dummy.matrix)
    })

    instancedRef.current.instanceMatrix.needsUpdate = true
  }, [grassData, dummy])

  // Animate grass swaying
  useFrame((state) => {
    if (!instancedRef.current) return

    const time = state.clock.elapsedTime

    grassData.positions.forEach((pos, i) => {
      dummy.position.set(...pos)
      dummy.scale.set(
        grassData.scales[i],
        grassData.scales[i] * (1 + Math.sin(time * 2 + pos[0] * 0.5) * 0.1),
        grassData.scales[i]
      )
      dummy.rotation.y = grassData.rotations[i]
      dummy.rotation.z = Math.sin(time * 3 + pos[2] * 0.3) * 0.1
      dummy.updateMatrix()
      instancedRef.current.setMatrixAt(i, dummy.matrix)
    })

    instancedRef.current.instanceMatrix.needsUpdate = true
  })

  return (
    <instancedMesh ref={instancedRef} args={[null, null, density]} castShadow>
      <coneGeometry args={[0.03, grassHeight, 4]} />
      <meshStandardMaterial color={color} flatShading />
    </instancedMesh>
  )
}

export function InteractiveTerrain() {
  const { width, depth, maxHeight, color, wireframe } = useControls('Terrain', {
    width: { value: 200, min: 50, max: 500, step: 10 },
    depth: { value: 200, min: 50, max: 500, step: 10 },
    maxHeight: { value: 8, min: 0, max: 30, step: 1 },
    color: '#4a7c4e',
    wireframe: false,
  })

  return (
    <Terrain
      width={width}
      depth={depth}
      maxHeight={maxHeight}
      color={color}
      wireframe={wireframe}
    />
  )
}

export default Terrain
