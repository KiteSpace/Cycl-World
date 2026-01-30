import { useMemo } from 'react'
import * as THREE from 'three'
import { useControls } from 'leva'

export function VelodromTrack({
  length = 250,
  width = 7,
  bankingAngle = 45,
  position = [0, 0, 0],
}) {
  // Standard velodrome is an oval
  const straightLength = length * 0.4
  const curveRadius = (length - 2 * straightLength) / Math.PI / 2

  return (
    <group position={position}>
      {/* Track surface - simplified representation */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[curveRadius, curveRadius + width, 64, 1, 0, Math.PI * 2]} />
        <meshStandardMaterial color="#d4a574" roughness={0.7} />
      </mesh>

      {/* Inner rail */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[curveRadius - 0.1, curveRadius, 64]} />
        <meshStandardMaterial color="#1a1a1a" />
      </mesh>

      {/* Lane markings */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[curveRadius + 0.85, curveRadius + 0.95, 64]} />
        <meshStandardMaterial color="#000000" />
      </mesh>

      {/* Sprinters line (red) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[curveRadius + 2.45, curveRadius + 2.55, 64]} />
        <meshStandardMaterial color="#cc0000" />
      </mesh>

      {/* Stayers line (blue) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <ringGeometry args={[curveRadius + 5.2, curveRadius + 5.3, 64]} />
        <meshStandardMaterial color="#0000cc" />
      </mesh>
    </group>
  )
}

export function OutdoorTrack({
  length = 400,
  lanes = 8,
  laneWidth = 1.22,
  position = [0, 0.01, 0],
}) {
  const straightLength = length * 0.4 / 2
  const curveRadius = (length - 2 * straightLength * 2) / Math.PI / 2
  const totalWidth = lanes * laneWidth

  return (
    <group position={position}>
      {/* Track surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry args={[curveRadius, curveRadius + totalWidth, 64]} />
        <meshStandardMaterial color="#c4533b" roughness={0.8} />
      </mesh>

      {/* Lane markings */}
      {Array.from({ length: lanes + 1 }).map((_, i) => (
        <mesh
          key={i}
          rotation={[-Math.PI / 2, 0, 0]}
          position={[0, 0.01, 0]}
        >
          <ringGeometry
            args={[
              curveRadius + i * laneWidth - 0.025,
              curveRadius + i * laneWidth + 0.025,
              64,
            ]}
          />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}

      {/* Inner field (grass) */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <circleGeometry args={[curveRadius - 2, 64]} />
        <meshStandardMaterial color="#4a8b4a" />
      </mesh>
    </group>
  )
}

export function MountainBikeTrail({
  pathPoints = null,
  width = 2,
  difficulty = 'intermediate',
}) {
  const difficultyColors = {
    beginner: '#4a9f4a',
    intermediate: '#4a7ab8',
    advanced: '#1a1a1a',
    expert: '#8b4a8b',
  }

  const defaultPath = useMemo(() => {
    if (pathPoints) return pathPoints

    // Generate a winding trail
    const points = []
    for (let i = 0; i <= 50; i++) {
      const t = i / 50
      points.push(
        new THREE.Vector3(
          Math.sin(t * Math.PI * 4) * 15 + Math.sin(t * Math.PI * 7) * 5,
          Math.sin(t * Math.PI * 2) * 3,
          t * 100 - 50
        )
      )
    }
    return points
  }, [pathPoints])

  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(defaultPath),
    [defaultPath]
  )

  const tubeGeometry = useMemo(() => {
    return new THREE.TubeGeometry(curve, 100, width / 2, 8, false)
  }, [curve, width])

  return (
    <group>
      <mesh geometry={tubeGeometry} receiveShadow>
        <meshStandardMaterial
          color={difficultyColors[difficulty] || difficultyColors.intermediate}
          roughness={0.95}
          flatShading
        />
      </mesh>

      {/* Trail markers */}
      {[0, 0.25, 0.5, 0.75, 1].map((t, i) => {
        const point = curve.getPoint(t)
        return (
          <mesh key={i} position={[point.x - 2, point.y + 0.5, point.z]}>
            <boxGeometry args={[0.2, 1, 0.2]} />
            <meshStandardMaterial
              color={difficultyColors[difficulty] || '#4a7ab8'}
            />
          </mesh>
        )
      })}
    </group>
  )
}

export function CriteriumCourse({
  corners = 4,
  straightLength = 50,
  cornerRadius = 15,
  width = 8,
}) {
  const segments = useMemo(() => {
    const segs = []

    for (let i = 0; i < corners; i++) {
      const angle = (i / corners) * Math.PI * 2
      const nextAngle = ((i + 1) / corners) * Math.PI * 2

      // Corner position
      const cx = Math.cos(angle) * (straightLength + cornerRadius)
      const cz = Math.sin(angle) * (straightLength + cornerRadius)

      segs.push({
        type: 'corner',
        position: [cx, 0, cz],
        rotation: angle,
      })
    }

    return segs
  }, [corners, straightLength, cornerRadius])

  return (
    <group>
      {/* Simplified course representation */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <ringGeometry
          args={[straightLength, straightLength + width, corners * 8, 1]}
        />
        <meshStandardMaterial color="#333333" roughness={0.9} />
      </mesh>

      {/* Corner markers */}
      {segments.map((seg, i) => (
        <mesh key={i} position={[seg.position[0], 0.5, seg.position[2]]}>
          <coneGeometry args={[0.5, 1, 4]} />
          <meshStandardMaterial color="#ff6600" />
        </mesh>
      ))}
    </group>
  )
}

export function InteractiveTrack() {
  const { trackType, length } = useControls('Track', {
    trackType: {
      value: 'velodrome',
      options: ['velodrome', 'outdoor', 'criterium'],
    },
    length: { value: 250, min: 100, max: 500, step: 10 },
  })

  switch (trackType) {
    case 'velodrome':
      return <VelodromTrack length={length} />
    case 'outdoor':
      return <OutdoorTrack length={length} />
    case 'criterium':
      return <CriteriumCourse straightLength={length / 4} />
    default:
      return <VelodromTrack length={length} />
  }
}

export default VelodromTrack
