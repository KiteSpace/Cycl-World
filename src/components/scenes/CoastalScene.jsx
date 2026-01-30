import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { Sky, Lighting, FlatGround } from '../environment'
import { StraightRoad, BikeLane } from '../objects/Road'
import { PalmTree, TreeLine } from '../objects/Trees'
import { House, SimpleBuilding } from '../objects/Buildings'
import { Cyclist, AnimatedCyclist } from '../objects/Cyclist'

function Ocean({ size = 500, position = [0, -0.5, -100] }) {
  const meshRef = useRef()

  useFrame((state) => {
    if (meshRef.current) {
      const time = state.clock.elapsedTime
      meshRef.current.position.y = -0.5 + Math.sin(time * 0.5) * 0.1
    }
  })

  return (
    <mesh
      ref={meshRef}
      rotation={[-Math.PI / 2, 0, 0]}
      position={position}
      receiveShadow
    >
      <planeGeometry args={[size, size * 2]} />
      <meshStandardMaterial
        color="#0077be"
        transparent
        opacity={0.9}
        metalness={0.3}
        roughness={0.2}
      />
    </mesh>
  )
}

function Beach({ width = 200, depth = 50, position = [0, 0, -25] }) {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={position} receiveShadow>
      <planeGeometry args={[width, depth]} />
      <meshStandardMaterial color="#f4d03f" roughness={0.95} />
    </mesh>
  )
}

