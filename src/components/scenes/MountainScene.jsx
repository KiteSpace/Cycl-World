import { Sky, Lighting, Terrain, FlatGround } from '../environment'
import {
  MountainRange,
  AlpineScene,
  Hill,
} from '../objects/Mountains'
import { MountainRoad, StraightRoad } from '../objects/Road'
import { Forest, PineTree, TreeLine } from '../objects/Trees'
import { Cyclist, AnimatedCyclist } from '../objects/Cyclist'

export function MountainScene({
  timeOfDay = 'day',
  showCyclist = true,
  animateCyclist = false,
  fogEnabled = true,
  fogColor = '#a8c4d4',
  fogNear = 50,
  fogFar = 300,
}) {
  return (
    <group>
      {/* Environment */}
      <Sky preset={timeOfDay === 'night' ? 'night' : timeOfDay === 'evening' ? 'sunset' : 'noon'} />
      <Lighting preset={timeOfDay === 'evening' ? 'sunset' : timeOfDay === 'night' ? 'night' : 'day'} />

      {/* Fog for depth */}
      {fogEnabled && <fog attach="fog" args={[fogColor, fogNear, fogFar]} />}

      {/* Ground */}
      <FlatGround size={1000} color="#4a6b4a" />

      {/* Mountains - background */}
      <MountainRange
        position={[0, 0, -200]}
        count={9}
        spread={500}
        minHeight={80}
        maxHeight={150}
        baseColor="#5a6a7a"
      />

      {/* Mountains - midground */}
      <MountainRange
        position={[-100, 0, -120]}
        count={5}
        spread={200}
        minHeight={50}
        maxHeight={90}
        baseColor="#6a7a6a"
      />
      <MountainRange
        position={[100, 0, -100]}
        count={4}
        spread={180}
        minHeight={40}
        maxHeight={70}
        baseColor="#6a7a6a"
      />

      {/* Hills - foreground */}
      <Hill position={[-80, 0, -40]} radius={30} height={15} />
      <Hill position={[90, 0, -50]} radius={25} height={12} />
      <Hill position={[0, 0, -60]} radius={20} height={8} />

      {/* Mountain road */}
      <MountainRoad width={6} hasGuardrails />

      {/* Forests */}
      <Forest
        position={[-60, 0, -30]}
        width={40}
        depth={40}
        density={30}
        treeTypes={['pine']}
      />
      <Forest
        position={[70, 0, -40]}
        width={50}
        depth={30}
        density={25}
        treeTypes={['pine']}
      />

      {/* Tree lines along road */}
      <TreeLine
        treeType="pine"
        count={15}
        spacing={8}
        position={[-15, 0, -50]}
        direction={[0, 0, 1]}
      />
      <TreeLine
        treeType="pine"
        count={15}
        spacing={8}
        position={[15, 0, -50]}
        direction={[0, 0, 1]}
      />

      {/* Cyclist */}
      {showCyclist && !animateCyclist && (
        <Cyclist
          position={[0, 0, 10]}
          rotation={[0, Math.PI, 0]}
          bikeColor="#cc3333"
          jerseyColor="#ff6600"
        />
      )}

      {animateCyclist && (
        <AnimatedCyclist
          speed={8}
          bikeColor="#cc3333"
          jerseyColor="#ff6600"
        />
      )}
    </group>
  )
}

export function AlpineClimbScene({ difficulty = 'medium' }) {
  const gradients = {
    easy: { elevation: 10, switchbacks: 3 },
    medium: { elevation: 20, switchbacks: 5 },
    hard: { elevation: 35, switchbacks: 8 },
  }

  const config = gradients[difficulty] || gradients.medium

  return (
    <group>
      <Sky preset="noon" />
      <Lighting preset="day" intensity={1.2} />

      <fog attach="fog" args={['#b8d4e8', 80, 400]} />

      <FlatGround size={1000} color="#5a7a5a" />

      {/* Epic mountain backdrop */}
      <AlpineScene position={[0, 0, -100]} />

      {/* The climb road */}
      <MountainRoad width={5} hasGuardrails />

      {/* Pine forests on slopes */}
      <Forest
        position={[-40, 5, -20]}
        width={60}
        depth={80}
        density={50}
        treeTypes={['pine']}
      />
      <Forest
        position={[50, 3, -30]}
        width={50}
        depth={60}
        density={40}
        treeTypes={['pine']}
      />

      {/* Scattered individual trees */}
      <PineTree position={[-8, 2, 15]} scale={1.2} />
      <PineTree position={[12, 1, 20]} scale={0.9} />
      <PineTree position={[-15, 3, 5]} scale={1.1} />
    </group>
  )
}

export default MountainScene
