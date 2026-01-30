import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Sky, Lighting } from '../environment'
import { VelodromTrack, OutdoorTrack } from '../objects/CyclingTrack'
import { Cyclist, CyclistGroup, AnimatedCyclist } from '../objects/Cyclist'

export function VelodromeScene({
  trackLength = 250,
  isIndoor = true,
  showRacers = true,
  racerCount = 4,
}) {
  return (
    <group>
      {/* Lighting - indoor has different lighting */}
      {isIndoor ? (
        <group>
          {/* Indoor lighting rig */}
          <ambientLight intensity={0.6} color="#ffffff" />
          <pointLight position={[0, 30, 0]} intensity={2} distance={100} />
          <pointLight position={[-30, 25, -30]} intensity={1} distance={80} />
          <pointLight position={[30, 25, 30]} intensity={1} distance={80} />
          <pointLight position={[-30, 25, 30]} intensity={1} distance={80} />
          <pointLight position={[30, 25, -30]} intensity={1} distance={80} />
        </group>
      ) : (
        <group>
          <Sky preset="noon" />
          <Lighting preset="day" />
        </group>
      )}

      {/* Velodrome structure */}
      {isIndoor && (
        <group>
          {/* Roof/ceiling */}
          <mesh position={[0, 35, 0]}>
            <boxGeometry args={[120, 2, 120]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>

          {/* Walls */}
          <mesh position={[0, 17, -60]}>
            <boxGeometry args={[120, 36, 2]} />
            <meshStandardMaterial color="#3a3a3a" />
          </mesh>
          <mesh position={[0, 17, 60]}>
            <boxGeometry args={[120, 36, 2]} />
            <meshStandardMaterial color="#3a3a3a" />
          </mesh>
          <mesh position={[-60, 17, 0]}>
            <boxGeometry args={[2, 36, 120]} />
            <meshStandardMaterial color="#3a3a3a" />
          </mesh>
          <mesh position={[60, 17, 0]}>
            <boxGeometry args={[2, 36, 120]} />
            <meshStandardMaterial color="#3a3a3a" />
          </mesh>

          {/* Floor outside track */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
            <planeGeometry args={[120, 120]} />
            <meshStandardMaterial color="#1a1a1a" />
          </mesh>

          {/* Spectator stands (simplified) */}
          <mesh position={[0, 5, -45]} rotation={[0.3, 0, 0]}>
            <boxGeometry args={[80, 2, 20]} />
            <meshStandardMaterial color="#4a4a4a" />
          </mesh>
          <mesh position={[0, 5, 45]} rotation={[-0.3, 0, 0]}>
            <boxGeometry args={[80, 2, 20]} />
            <meshStandardMaterial color="#4a4a4a" />
          </mesh>
        </group>
      )}

      {/* The track */}
      <VelodromTrack length={trackLength} width={7} bankingAngle={45} />

      {/* Racers on track */}
      {showRacers && (
        <group>
          {Array.from({ length: racerCount }).map((_, i) => {
            const angle = (i / racerCount) * Math.PI * 2
            const radius = 25 + i * 1.5
            return (
              <Cyclist
                key={i}
                position={[
                  Math.cos(angle) * radius,
                  0.5,
                  Math.sin(angle) * radius,
                ]}
                rotation={[0, -angle + Math.PI / 2, 0]}
                bikeColor={['#cc3333', '#3366cc', '#33cc33', '#cccc33'][i % 4]}
                jerseyColor={['#ff0000', '#0000ff', '#00ff00', '#ffff00'][i % 4]}
              />
            )
          })}
        </group>
      )}
    </group>
  )
}

export function OutdoorTrackScene({
  trackLength = 400,
  lanes = 8,
  showAthletes = true,
}) {
  return (
    <group>
      <Sky preset="noon" showClouds />
      <Lighting preset="day" intensity={1.2} />

      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#4a8b4a" />
      </mesh>

      {/* Track */}
      <OutdoorTrack length={trackLength} lanes={lanes} />

      {/* Stadium structure (simplified) */}
      <group>
        {/* Main grandstand */}
        <mesh position={[0, 8, -60]} rotation={[0.2, 0, 0]}>
          <boxGeometry args={[100, 20, 30]} />
          <meshStandardMaterial color="#cccccc" />
        </mesh>

        {/* Side stands */}
        <mesh position={[-70, 5, 0]} rotation={[0, 0, -0.2]}>
          <boxGeometry args={[20, 15, 80]} />
          <meshStandardMaterial color="#bbbbbb" />
        </mesh>
        <mesh position={[70, 5, 0]} rotation={[0, 0, 0.2]}>
          <boxGeometry args={[20, 15, 80]} />
          <meshStandardMaterial color="#bbbbbb" />
        </mesh>
      </group>

      {/* Athletes */}
      {showAthletes && (
        <CyclistGroup
          position={[0, 0, -30]}
          count={lanes}
          formation="line"
        />
      )}
    </group>
  )
}

export function TrackSprintScene() {
  const cyclist1Ref = useRef()
  const cyclist2Ref = useRef()

  useFrame((state) => {
    const time = state.clock.elapsedTime
    const angle1 = time * 0.5
    const angle2 = time * 0.5 + 0.3

    if (cyclist1Ref.current) {
      cyclist1Ref.current.position.x = Math.cos(angle1) * 25
      cyclist1Ref.current.position.z = Math.sin(angle1) * 25
      cyclist1Ref.current.rotation.y = -angle1 + Math.PI / 2
    }

    if (cyclist2Ref.current) {
      cyclist2Ref.current.position.x = Math.cos(angle2) * 27
      cyclist2Ref.current.position.z = Math.sin(angle2) * 27
      cyclist2Ref.current.rotation.y = -angle2 + Math.PI / 2
    }
  })

  return (
    <group>
      <ambientLight intensity={0.5} />
      <pointLight position={[0, 30, 0]} intensity={2} />

      {/* Indoor velodrome */}
      <VelodromTrack length={250} width={7} />

      {/* Two sprinting cyclists */}
      <group ref={cyclist1Ref}>
        <Cyclist bikeColor="#cc3333" jerseyColor="#ff0000" animating />
      </group>
      <group ref={cyclist2Ref}>
        <Cyclist bikeColor="#3366cc" jerseyColor="#0000ff" animating />
      </group>

      {/* Indoor structure */}
      <mesh position={[0, 30, 0]}>
        <boxGeometry args={[100, 2, 100]} />
        <meshStandardMaterial color="#2a2a2a" />
      </mesh>
    </group>
  )
}

export default VelodromeScene
