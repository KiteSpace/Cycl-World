import { Sky, Lighting, FlatGround, StreetLighting } from '../environment'
import { StraightRoad, BikeLane, CurvedRoad } from '../objects/Road'
import {
  CityBlock,
  SimpleBuilding,
  OfficeBuilding,
  BikeShop,
} from '../objects/Buildings'
import { DeciduousTree, TreeLine } from '../objects/Trees'
import { Cyclist, CyclistGroup, AnimatedCyclist } from '../objects/Cyclist'

export function CityScene({
  timeOfDay = 'day',
  trafficDensity = 'medium',
  showCyclists = true,
}) {
  const isNight = timeOfDay === 'night'
  const isEvening = timeOfDay === 'evening'

  const streetLightPositions = [
    [-20, 0, -40],
    [-20, 0, -20],
    [-20, 0, 0],
    [-20, 0, 20],
    [-20, 0, 40],
    [20, 0, -40],
    [20, 0, -20],
    [20, 0, 0],
    [20, 0, 20],
    [20, 0, 40],
  ]

  return (
    <group>
      {/* Environment */}
      <Sky
        preset={isNight ? 'night' : isEvening ? 'sunset' : 'noon'}
        showClouds={!isNight}
      />
      <Lighting
        preset={isNight ? 'night' : isEvening ? 'sunset' : 'day'}
        intensity={isNight ? 0.3 : 1}
      />

      {/* Ground */}
      <FlatGround size={500} color="#3a3a3a" />

      {/* Main road */}
      <StraightRoad
        length={200}
        width={12}
        position={[0, 0.01, 0]}
        hasMarkings
        hasSidewalk
      />

      {/* Bike lane */}
      <BikeLane
        length={200}
        width={2}
        position={[-8, 0.02, 0]}
        color="#2d5a27"
      />

      {/* Cross street */}
      <StraightRoad
        length={150}
        width={10}
        position={[0, 0.01, 0]}
        rotation={[0, Math.PI / 2, 0]}
        hasMarkings
        hasSidewalk={false}
      />

      {/* Buildings - left side */}
      <CityBlock
        position={[-50, 0, -50]}
        buildingCount={6}
        blockWidth={60}
        blockDepth={60}
        minHeight={15}
        maxHeight={45}
      />

      {/* Buildings - right side */}
      <CityBlock
        position={[50, 0, -50]}
        buildingCount={5}
        blockWidth={55}
        blockDepth={60}
        minHeight={20}
        maxHeight={60}
      />

      {/* Buildings - back left */}
      <CityBlock
        position={[-50, 0, 50]}
        buildingCount={4}
        blockWidth={50}
        blockDepth={50}
        minHeight={12}
        maxHeight={35}
      />

      {/* Bike shop */}
      <BikeShop position={[25, 0, 15]} />

      {/* Tall office building landmark */}
      <OfficeBuilding
        position={[60, 0, -80]}
        width={20}
        depth={20}
        floors={15}
      />

      {/* Street trees */}
      <TreeLine
        treeType="deciduous"
        count={10}
        spacing={12}
        position={[-15, 0, -60]}
        direction={[0, 0, 1]}
        scaleVariation={0.2}
      />
      <TreeLine
        treeType="deciduous"
        count={10}
        spacing={12}
        position={[15, 0, -60]}
        direction={[0, 0, 1]}
        scaleVariation={0.2}
      />

      {/* Street lighting */}
      {(isNight || isEvening) && (
        <StreetLighting
          positions={streetLightPositions}
          intensity={isNight ? 2 : 1}
        />
      )}

      {/* Cyclists */}
      {showCyclists && (
        <group>
          <Cyclist
            position={[-7, 0, 5]}
            rotation={[0, 0, 0]}
            bikeColor="#3366cc"
            jerseyColor="#ff6600"
          />
          <Cyclist
            position={[-7, 0, -10]}
            rotation={[0, 0, 0]}
            bikeColor="#cc3333"
            jerseyColor="#33cc33"
          />
        </group>
      )}
    </group>
  )
}

export function CriteriumRaceScene({ racersCount = 8 }) {
  return (
    <group>
      <Sky preset="noon" />
      <Lighting preset="day" intensity={1.1} />

      <FlatGround size={300} color="#444444" />

      {/* Race circuit - simplified rectangular course */}
      <StraightRoad length={80} width={10} position={[0, 0.01, -30]} />
      <StraightRoad length={80} width={10} position={[0, 0.01, 30]} />
      <StraightRoad
        length={60}
        width={10}
        position={[-40, 0.01, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />
      <StraightRoad
        length={60}
        width={10}
        position={[40, 0.01, 0]}
        rotation={[0, Math.PI / 2, 0]}
      />

      {/* Corners */}
      <CurvedRoad radius={15} position={[32, 0.01, -22]} angle={Math.PI / 2} />
      <CurvedRoad
        radius={15}
        position={[-32, 0.01, -22]}
        angle={Math.PI / 2}
      />
      <CurvedRoad radius={15} position={[32, 0.01, 22]} angle={Math.PI / 2} />
      <CurvedRoad radius={15} position={[-32, 0.01, 22]} angle={Math.PI / 2} />

      {/* Barriers and buildings around course */}
      <CityBlock
        position={[0, 0, -70]}
        buildingCount={4}
        blockWidth={80}
        blockDepth={30}
        minHeight={10}
        maxHeight={25}
      />
      <CityBlock
        position={[0, 0, 70]}
        buildingCount={4}
        blockWidth={80}
        blockDepth={30}
        minHeight={10}
        maxHeight={25}
      />

      {/* Peloton of racers */}
      <CyclistGroup
        position={[0, 0, -20]}
        count={racersCount}
        formation="peloton"
        spread={8}
      />
    </group>
  )
}

export function CommuteCityScene() {
  return (
    <group>
      <Sky preset="dawn" />
      <Lighting preset="dawn" />

      <FlatGround size={400} color="#3d3d3d" />

      {/* Main commute road */}
      <StraightRoad length={300} width={14} hasMarkings hasSidewalk />

      {/* Protected bike lane */}
      <BikeLane length={300} width={2.5} position={[-10, 0.02, 0]} />

      {/* Buildings along the route */}
      <CityBlock
        position={[-60, 0, 0]}
        buildingCount={8}
        blockWidth={40}
        blockDepth={200}
        minHeight={15}
        maxHeight={50}
      />
      <CityBlock
        position={[60, 0, 0]}
        buildingCount={8}
        blockWidth={40}
        blockDepth={200}
        minHeight={20}
        maxHeight={60}
      />

      {/* Street trees */}
      <TreeLine
        treeType="deciduous"
        count={20}
        spacing={10}
        position={[-18, 0, -100]}
        direction={[0, 0, 1]}
      />

      {/* Commuter cyclist */}
      <Cyclist
        position={[-9, 0, 0]}
        bikeColor="#333333"
        jerseyColor="#666666"
      />
    </group>
  )
}

export default CityScene