function Waves({ count = 20, spread = 100 }) {
  const wavesRef = useRef([])

  const waveData = useMemo(() => {
    return Array.from({ length: count }).map((_, i) => ({
      x: (Math.random() - 0.5) * spread,
      z: -50 - Math.random() * 30,
      speed: 0.5 + Math.random() * 0.5,
      offset: Math.random() * Math.PI * 2,
    }))
  }, [count, spread])

  useFrame((state) => {
    const time = state.clock.elapsedTime
    wavesRef.current.forEach((wave, i) => {
      if (wave) {
        const data = waveData[i]
        wave.position.y = Math.sin(time * data.speed + data.offset) * 0.2
        wave.scale.x = 1 + Math.sin(time * data.speed + data.offset) * 0.3
      }
    })
  })

  return (
    <group>
      {waveData.map((data, i) => (
        <mesh
          key={i}
          ref={(el) => (wavesRef.current[i] = el)}
          position={[data.x, 0, data.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <planeGeometry args={[8, 1]} />
          <meshStandardMaterial color="#ffffff" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

export function CoastalScene({
  timeOfDay = 'day',
  showCyclist = true,
  waveIntensity = 'medium',
}) {
  const isEvening = timeOfDay === 'evening' || timeOfDay === 'sunset'

  return (
    <group>
      {/* Environment */}
      <Sky preset={isEvening ? 'sunset' : 'noon'} showClouds />
      <Lighting preset={isEvening ? 'sunset' : 'day'} />

      {/* Ground - grass area */}
      <FlatGround size={400} color="#5a8a5a" />

      {/* Beach */}
      <Beach width={300} depth={40} position={[0, 0.01, -30]} />

      {/* Ocean */}
      <Ocean size={400} position={[0, -0.3, -150]} />

      {/* Waves */}
      <Waves count={waveIntensity === 'high' ? 30 : waveIntensity === 'low' ? 10 : 20} />

      {/* Coastal road / bike path */}
      <StraightRoad
        length={300}
        width={6}
        position={[0, 0.02, 20]}
        hasMarkings
        hasSidewalk={false}
      />

      {/* Bike path along the coast */}
      <BikeLane
        length={300}
        width={2.5}
        position={[0, 0.03, 5]}
        color="#cc6633"
      />

      {/* Palm trees */}
      <TreeLine
        treeType="palm"
        count={15}
        spacing={15}
        position={[-10, 0, 30]}
        direction={[1, 0, 0]}
        randomOffset={3}
      />

      {/* Beach houses */}
      <House position={[-60, 0, 50]} wallColor="#ffffff" roofColor="#ff6b35" />
      <House position={[70, 0, 55]} wallColor="#e8f4f8" roofColor="#4a90a4" />
      <House position={[0, 0, 60]} wallColor="#fff8dc" roofColor="#cd853f" />

      {/* Lifeguard tower */}
      <group position={[-30, 0, -10]}>
        <mesh position={[0, 2, 0]}>
          <boxGeometry args={[3, 4, 3]} />
          <meshStandardMaterial color="#ff6b35" />
        </mesh>
        <mesh position={[0, 4.5, 0]}>
          <boxGeometry args={[4, 1, 4]} />
          <meshStandardMaterial color="#8b4513" />
        </mesh>
        {/* Legs */}
        <mesh position={[-1, 0.5, -1]}>
          <boxGeometry args={[0.3, 3, 0.3]} />
          <meshStandardMaterial color="#deb887" />
        </mesh>
        <mesh position={[1, 0.5, -1]}>
          <boxGeometry args={[0.3, 3, 0.3]} />
          <meshStandardMaterial color="#deb887" />
        </mesh>
        <mesh position={[-1, 0.5, 1]}>
          <boxGeometry args={[0.3, 3, 0.3]} />
          <meshStandardMaterial color="#deb887" />
        </mesh>
        <mesh position={[1, 0.5, 1]}>
          <boxGeometry args={[0.3, 3, 0.3]} />
          <meshStandardMaterial color="#deb887" />
        </mesh>
      </group>

      {/* Cyclist */}
      {showCyclist && (
        <Cyclist
          position={[0, 0, 7]}
          rotation={[0, Math.PI / 2, 0]}
          bikeColor="#ff6b35"
          jerseyColor="#00bcd4"
        />
      )}
    </group>
  )
}

export function SunsetBeachRide() {
  return (
    <group>
      <Sky preset="sunset" showClouds />
      <Lighting preset="sunset" intensity={0.8} />

      <fog attach="fog" args={['#ffaa66', 50, 250]} />

      <FlatGround size={400} color="#6a8a5a" />

      {/* Beach and ocean */}
      <Beach width={400} depth={60} position={[0, 0.01, -40]} />
      <Ocean size={500} position={[0, -0.2, -200]} />

      {/* Coastal bike path */}
      <BikeLane length={400} width={3} position={[0, 0.02, -5]} color="#8b7355" />

      {/* Silhouette palm trees */}
      <TreeLine
        treeType="palm"
        count={20}
        spacing={18}
        position={[-180, 0, 10]}
        direction={[1, 0, 0]}
      />

      {/* Animated cyclist silhouette */}
      <AnimatedCyclist
        speed={6}
        bikeColor="#1a1a1a"
        jerseyColor="#2a2a2a"
      />
    </group>
  )
}

export function TropicalIslandRide() {
  return (
    <group>
      <Sky preset="noon" showClouds />
      <Lighting preset="day" intensity={1.3} />

      {/* Vibrant green ground */}
      <FlatGround size={300} color="#2ecc71" />

      {/* Surrounding ocean */}
      <Ocean size={600} position={[0, -0.5, 0]} />

      {/* Beach ring around island */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[100, 120, 64]} />
        <meshStandardMaterial color="#f4d03f" />
      </mesh>

      {/* Circular coastal road */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.03, 0]}>
        <ringGeometry args={[70, 76, 64]} />
        <meshStandardMaterial color="#555555" />
      </mesh>

      {/* Palm trees scattered around */}
      {Array.from({ length: 30 }).map((_, i) => {
        const angle = (i / 30) * Math.PI * 2
        const radius = 50 + Math.random() * 30
        return (
          <PalmTree
            key={i}
            position={[Math.cos(angle) * radius, 0, Math.sin(angle) * radius]}
            scale={0.8 + Math.random() * 0.4}
          />
        )
      })}

      {/* Central resort building */}
      <SimpleBuilding
        position={[0, 0, 0]}
        width={15}
        depth={15}
        height={8}
        color="#ffffff"
      />

      {/* Animated cyclist on circular path */}
      <AnimatedCyclist
        speed={4}
        bikeColor="#ff6b35"
        jerseyColor="#00bcd4"
      />
    </group>
  )
}

export default CoastalScene
