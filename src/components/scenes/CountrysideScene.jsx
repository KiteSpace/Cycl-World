import { Sky, Lighting, FlatGround, Terrain, GrassField } from '../environment'
import { StraightRoad, BikeLane } from '../objects/Road'
import { Hill } from '../objects/Mountains'
import {
  DeciduousTree,
  AutumnTree,
  TreeLine,
  Forest,
  SwayingTree,
} from '../objects/Trees'
import { House, Warehouse } from '../objects/Buildings'
import { Cyclist, CyclistGroup, AnimatedCyclist } from '../objects/Cyclist'

export function CountrysideScene({
  season = 'summer',
  timeOfDay = 'day',
  showCyclist = true,
}) {
  const seasonColors = {
    spring: { grass: '#6ab04c', trees: '#7bed9f' },
    summer: { grass: '#4a8b4a', trees: '#3a7d32' },
    autumn: { grass: '#c7a84c', trees: '#ff7f50' },
    winter: { grass: '#8b9a6b', trees: '#5a6b5a' },
  }

  const colors = seasonColors[season] || seasonColors.summer
  const isAutumn = season === 'autumn'

  return (
    <group>
      {/* Environment */}
      <Sky
        preset={timeOfDay === 'evening' ? 'sunset' : timeOfDay === 'night' ? 'night' : 'noon'}
        showClouds
      />
      <Lighting preset={timeOfDay === 'evening' ? 'sunset' : 'day'} />

      {/* Ground */}
      <FlatGround size={800} color={colors.grass} />

      {/* Rolling hills */}
      <Hill position={[-80, 0, -60]} radius={40} height={12} color={colors.grass} />
      <Hill position={[100, 0, -80]} radius={50} height={15} color={colors.grass} />
      <Hill position={[-120, 0, -120]} radius={60} height={20} color={colors.grass} />
      <Hill position={[60, 0, 50]} radius={35} height={10} color={colors.grass} />
      <Hill position={[-50, 0, 80]} radius={45} height={8} color={colors.grass} />

      {/* Country road */}
      <StraightRoad
        length={400}
        width={6}
        hasMarkings
        hasSidewalk={false}
        position={[0, 0.01, 0]}
      />

      {/* Farmhouses */}
      <House position={[-40, 0, -30]} wallColor="#f5deb3" roofColor="#8b4513" />
      <House position={[50, 0, 40]} wallColor="#ffe4c4" roofColor="#a0522d" />

      {/* Barn/Warehouse */}
      <Warehouse position={[-60, 0, -50]} width={15} depth={25} height={8} color="#8b4513" />

      {/* Tree lines along road */}
      <TreeLine
        treeType={isAutumn ? 'autumn' : 'deciduous'}
        count={20}
        spacing={15}
        position={[-12, 0, -150]}
        direction={[0, 0, 1]}
        randomOffset={2}
      />
      <TreeLine
        treeType={isAutumn ? 'autumn' : 'deciduous'}
        count={20}
        spacing={15}
        position={[12, 0, -150]}
        direction={[0, 0, 1]}
        randomOffset={2}
      />

      {/* Forest patches */}
      <Forest
        position={[-100, 0, -40]}
        width={50}
        depth={60}
        density={25}
        treeTypes={isAutumn ? ['autumn'] : ['deciduous']}
      />
      <Forest
        position={[90, 0, -60]}
        width={40}
        depth={50}
        density={20}
        treeTypes={isAutumn ? ['autumn'] : ['deciduous']}
      />

      {/* Individual feature trees */}
      <SwayingTree position={[25, 0, 20]} scale={1.3} />
      <SwayingTree position={[-30, 0, 15]} scale={1.1} />

      {/* Grass patches */}
      {season !== 'winter' && (
        <GrassField
          width={150}
          depth={150}
          density={5000}
          position={[-50, 0, -50]}
          color={colors.grass}
        />
      )}

      {/* Cyclist */}
      {showCyclist && (
        <Cyclist
          position={[0, 0, 10]}
          rotation={[0, Math.PI, 0]}
          bikeColor="#2e86de"
          jerseyColor="#ff9f43"
        />
      )}
    </group>
  )
}

export function GranFondoScene({ stage = 1 }) {
  // Multi-stage gran fondo with varying terrain
  return (
    <group>
      <Sky preset="noon" showClouds />
      <Lighting preset="day" intensity={1.1} />

      <fog attach="fog" args={['#c8d8e8', 100, 500]} />

      <FlatGround size={1000} color="#5a8a5a" />

      {/* Long winding road */}
      <StraightRoad length={500} width={7} hasMarkings hasSidewalk={false} />

      {/* Gentle rolling terrain */}
      <Terrain
        width={400}
        depth={400}
        maxHeight={15}
        color="#4a8a4a"
        position={[0, -1, 0]}
      />

      {/* Distant hills */}
      <Hill position={[-150, 0, -100]} radius={80} height={30} color="#5a7a5a" />
      <Hill position={[180, 0, -120]} radius={70} height={25} color="#5a7a5a" />
      <Hill position={[0, 0, -180]} radius={100} height={40} color="#4a6a6a" />

      {/* Scattered farms and buildings */}
      <House position={[-60, 0, -40]} />
      <House position={[80, 0, 60]} />
      <Warehouse position={[-100, 0, 50]} width={20} depth={30} />

      {/* Tree coverage */}
      <Forest
        position={[-120, 0, -60]}
        width={60}
        depth={80}
        density={35}
        treeTypes={['deciduous', 'pine']}
      />
      <Forest
        position={[100, 0, -80]}
        width={70}
        depth={60}
        density={30}
        treeTypes={['deciduous']}
      />

      {/* Road-side trees */}
      <TreeLine
        treeType="deciduous"
        count={30}
        spacing={12}
        position={[-15, 0, -200]}
        direction={[0, 0, 1]}
      />

      {/* Group of cyclists */}
      <CyclistGroup
        position={[0, 0, 0]}
        count={6}
        formation="echelon"
      />
    </group>
  )
}

export function SunsetCountryRide() {
  return (
    <group>
      <Sky preset="sunset" showClouds />
      <Lighting preset="sunset" intensity={0.9} />

      <fog attach="fog" args={['#ffccaa', 60, 300]} />

      <FlatGround size={600} color="#7a8a5a" />

      {/* Silhouette hills */}
      <Hill position={[-100, 0, -80]} radius={60} height={25} color="#4a5a4a" />
      <Hill position={[80, 0, -100]} radius={50} height={20} color="#4a5a4a" />
      <Hill position={[0, 0, -150]} radius={80} height={35} color="#3a4a3a" />

      {/* Country lane */}
      <StraightRoad length={300} width={5} hasMarkings={false} hasSidewalk={false} />

      {/* Scattered trees as silhouettes */}
      <TreeLine
        treeType="deciduous"
        count={12}
        spacing={20}
        position={[-20, 0, -100]}
        direction={[0, 0, 1]}
      />

      {/* Solo cyclist enjoying the sunset */}
      <AnimatedCyclist
        speed={5}
        bikeColor="#222222"
        jerseyColor="#333333"
      />
    </group>
  )
}

export default CountrysideScene
