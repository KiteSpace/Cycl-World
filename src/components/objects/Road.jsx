import { useRef, useMemo } from 'react'
import * as THREE from 'three'
import { useControls } from 'leva'

export function StraightRoad({
  length = 100,
  width = 8,
  position = [0, 0.01, 0],
  rotation = [0, 0, 0],
  lanes = 2,
  hasMarkings = true,
  hasSidewalk = true,
}) {
  const roadColor = '#333333'
  const markingColor = '#ffffff'
  const sidewalkColor = '#888888'

  return (
    <group position={position} rotation={rotation}>
      {/* Main road surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color={roadColor} roughness={0.9} />
      </mesh>

      {/* Road markings */}
      {hasMarkings && (
        <group>
          {/* Center line (dashed) */}
          {Array.from({ length: Math.floor(length / 4) }).map((_, i) => (
            <mesh
              key={`center-${i}`}
              position={[0, 0.02, -length / 2 + i * 4 + 1]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <planeGeometry args={[0.15, 2]} />
              <meshStandardMaterial color={markingColor} />
            </mesh>
          ))}

          {/* Edge lines (solid) */}
          <mesh
            position={[-width / 2 + 0.3, 0.02, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.15, length]} />
            <meshStandardMaterial color={markingColor} />
          </mesh>
          <mesh
            position={[width / 2 - 0.3, 0.02, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          >
            <planeGeometry args={[0.15, length]} />
            <meshStandardMaterial color={markingColor} />
          </mesh>
        </group>
      )}

      {/* Sidewalks */}
      {hasSidewalk && (
        <group>
          <mesh
            position={[-width / 2 - 1, 0.05, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[2, length]} />
            <meshStandardMaterial color={sidewalkColor} roughness={0.95} />
          </mesh>
          <mesh
            position={[width / 2 + 1, 0.05, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            receiveShadow
          >
            <planeGeometry args={[2, length]} />
            <meshStandardMaterial color={sidewalkColor} roughness={0.95} />
          </mesh>
        </group>
      )}
    </group>
  )
}

export function CurvedRoad({
  radius = 20,
  angle = Math.PI / 2,
  width = 8,
  position = [0, 0.01, 0],
  segments = 32,
}) {
  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(radius - width / 2, 0)
    shape.absarc(0, 0, radius - width / 2, 0, angle, false)
    shape.lineTo(
      Math.cos(angle) * (radius + width / 2),
      Math.sin(angle) * (radius + width / 2)
    )
    shape.absarc(0, 0, radius + width / 2, angle, 0, true)
    shape.closePath()

    const geo = new THREE.ShapeGeometry(shape, segments)
    geo.rotateX(-Math.PI / 2)
    return geo
  }, [radius, angle, width, segments])

  return (
    <mesh geometry={geometry} position={position} receiveShadow>
      <meshStandardMaterial color="#333333" roughness={0.9} />
    </mesh>
  )
}

export function BikeLane({
  length = 100,
  width = 1.5,
  position = [0, 0.02, 0],
  color = '#2d5a27',
}) {
  return (
    <group position={position}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width, length]} />
        <meshStandardMaterial color={color} roughness={0.85} />
      </mesh>

      {/* Bike symbols */}
      {Array.from({ length: Math.floor(length / 20) }).map((_, i) => (
        <group key={i} position={[0, 0.01, -length / 2 + i * 20 + 5]}>
          {/* Simple bike icon using basic shapes */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.25, 0.35, 16]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          <mesh position={[0.7, 0, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.25, 0.35, 16]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

export function MountainRoad({
  points = [],
  width = 6,
  hasGuardrails = true,
}) {
  const defaultPoints = useMemo(() => {
    if (points.length > 0) return points

    // Generate a winding mountain road
    const pts = []
    for (let i = 0; i <= 100; i++) {
      const t = i / 100
      const x = Math.sin(t * Math.PI * 3) * 30
      const y = t * 20 // Elevation gain
      const z = t * 200 - 100
      pts.push(new THREE.Vector3(x, y, z))
    }
    return pts
  }, [points])

  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(defaultPoints),
    [defaultPoints]
  )

  const geometry = useMemo(() => {
    const shape = new THREE.Shape()
    shape.moveTo(-width / 2, 0)
    shape.lineTo(width / 2, 0)
    shape.lineTo(width / 2, 0.1)
    shape.lineTo(-width / 2, 0.1)
    shape.closePath()

    const extrudeSettings = {
      steps: 200,
      bevelEnabled: false,
      extrudePath: curve,
    }

    return new THREE.ExtrudeGeometry(shape, extrudeSettings)
  }, [curve, width])

  return (
    <group>
      <mesh geometry={geometry} receiveShadow castShadow>
        <meshStandardMaterial color="#444444" roughness={0.9} />
      </mesh>

      {hasGuardrails && (
        <group>
          {/* Guardrails would be added here along the curve */}
        </group>
      )}
    </group>
  )
}

export function InteractiveRoad() {
  const { length, width, hasMarkings, hasSidewalk } = useControls('Road', {
    length: { value: 100, min: 20, max: 500, step: 10 },
    width: { value: 8, min: 4, max: 16, step: 1 },
    hasMarkings: true,
    hasSidewalk: true,
  })

  return (
    <StraightRoad
      length={length}
      width={width}
      hasMarkings={hasMarkings}
      hasSidewalk={hasSidewalk}
    />
  )
}

export default StraightRoad
